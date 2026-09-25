@echo off
title PPS Particle Count Report
cd /d "%~dp0"
rem Prefer the "py" launcher: on Windows "python" can be a Microsoft Store shortcut that does not run anything
set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY where python >nul 2>nul && set "PY=python"
if not defined PY (
  echo Python is not installed or not on PATH. See the manual: static\manual.html
  pause
  exit /b 1
)
%PY% server.py
pause
