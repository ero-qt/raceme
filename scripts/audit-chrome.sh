#!/bin/sh
# Starts Playwright's Chromium without its sandbox for Puppeteer-based audit tools, because Ubuntu
# blocks that sandbox for unprivileged users. The EDPS collector's PDF step passes no options.
exec "$RACEME_AUDIT_CHROME" --no-sandbox "$@"
