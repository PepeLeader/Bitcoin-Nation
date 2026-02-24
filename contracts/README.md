# Bitcoin Nation — Smart Contracts

OPNet smart contracts written in AssemblyScript, compiled to WASM, and executed on Bitcoin Layer 1.

## Contracts

### BitcoinNationNFT

An OP721 NFT contract implementing single-transaction minting with on-chain payment verification.

**Key features:**
- Single-transaction mint — payment verification and NFT minting in one call
- Payment split verified on-chain: 90% to creator, 10% to platform treasury
- Dual-path verification: `output.to` (simulation) and `scriptPublicKey` (on-chain)
- Per-wallet mint limits
- Owner-only `mintWithURI` for custom 1/1 NFTs
- Configurable max supply and mint price

**Methods:**

| Method | Access | Description |
|--------|--------|-------------|
| `mint(quantity)` | Public | Mint NFTs with BTC payment |
| `ownerMint(to)` | Owner | Mint a single NFT to any address |
| `mintWithURI(to, uri)` | Owner | Mint with custom metadata URI |
| `setMintingOpen(open)` | Owner | Toggle public minting |
| `mintPrice()` | View | Get mint price in satoshis |
| `availableSupply()` | View | Get remaining mintable supply |
| `maxPerWallet()` | View | Get per-wallet mint limit |
| `isMintingOpen()` | View | Check if minting is enabled |
| `owner()` | View | Get collection owner address |
| `mintedBy(account)` | View | Get mint count for an address |
| `treasury()` | View | Get treasury address |
| `treasuryTweakedKey()` | View | Get treasury P2TR tweaked key |
| `ownerTweakedKey()` | View | Get owner P2TR tweaked key |

### BitcoinNationFactory

A factory contract that deploys new NFT collections by cloning the template.

**Key features:**
- Deploys collections via `Blockchain.deployContractFromExisting` with salt-based addressing
- Creation fee verified via P2TR output matching
- Collection approval workflow (none → pending → approved/rejected)
- Collection registry with index-based lookup

**Methods:**

| Method | Access | Description |
|--------|--------|-------------|
| `createCollection(...)` | Public | Deploy a new NFT collection (requires creation fee) |
| `applyForMint(address)` | Creator | Apply for minting approval |
| `approveCollection(address)` | Admin | Approve a collection |
| `rejectCollection(address)` | Admin | Reject a collection |
| `collectionCount()` | View | Get total collections deployed |
| `collectionAtIndex(index)` | View | Get collection address by index |
| `approvalStatus(address)` | View | Get approval status (0=none, 1=pending, 2=approved, 3=rejected) |
| `collectionCreator(address)` | View | Get creator of a collection |
| `admin()` | View | Get admin address |
| `creationFee()` | View | Get collection creation fee |
| `adminTweakedKey()` | View | Get admin P2TR tweaked key |

## Project Structure

```
contracts/
├── src/
│   ├── BitcoinNationNFT.ts          — NFT collection contract
│   ├── index.ts                     — NFT entry point
│   ├── factory/
│   │   ├── BitcoinNationFactory.ts  — Factory contract
│   │   └── index.ts                 — Factory entry point
│   └── interfaces/
│       └── Events.ts                — Event definitions
├── abis/                            — Generated ABIs and type definitions
├── tests/                           — Contract tests
├── asconfig.json                    — AssemblyScript build configuration
├── package.json
└── tsconfig.json
```

## Building

```bash
npm install
npm run build
```

This compiles both contracts:
- `build/BitcoinNationNFT.wasm`
- `build/BitcoinNationFactory.wasm`

Individual builds:
```bash
npm run build:nft
npm run build:factory
```

## Dependencies

- [`@btc-vision/btc-runtime`](https://github.com/btc-vision/btc-runtime) — OPNet smart contract runtime
- [`@btc-vision/as-bignum`](https://github.com/niclas-AVM/as-bignum) — AssemblyScript big number library
- [`@btc-vision/assemblyscript`](https://github.com/niclas-AVM/assemblyscript) — OPNet's AssemblyScript fork
