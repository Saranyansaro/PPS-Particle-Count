@echo off
title PPS Particle Count Report
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python is not installed or not on PATH. See the manual: static\manual.html
  pause
  exit /b
)
python server.py
pause
