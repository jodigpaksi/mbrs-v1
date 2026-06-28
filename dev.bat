@echo off
echo Starting MBRS v1 dev services...

start "Vite" cmd /k "cd /d C:\XAMPP\htdocs\mbrs-v1\client && npm run dev"
start "Reverb" cmd /k "cd /d C:\XAMPP\htdocs\mbrs-v1\server && php artisan reverb:start"
start "Scheduler" cmd /k "cd /d C:\XAMPP\htdocs\mbrs-v1\server && php artisan schedule:work"

echo All services started. XAMPP (Apache + MySQL) must be running separately.
