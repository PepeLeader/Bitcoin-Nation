# Bitcoin Nation

An NFT launchpad built on [OPNet](https://opnet.org) — Bitcoin's Layer 1 smart contract runtime. Creators can deploy NFT collections, and collectors can mint directly on Bitcoin with BTC payments verified on-chain.

## Architecture

The project is organized into three packages:

```
bitcoin-nation/
├── contracts/   — OPNet smart contracts (AssemblyScript → WASM)
├── frontend/    — React + Vite web application
└── scripts/     — Deployment and utility scripts
```

### Smart Contracts

Two contracts power the platform:

- **BitcoinNationNFT** — An OP721 (OPNet's ERC-721 equivalent) NFT contract with single-transaction minting. Payment is split 90% to the collection creator and 10% to the platform treasury, verified via P2TR output matching on-chain.
- **BitcoinNationFactory** — A factory contract that deploys new NFT collections by cloning the template contract using `Blockchain.deployContractFromExisting`. Handles creation fees and collection approval workflows.

### Frontend

A React SPA that provides:

- **Browse** — Discover approved NFT collections
- **Create** — Deploy a new collection via the factory (IPFS metadata upload included)
- **Mint** — Mint NFTs with real-time supply polling and low-supply warnings
- **Portfolio** — View owned NFTs across collections
- **Admin** — Approve/reject collections, manage platform settings

### Scripts

TypeScript deployment scripts for deploying both contracts to OPNet (regtest, testnet, or mainnet).

## Getting Started

### Prerequisites

- Node.js 18+
- A Bitcoin wallet compatible with OPNet (e.g., [OP_WALLET](https://opnet.org))

### 1. Deploy Contracts

```bash
cd contracts
npm install
npm run build

cd ../scripts
npm install
cp .env.example .env
# Edit .env with your mnemonic or WIF key
npm run deploy
```

The deploy script outputs contract addresses and saves them to `scripts/deployment.json`.

### 2. Configure & Run Frontend

```bash
cd frontend
npm install
```

Update `src/config/contracts.ts` with the factory address from deployment, then:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Network Configuration

| Network | RPC URL | Status |
|---------|---------|--------|
| Regtest | `https://regtest.opnet.org` | Development |
| Testnet | `https://testnet.opnet.org` | Testing |
| Mainnet | `https://api.opnet.org` | Production |

Network addresses are configured in `frontend/src/config/contracts.ts`.

## How Minting Works

1. User selects quantity and clicks **Mint**
2. Frontend constructs a Bitcoin transaction with P2TR payment outputs (90% creator / 10% platform)
3. Contract simulates the mint to verify payment and supply
4. A fresh supply check runs after simulation to minimize race conditions
5. User signs the transaction in their wallet
6. Contract verifies payment outputs on-chain, mints NFTs, and emits transfer events

### Race Condition Protections

Since BTC transfers are irreversible even if a contract reverts, the frontend includes protective measures for limited-supply collections:

- **2-second supply polling** — Available supply refreshes every 2 seconds on the mint page
- **Low-supply warning** — A visible warning appears when 5 or fewer NFTs remain
- **Pre-send supply check** — After simulation, supply is re-verified before broadcasting the transaction
- **Instant disable** — The mint button is disabled when supply reaches 0

## License

MIT
