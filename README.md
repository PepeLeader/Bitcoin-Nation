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

- **BitcoinNationNFT** — An OP721 (OPNet's ERC-721 equivalent) NFT contract with single-transaction minting. Payment is split 90% to the collection creator and 10% to the platform treasury, verified via P2TR output matching on-chain. Includes ownership transfer, adjustable mint price/fees, and treasury management.
- **BitcoinNationFactory** — A factory contract (with reentrancy guard) that deploys new NFT collections by cloning the template contract using `Blockchain.deployContractFromExisting`. Handles creation fees, collection approval workflows, admin transfer, and enforces a 100,000 max supply cap.

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

## Deployed Contracts

### Testnet (OPNet Signet)

| Contract | Address |
|----------|---------|
| Factory | `opt1sqzy8zvyf8qh04cjf4vl8s7rg7s7w0vqr7sft9zuj` |
| NFT Template | `opt1sqp00qu6g24cluyklxl2mkkwf93f0yj2ttumu9cuv` |

### Regtest

| Contract | Address |
|----------|---------|
| Factory | `opr1sqpk7rhjxjn6vqex54t48kjjsl9n8fk77rcfjhdpl` |

### Mainnet

Not yet deployed.

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

Since BTC transfers are irreversible even if a contract reverts, the platform has three layers of protection for limited-supply collections:

**Layer 1 — UI (MintNFTPage)**
- **15-second supply polling** — Available supply refreshes automatically on the mint page
- **Low-supply warning at 30 remaining** — A prominent warning explains the risk of BTC loss if the collection sells out mid-transaction, along with the safety measures in place
- **Quantity validation** — Mint button is disabled when requested quantity exceeds available supply
- **Sold-out state** — Button shows "Sold Out" and is disabled when supply reaches 0
- **Pre-mint refresh** — Supply is refreshed one more time when the user clicks Mint, before proceeding

**Layer 2 — Hook (useNFTContract)**
- **Fresh supply check before wallet popup** — After simulation succeeds, `availableSupply()` is read one final time. If supply dropped below the requested quantity, the mint is cancelled with an explanatory message before the wallet ever opens

**Layer 3 — Contract (BitcoinNationNFT)**
- **On-chain revert** — `_ensureSupplyAvailable()` reverts the entire transaction if `totalSupply + quantity > maxSupply`, preventing minting beyond the cap

The residual risk is limited to the narrow window between the wallet confirmation and on-chain settlement — two users minting the very last tokens within seconds of each other. The low-supply warning at 30 remaining informs users of this risk before they proceed.

## License

MIT
