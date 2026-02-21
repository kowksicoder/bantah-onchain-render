@echo off
set NODE_ENV=development
set NODE_OPTIONS=--max-old-space-size=4096
set PORT=5100
set FRONTEND_URL=http://localhost:5100
set VITE_APP_MODE=onchain
npx tsx server/index.ts > onchain-dev-server.out.log 2> onchain-dev-server.err.log
