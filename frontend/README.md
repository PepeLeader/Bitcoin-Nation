# Bitcoin Nation — Frontend

React + TypeScript web application for the Bitcoin Nation NFT launchpad, built with Vite.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Homepage with platform overview |
| `/browse` | Browse | Discover approved NFT collections |
| `/mints` | Active Mints | View collections with open minting |
| `/create` | Create | Deploy a new NFT collection |
| `/collection/:address` | Collection Detail | View collection info and NFTs |
| `/collection/:address/mint` | Mint | Mint NFTs from a collection |
| `/collection/:address/nft/:tokenId` | NFT Detail | View NFT metadata, image, and transfer |
| `/profile` | Profile | User profile |
| `/portfolio` | Portfolio | View owned NFTs across collections |
| `/admin` | Admin | Platform admin tools |

## Project Structure

```
frontend/
├── src/
│   ├── abi/             — Contract ABI definitions
│   ├── components/      — Reusable UI components
│   │   ├── common/      — Header, Sidebar, Logo
│   │   ├── create/      — Collection creation components
│   │   └── wallet/      — Wallet connection button
│   ├── config/          — Network and contract configuration
│   ├── context/         — React contexts (sidebar state)
│   ├── hooks/           — Custom hooks for contract interaction
│   ├── pages/           — Page components
│   ├── services/        — Contract, IPFS, Provider, Wallet services
│   ├── styles/          — CSS (variables, reset, global, components)
│   ├── types/           — TypeScript type definitions
│   ├── utils/           — Formatting and validation utilities
│   ├── App.tsx          — Router and layout
│   └── main.tsx         — Entry point
├── contracts-types/     — Generated contract type definitions
├── public/              — Static assets
├── index.html           — HTML entry point
├── vite.config.ts       — Vite configuration
├── package.json
└── tsconfig.json
```

## Key Hooks

| Hook | Purpose |
|------|---------|
| `useWallet` | Wallet connection, address, network state |
| `useNFTContract` | Mint, transfer, query NFT contract methods |
| `useFactoryContract` | Create collections, query factory |
| `useCollectionData` | Fetch collection info with optional polling |
| `useApprovalContract` | Collection approval workflow |
| `useCollectionUpload` | IPFS metadata upload for collection creation |
| `useOwnedNFTs` | Fetch NFTs owned by the connected wallet |

## Services

| Service | Purpose |
|---------|---------|
| `ContractService` | Instantiates and caches contract instances |
| `IPFSService` | Upload files/metadata to IPFS, resolve IPFS URIs with fallback gateways |
| `ProviderService` | Manages the OPNet JSON-RPC provider connection |
| `WalletSignerService` | Handles wallet signing via WalletConnect |

## Development

```bash
npm install
npm run dev
```

Other commands:
```bash
npm run build       # Production build
npm run typecheck   # Type-check without emitting
npm run lint        # ESLint with auto-fix
npm run format      # Prettier formatting
```

## Configuration

Network and contract addresses are in `src/config/contracts.ts`. Update the factory address after deployment:

```typescript
// OPNet Testnet
factoryAddress: 'opt1sqz0kqvvc3gpz38lvwphhw5gx5vzgd24lev4skfyj',
```

## Dependencies

- [React 19](https://react.dev) + [React Router](https://reactrouter.com)
- [Vite](https://vite.dev) with React plugin and Node.js polyfills
- [`opnet`](https://github.com/niclas-AVM/opnet) — OPNet JSON-RPC provider
- [`@btc-vision/transaction`](https://github.com/niclas-AVM/transaction) — Transaction construction
- [`@btc-vision/walletconnect`](https://github.com/niclas-AVM/walletconnect) — Wallet integration
- [`@btc-vision/bitcoin`](https://github.com/niclas-AVM/bitcoin) — Bitcoin primitives
