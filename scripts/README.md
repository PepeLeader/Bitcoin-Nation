# Bitcoin Nation — Deployment Scripts

TypeScript scripts for deploying Bitcoin Nation contracts to OPNet.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your wallet credentials:

```env
# Option A: Mnemonic (recommended — provides both ECDSA + ML-DSA keys)
MNEMONIC="your twenty four word mnemonic here"

# Option B: WIF private key (ECDSA only)
# WIF_KEY=cNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Network: regtest, testnet, or mainnet
NETWORK=testnet
```

## Deploying

```bash
npm run deploy
```

This deploys both contracts in order:

1. **BitcoinNationNFT** (template) — The OP721 template that the factory clones for each new collection
2. **BitcoinNationFactory** — The factory contract that references the template

The script:
- Derives your wallet from the mnemonic/WIF
- Checks for available UTXOs
- Deploys the NFT template first
- Uses the template's public key as the factory's constructor argument
- Broadcasts funding + reveal transactions for each contract
- Saves deployment info to `deployment.json`

## Output

After deployment, `deployment.json` will contain:

```json
{
  "network": "testnet",
  "walletAddress": "opt1p...",
  "templateAddress": "opt1sq...",
  "factoryAddress": "opt1sq...",
  "timestamp": "2026-02-23T20:47:16.068Z"
}
```

Update `frontend/src/config/contracts.ts` with the new `factoryAddress`.

## Files

| File | Description |
|------|-------------|
| `deploy.ts` | Main deployment script |
| `test-flow.ts` | End-to-end test flow (create collection, mint, transfer) |
| `deployment.json` | Last deployment output |
| `.env.example` | Environment variable template |
