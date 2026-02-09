@echo off
cd /d C:\Users\mikol\Desktop\Dev\asystent
echo [%date% %time%] Starting bot... >> bot.log
node dist\index.js >> bot.log 2>&1
echo [%date% %time%] Bot exited with code %errorlevel% >> bot.log
