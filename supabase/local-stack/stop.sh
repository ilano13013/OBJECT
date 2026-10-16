#!/usr/bin/env bash
pkill -f "postgrest" || true; pkill -f "auth serve" || true; pkill -f "dist/start/server.js" || true; pkill -f "local-stack/gateway.mjs" || true
