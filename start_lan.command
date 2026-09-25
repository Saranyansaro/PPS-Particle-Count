#!/bin/bash
# Mac: start the app so a phone on the same Wi-Fi can use it
cd "$(dirname "$0")"
python3 server.py --lan
