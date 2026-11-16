@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instale o Node.js 24 ou superior em https://nodejs.org
 pause
 exit /b 1
)
echo Site: http://127.0.0.1:4173
echo Painel: http://127.0.0.1:4173/admin
echo Mantenha esta janela aberta enquanto utiliza o sistema.
node server.mjs
pause
