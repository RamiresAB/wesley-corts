# Wesley Cort’s

Landing page com scrollytelling e painel privado de gestão. Node.js 24+ e SQLite nativo; sem instalação de dependências.

## Site público no GitHub Pages

A landing page é publicada a partir da pasta `docs/`. O GitHub Pages não executa o servidor Node nem o banco SQLite: o painel administrativo completo funciona na instalação local e não está disponível pelo endereço público.

Para atualizar os dados do site público, edite `site-config.json`, execute `npm run build:pages` e envie as alterações para a branch `main`. As configurações feitas no painel local não atualizam automaticamente o GitHub Pages. O código do painel está no repositório; senhas, sessões e banco de clientes são excluídos pelo `.gitignore` e nunca entram na publicação.

## Abrir

Execute `iniciar.bat`. Site: http://127.0.0.1:4173 — painel: http://127.0.0.1:4173/admin.
No primeiro acesso, o barbeiro cria sua senha (mínimo 12 caracteres). Não há senha padrão. O servidor precisa permanecer ligado. Acesso inicial somente no próprio computador; senha armazenada com scrypt, sessão HttpOnly com 12 horas de validade e limitação de tentativas de login.

## Rotina

- **Assinaturas:** cadastro e edição, início/fim inclusivos, valor, método preferencial, pausa/cancelamento e histórico. Ativa significa vigência atual e situação ativa; o registro do recebimento é mostrado separadamente.
- **Pagamentos:** registre mensalidades efetivamente recebidas. Na renovação, preencha as novas datas e marque “Atualizar a vigência”. Não há cobrança bancária automática, emissão de nota ou armazenamento de cartões.
- **Agenda e lista:** horários para assinantes e avulsos; edição/remarcação/cancelamento; bloqueio de sobreposição; lista por ordem de inclusão, chamada e conclusão. A lista não reserva horário nem promete tempo de espera. O barbeiro concilia lista e agenda. Os botões sexta/sábado/domingo facilitam a seleção do próximo fim de semana a partir da data selecionada.
- **Regra implementada:** uma visita por semana de segunda a domingo, incluindo agenda e lista, dentro da vigência. Uma visita pode ser cabelo, barba ou ambos; cabelo e barba juntos devem ocupar a mesma visita. Cancelamentos liberam a semana. Validar esta interpretação comercial com o proprietário antes da operação.
- **Lembretes:** vencidas, vencimentos nos próximos 3 dias e horários hoje/amanhã. Mensagem copiável para envio manual, sem automação externa.
- **Configurações:** valores públicos, endereço, horários e WhatsApp. O WhatsApp ainda não foi informado; os CTAs abrem o perfil oficial enquanto o campo estiver vazio. Não existe reserva automática pelo site público.

## Persistência e backup

Banco em `data/wesley.sqlite` (fora da pasta pública). Exporte os registros pelo painel. Para cópia restaurável completa, pare o servidor e copie a pasta `data` inteira para um local privado; para restaurar, pare o servidor e substitua a pasta por essa cópia. O JSON é uma exportação de consulta/migração; não há importador na interface. Não compartilhe a pasta `data` nem a inclua em repositórios. Testes usam banco isolado e não alteram o banco de uso real.

## Conteúdo confirmado — 2026-11-16

- Usuário: assinatura R$ 149,90, cabelo R$ 40, barba R$ 20, combo R$ 60; sexta a domingo com hora marcada ou nome na lista.
- Bio do Instagram, consultada no Chrome conectado: Rua Renato de Oliveira, 320, Monte Verde, São José do Rio Preto; 09:00/20:00. A bio não especifica dias de abertura; o site não os inventa.
- Fotos reais: https://www.instagram.com/wesleycorts/ — taper, low fade e barba italiana. Logo fornecido pelo usuário.
- Fotos ilustrativas baixadas, disponíveis em assets/barber.jpg e detail.jpg, mas não necessárias na versão final: Unsplash (photo-1622287162716-f311baa1a2b8 e Ato Aikins/photo-1686671805337-7d8aa64b965f).

## Validação e publicação

`npm test` executa os testes de integração. `npm start` inicia o servidor.

A landing page pode ser publicada no GitHub Pages. Para disponibilizar também o painel na internet: hospedagem Node 24+ com volume persistente, domínio/HTTPS, backup e acesso do proprietário. Defina `COOKIE_SECURE=1` atrás de HTTPS e `HOST` conforme o ambiente; configure a senha localmente antes de expor o servidor. `PORT` e `DATA_DIR` também são configuráveis. O painel não é compatível com hospedagem somente estática. Confirmar WhatsApp e política de semanas/renovação antes do uso comercial. Nenhum serviço pago foi contratado.
