@echo off
title PPS Particle Count Report (phone access)
cd /d "%~dp0"
python server.py --lan
pause
