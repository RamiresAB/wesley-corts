import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url)), dir=process.env.DATA_DIR||path.join(root,'data');
mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(path.join(dir,'wesley.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS store(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,expires INTEGER NOT NULL);`);
const get=k=>{const r=db.prepare('SELECT value FROM store WHERE key=?').get(k);return r?JSON.parse(r.value):null;};
const put=(k,v)=>db.prepare('INSERT OR REPLACE INTO store VALUES(?,?)').run(k,JSON.stringify(v));
const defaults={phone:'',address:'Rua Renato de Oliveira, 320 · Monte Verde · São José do Rio Preto / SP',hours:'9h às 20h',planPrice:'149.90',cutPrice:'40',beardPrice:'20',comboPrice:'60'};
if(!get('business'))put('business',defaults);
if(!get('clients'))put('clients',[]);
if(!get('appointments'))put('appointments',[]);
if(!get('payments'))put('payments',[]);
if(!get('queue'))put('queue',[]);
const hash=v=>createHash('sha256').update(v).digest('hex');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const week=s=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const fail=(m,status=400)=>{throw Object.assign(new Error(m),{status});};
const text=(v,max=160)=>typeof v==='string'?v.trim().slice(0,max):'';
const attempts=new Map();
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 const send=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
 const url=new URL(req.url,'http://localhost');
 if(!url.pathname.startsWith('/api/')){
  if(!['GET','HEAD'].includes(req.method))return send({error:'Método não permitido.'},405);
  const name=url.pathname==='/'?'index.html':url.pathname==='/admin'?'admin.html':decodeURIComponent(url.pathname).slice(1);
  const file=path.resolve(root,'public',name),base=path.join(root,'public')+path.sep;
  if(!file.startsWith(base)||!existsSync(file))return send({error:'Página não encontrada.'},404);
  const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-cache'});return res.end(req.method==='HEAD'?undefined:readFileSync(file));
 }
 if(req.method==='GET'&&url.pathname==='/api/public')return send(get('business'));
 const sid=(req.headers.cookie||'').match(/(?:^|; )session=([a-f0-9]+)/)?.[1];
 const session=sid&&db.prepare('SELECT expires FROM sessions WHERE id=?').get(hash(sid));
 const logged=!!session&&session.expires>Date.now();
 if(req.method==='GET'&&url.pathname==='/api/session')return send({logged,setup:!get('owner')});
 let body={};
 if(!['GET','HEAD'].includes(req.method)){
  if(req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)fail('Origem inválida.',403);
  if(!req.headers['content-type']?.startsWith('application/json'))fail('Formato inválido.',415);
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)fail('Envio muito grande.',413);}
  try{body=JSON.parse(raw||'{}');}catch{fail('JSON inválido.');}
 }
 if(req.method==='POST'&&['/api/setup','/api/login'].includes(url.pathname)){
  const ip=req.socket.remoteAddress,attempt=attempts.get(ip)||{n:0,until:Date.now()+900000};
  if(attempt.until<Date.now()){attempt.n=0;attempt.until=Date.now()+900000;}
  if(attempt.n>=5)fail('Aguarde 15 minutos antes de tentar novamente.',429);
  const password=typeof body.password==='string'?body.password:'';
  if(password.length>200)fail('Senha muito longa.');
  if(url.pathname==='/api/setup'){
   if(get('owner'))fail('O acesso já foi configurado.',409);
   if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip))fail('Configure o acesso no computador do servidor.',403);
   if(password.length<12)fail('Use uma senha com pelo menos 12 caracteres.');
   const salt=randomBytes(16).toString('hex');put('owner',{salt,key:scryptSync(password,salt,64).toString('hex')});
  }else{
   const owner=get('owner');if(!owner)fail('Configure o primeiro acesso.',409);
   if(!timingSafeEqual(scryptSync(password,owner.salt,64),Buffer.from(owner.key,'hex'))){attempt.n++;attempts.set(ip,attempt);fail('Senha incorreta.',401);}
  }
  attempts.delete(ip);const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?)').run(hash(token),Date.now()+12*3600000);
  res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.COOKIE_SECURE==='1'?'; Secure':''}`);return send({ok:true});
 }
 if(!logged)fail('Entre para acessar o painel.',401);
 if(req.method==='POST'&&url.pathname==='/api/logout'){db.prepare('DELETE FROM sessions WHERE id=?').run(hash(sid));res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send({ok:true});}
 if(req.method==='GET'&&url.pathname==='/api/data')return send({business:get('business'),clients:get('clients'),appointments:get('appointments'),payments:get('payments'),queue:get('queue'),today:today()});
 if(req.method==='GET'&&url.pathname==='/api/export'){res.setHeader('Content-Disposition','attachment; filename="wesley-backup.json"');return send({version:1,exported:new Date().toISOString(),business:get('business'),clients:get('clients'),appointments:get('appointments'),payments:get('payments'),queue:get('queue')});}
 if(req.method==='POST'&&url.pathname==='/api/queue'){
  const list=get('queue'),old=body.id&&list.find(x=>x.id===body.id);if(body.id&&!old)fail('Nome não encontrado.',404);
  const q={id:old?.id||randomBytes(8).toString('hex'),name:text(body.name,100),phone:text(body.phone,20),date:body.date,service:body.service,status:body.status,order:old?.order||Date.now(),clientId:text(body.clientId,40)};
  if(!q.name||!validDate(q.date)||!['Cabelo','Barba','Cabelo e barba'].includes(q.service)||!['waiting','serving','done','cancelled'].includes(q.status))fail('Confira nome, data e serviço.');
  if(q.status==='serving'&&list.some(x=>x.id!==q.id&&x.date===q.date&&x.status==='serving'))fail('Conclua o atendimento em andamento antes de chamar o próximo.');
  if(q.clientId&&q.status!=='cancelled'){
   const c=get('clients').find(c=>c.id===q.clientId);if(!c||c.status!=='active'||q.date<c.start||q.date>c.end)fail('Assinatura inválida para esta data.');
   if(list.some(x=>x.id!==q.id&&x.clientId===q.clientId&&x.status!=='cancelled'&&week(x.date)===week(q.date))||get('appointments').some(x=>x.clientId===q.clientId&&x.status!=='cancelled'&&week(x.date)===week(q.date)))fail('Este assinante já tem uma visita nesta semana.');
  }
  if(q.status==='done'&&q.date>today())fail('Não é possível concluir um atendimento futuro.');
  if(old)list[list.indexOf(old)]=q;else list.push(q);put('queue',list);return send({ok:true});
 }
 if(req.method==='POST'&&url.pathname==='/api/settings'){
  const b={};for(const k of Object.keys(defaults))b[k]=text(body[k],k==='hours'?300:160);
  if(b.phone&&!/^55\d{10,11}$/.test(b.phone))fail('WhatsApp: use 55 + DDD + número, somente dígitos.');
  for(const k of ['planPrice','cutPrice','beardPrice','comboPrice'])if(b[k]&&(!Number.isFinite(Number(b[k]))||Number(b[k])<=0))fail('Preços devem ser positivos.');
  put('business',b);return send({ok:true});
 }
 if(req.method==='POST'&&url.pathname==='/api/clients'){
  const list=get('clients'),old=body.id&&list.find(c=>c.id===body.id);
  if(body.id&&!old)fail('Cliente não encontrado.',404);
  const c={id:old?.id||randomBytes(8).toString('hex'),name:text(body.name,100),phone:text(body.phone,20),start:body.start,end:body.end,method:body.method,status:body.status,amount:Number(body.amount),notes:text(body.notes,500)};
  if(!c.name||!validDate(c.start)||!validDate(c.end)||c.end<c.start||!Number.isFinite(c.amount)||c.amount<=0||!['Pix','Cartão','Dinheiro','Outro'].includes(c.method)||!['active','paused','cancelled'].includes(c.status)||c.phone&&!/^\d{10,13}$/.test(c.phone))fail('Confira nome, telefone, datas, valor e forma de pagamento.');
  if(old)list[list.indexOf(old)]=c;else list.push(c);put('clients',list);return send({ok:true,id:c.id});
 }
 if(req.method==='POST'&&url.pathname==='/api/payments'){
  const clients=get('clients'),c=clients.find(c=>c.id===body.clientId),amount=Number(body.amount);
  if(!c||!validDate(body.date)||!validDate(body.start)||!validDate(body.end)||body.end<body.start||!Number.isFinite(amount)||amount<=0||!['Pix','Cartão','Dinheiro','Outro'].includes(body.method))fail('Confira os dados do pagamento.');
  const payments=get('payments');payments.push({id:randomBytes(8).toString('hex'),clientId:c.id,amount,date:body.date,start:body.start,end:body.end,method:body.method});
  if(body.renew){c.start=body.start;c.end=body.end;c.status='active';c.method=body.method;c.amount=amount;}
  db.exec('BEGIN');try{put('payments',payments);put('clients',clients);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return send({ok:true});
 }
 if(req.method==='POST'&&url.pathname==='/api/appointments'){
  const list=get('appointments'),old=body.id&&list.find(a=>a.id===body.id);
  if(body.id&&!old)fail('Agendamento não encontrado.',404);
  const a={id:old?.id||randomBytes(8).toString('hex'),clientId:text(body.clientId,40),name:text(body.name,100),phone:text(body.phone,20),date:body.date,time:body.time,duration:Number(body.duration),service:body.service,status:body.status};
  const c=get('clients').find(c=>c.id===a.clientId);
  if((a.clientId&&!c)||(!c&&!a.name)||!validDate(a.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)||![30,45,60,90].includes(a.duration)||!['Cabelo','Barba','Cabelo e barba'].includes(a.service)||!['scheduled','done','cancelled'].includes(a.status))fail('Confira os dados do agendamento.');
  if(a.status!=='cancelled'){
   if(c&&(c.status!=='active'||a.date<c.start||a.date>c.end))fail('A assinatura precisa estar ativa na data escolhida.');
   if(c&&(list.some(x=>x.id!==a.id&&x.clientId===a.clientId&&x.status!=='cancelled'&&week(x.date)===week(a.date))||get('queue').some(x=>x.clientId===a.clientId&&x.status!=='cancelled'&&week(x.date)===week(a.date))))fail('Este assinante já tem uma visita nesta semana (segunda a domingo).');
   const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
   if(minutes(a.time)+a.duration>1440)fail('O atendimento deve terminar no mesmo dia.');
   if(list.some(x=>x.id!==a.id&&x.status!=='cancelled'&&x.date===a.date&&minutes(x.time)<minutes(a.time)+a.duration&&minutes(a.time)<minutes(x.time)+x.duration))fail('Este horário conflita com outro atendimento.');
   if(a.status==='done'&&a.date>today())fail('Não é possível concluir um atendimento futuro.');
  }
  if(old)list[list.indexOf(old)]=a;else list.push(a);put('appointments',list);return send({ok:true});
 }
 send({error:'Rota não encontrada.'},404);
 }catch(e){send({error:e.status?e.message:'Erro interno. Tente novamente.'},e.status||500);}
});
server.listen(port,host,()=>console.log(`Wesley Cort’s: http://${host}:${port}`));
