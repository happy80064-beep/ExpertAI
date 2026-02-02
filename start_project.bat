@echo off
echo Starting ExpertMinds AI...

:: Start Backend
echo Starting Backend Server (Port 3001)...
start "ExpertMinds Backend" cmd /k "cd server && npm start"

:: Wait a moment for backend to initialize
timeout /t 3

:: Start Frontend
echo Starting Frontend Client...
start "ExpertMinds Client" cmd /k "npm run dev"

echo All services started!
