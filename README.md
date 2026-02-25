# Bitcoin Nation

An NFT launchpad and token-gated community platform built on [OPNet](https://opnet.org) — Bitcoin's Layer 1 smart contract runtime. Creators can deploy NFT collections, collectors can mint directly on Bitcoin with BTC payments verified on-chain, and holders get access to exclusive nation forums.

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
- **Your Nations** — Token-gated forums for each NFT collection (see below)
- **Rankings** — Landing page leaderboard ranked by volume, holders, and forum engagement
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

## Token-Gated Nation Forums

Every approved NFT collection gets its own forum — accessible only to holders of that collection's NFTs (`balanceOf > 0`). This creates exclusive community spaces tied to on-chain ownership.

### How It Works

1. Navigate to **Your Nations** — the page loads all approved collections and checks your wallet's `balanceOf` for each
2. Only collections where you hold at least one NFT appear as clickable cards
3. Click into a collection to access its forum — create threads, reply, and vote
4. A token gate check runs on every forum/thread page load, so access is revoked the moment you no longer hold an NFT

### Forum Features

- **Threads** — Create discussion threads with a title and body
- **Replies** — Reply to any thread
- **Voting** — Upvote/downvote threads and individual replies (toggle to remove your vote)
- **Engagement scoring** — Total threads + posts + votes per collection feed into the landing page ranking system's "Engagement" column

### Storage

Forum data is currently stored in `localStorage` via a `ForumService` abstraction. This means posts are per-browser only for now. The service interface is designed so it can be swapped to a backend API without touching any UI code.

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
