# Railway Deploy (Onchain)

This deploys the `Onchain` app as one service (API + frontend from `dist/public`).

## 1) Create service

1. Go to Railway and create a new project from your GitHub repo.
2. In service settings, set **Root Directory** to `Onchain`.
3. Railway will pick up `railway.json` automatically.

## 2) Required variables

Set these in Railway Variables before first deploy:

- `NODE_ENV=production`
- `PORT` (Railway sets this automatically)
- `FRONTEND_URL=https://<your-railway-domain>`
- `VITE_APP_MODE=onchain`
- `ONCHAIN_EXECUTION_MODE=contract`
- `ONCHAIN_ENFORCE_WALLET=true`

### Database / Supabase

- `DATABASE_URL`
- `DATABASE_URL_DIRECT` (optional but recommended)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Auth

- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`

### Realtime / Notifications

- `PUSHER_APP_ID`
- `PUSHER_KEY`
- `PUSHER_SECRET`
- `PUSHER_CLUSTER`

### Onchain config

- `ONCHAIN_DEFAULT_CHAIN_ID`
- `ONCHAIN_ENABLED_CHAINS`
- `ONCHAIN_DEFAULT_TOKEN`
- `ONCHAIN_BASE_SEPOLIA_RPC_URL`
- `ONCHAIN_ARBITRUM_SEPOLIA_RPC_URL`
- `ONCHAIN_BSC_TESTNET_RPC_URL`
- `ONCHAIN_CELO_SEPOLIA_RPC_URL`
- `ONCHAIN_UNICHAIN_SEPOLIA_RPC_URL`
- `ONCHAIN_BASE_SEPOLIA_ESCROW_ADDRESS`
- `ONCHAIN_ARBITRUM_SEPOLIA_ESCROW_ADDRESS`
- `ONCHAIN_BSC_TESTNET_ESCROW_ADDRESS` (if deployed)
- `ONCHAIN_CELO_SEPOLIA_ESCROW_ADDRESS` (if deployed)
- `ONCHAIN_UNICHAIN_SEPOLIA_ESCROW_ADDRESS` (if deployed)
- `ONCHAIN_BASE_SEPOLIA_USDC_ADDRESS`
- `ONCHAIN_BASE_SEPOLIA_USDT_ADDRESS`
- `ONCHAIN_ARBITRUM_SEPOLIA_USDC_ADDRESS`
- `ONCHAIN_ARBITRUM_SEPOLIA_USDT_ADDRESS`

### Optional integrations

- `TELEGRAM_*` vars (if bot features are needed)
- `PAYSTACK_*` vars (if wallet fiat flows are needed)
- `ETHERSCAN_API_KEY`, `ALCHEMY_API_KEY` (deploy/ops scripts)

## 3) Deploy + verify

1. Trigger deploy.
2. Open logs and confirm: `Server running on port ...`
3. Check health endpoint:
   - `https://<your-railway-domain>/api/onchain/config`
4. Open app:
   - `https://<your-railway-domain>/`

## 4) If you later move frontend to Vercel

1. Keep Railway for backend only.
2. Update backend CORS:
   - `FRONTEND_URL=https://<your-vercel-domain>`
3. Point Vercel frontend API base to Railway backend URL.
