@echo off
REM Start Backend Server
START "Backend Server" cmd /k "cd D:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER && node ."

REM Wait 3 seconds for backend to start
timeout /t 3 /nobreak

REM Start Frontend Server
START "Frontend Server" cmd /k "cd D:\DREED\FMIS-BUDGET-SEPTEMBER\CLIENT && npm start"

REM Keep this window open
cmd /k
