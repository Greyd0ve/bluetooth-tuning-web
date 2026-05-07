#!/usr/bin/env bash
set -euo pipefail
APP_URL="${APP_URL:-http://127.0.0.1:4173/bluetooth-tuning-web/}"
chromium-browser \
  --kiosk "$APP_URL" \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --noerrdialogs \
  --overscroll-history-navigation=0
