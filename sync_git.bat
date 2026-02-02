@echo off
echo Syncing with GitHub...
git add .
set /p msg="Enter commit message: "
if "%msg%"=="" set msg="Auto update"
git commit -m "%msg%"
git push origin main
echo Done!
pause
