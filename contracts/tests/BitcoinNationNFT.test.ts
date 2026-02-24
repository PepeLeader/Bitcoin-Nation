import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '@btc-vision/unit-test-framework';
import { BitcoinNationNFTRuntime } from './contracts/runtime/BitcoinNationNFTRuntime.js';

const DEFAULT_PARAMS = {
    name: 'Bitcoin Nation',
    symbol: 'BTNFT',
    baseURI: 'ipfs://QmTest/',
    maxSupply: 100n,
    mintPrice: 10_000n,
    maxPerWallet: 5n,
    collectionBanner: 'ipfs://banner',
    collectionIcon: 'ipfs://icon',
    collectionWebsite: 'https://bitcoinnation.xyz',
    collectionDescription: 'Test NFT Collection',
} as const;

const MAX_U256: bigint =
    115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// ─── View Methods ────────────────────────────────────────────────────────────

await opnet('BitcoinNationNFT — View Methods', async (vm: OPNetUnit) => {
    let nft: BitcoinNationNFTRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, DEFAULT_PARAMS);
        Blockchain.register(nft);
        await nft.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should return the configured mint price', async () => {
        const price: bigint = await nft.mintPrice();
        Assert.expect(price).toEqual(DEFAULT_PARAMS.mintPrice);
    });

    await vm.it('should return the configured max per wallet', async () => {
        const max: bigint = await nft.maxPerWallet();
        Assert.expect(max).toEqual(DEFAULT_PARAMS.maxPerWallet);
    });

    await vm.it('should return minting closed by default', async () => {
        const isOpen: boolean = await nft.isMintingOpen();
        Assert.expect(isOpen).toEqual(false);
    });

    await vm.it('should return zero mints for a fresh address', async () => {
        const randomUser: Address = Blockchain.generateRandomAddress();
        const count: bigint = await nft.mintedBy(randomUser);
        Assert.expect(count).toEqual(0n);
    });
});

// ─── Owner Mint ──────────────────────────────────────────────────────────────

await opnet('BitcoinNationNFT — ownerMint', async (vm: OPNetUnit) => {
    let nft: BitcoinNationNFTRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const alice: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, DEFAULT_PARAMS);
        Blockchain.register(nft);
        await nft.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should mint token ID 1 to alice (happy path)', async () => {
        const tokenId: bigint = await nft.ownerMint(alice);
        Assert.expect(tokenId).toEqual(1n);
    });

    await vm.it('should increment token IDs on sequential mints', async () => {
        const firstId: bigint = await nft.ownerMint(alice);
        const secondId: bigint = await nft.ownerMint(alice);

        Assert.expect(firstId).toEqual(1n);
        Assert.expect(secondId).toEqual(2n);
    });

    await vm.it('should revert when called by non-deployer', async () => {
        const unauthorized: Address = Blockchain.generateRandomAddress();
        Blockchain.msgSender = unauthorized;
        Blockchain.txOrigin = unauthorized;

        await Assert.expect(async () => {
            await nft.ownerMint(alice);
        }).toThrow();
    });
});

// ─── Owner Mint — Supply Exhaustion ──────────────────────────────────────────

await opnet('BitcoinNationNFT — ownerMint supply limit', async (vm: OPNetUnit) => {
    let nft: BitcoinNationNFTRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const alice: Address = Blockchain.generateRandomAddress();

    const smallSupplyParams = { ...DEFAULT_PARAMS, maxSupply: 2n };

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, smallSupplyParams);
        Blockchain.register(nft);
        await nft.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should revert when max supply is exhausted', async () => {
        await nft.ownerMint(alice);
        await nft.ownerMint(alice);

        await Assert.expect(async () => {
            await nft.ownerMint(alice);
        }).toThrow();
    });
});

// ─── Mint With URI ───────────────────────────────────────────────────────────

await opnet('BitcoinNationNFT — mintWithURI', async (vm: OPNetUnit) => {
    let nft: BitcoinNationNFTRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const alice: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, DEFAULT_PARAMS);
        Blockchain.register(nft);
        await nft.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should mint with custom URI (happy path)', async () => {
        const tokenId: bigint = await nft.mintWithURI(alice, 'ipfs://custom-metadata/1');
        Assert.expect(tokenId).toEqual(1n);
    });

    await vm.it('should revert when called by non-deployer', async () => {
        const unauthorized: Address = Blockchain.generateRandomAddress();
        Blockchain.msgSender = unauthorized;
        Blockchain.txOrigin = unauthorized;

        await Assert.expect(async () => {
            await nft.mintWithURI(alice, 'ipfs://custom-metadata/1');
        }).toThrow();
    });
});

// ─── Set Minting Open ────────────────────────────────────────────────────────

await opnet('BitcoinNationNFT — setMintingOpen', async (vm: OPNetUnit) => {
    let nft: BitcoinNationNFTRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, DEFAULT_PARAMS);
        Blockchain.register(nft);
        await nft.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should open minting (deployer)', async () => {
        const success: boolean = await nft.setMintingOpen(true);
        Assert.expect(success).toEqual(true);

        const isOpen: boolean = await nft.isMintingOpen();
        Assert.expect(isOpen).toEqual(true);
    });

    await vm.it('should close minting after opening it', async () => {
        await nft.setMintingOpen(true);
        await nft.setMintingOpen(false);

        const isOpen: boolean = await nft.isMintingOpen();
        Assert.expect(isOpen).toEqual(false);
    });

    await vm.it('should revert when called by non-deployer', async () => {
        const unauthorized: Address = Blockchain.generateRandomAddress();
        Blockchain.msgSender = unauthorized;
        Blockchain.txOrigin = unauthorized;

        await Assert.expect(async () => {
            await nft.setMintingOpen(true);
        }).toThrow();
    });
});

// ─── Public Mint ─────────────────────────────────────────────────────────────

await opnet('BitcoinNationNFT — publicMint', async (vm: OPNetUnit) => {
    let nft: BitcoinNationNFTRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const minter: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, DEFAULT_PARAMS);
        Blockchain.register(nft);
        await nft.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;

        // Open minting for public mint tests
        await nft.setMintingOpen(true);
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should mint 1 token (happy path)', async () => {
        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        const firstTokenId: bigint = await nft.publicMint(1n);
        Assert.expect(firstTokenId).toEqual(1n);
    });

    await vm.it('should mint multiple tokens in one tx', async () => {
        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        const firstTokenId: bigint = await nft.publicMint(3n);
        Assert.expect(firstTokenId).toEqual(1n);
    });

    await vm.it('should track mints per address', async () => {
        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        await nft.publicMint(2n);

        const minted: bigint = await nft.mintedBy(minter);
        Assert.expect(minted).toEqual(2n);
    });

    await vm.it('should revert when minting is closed', async () => {
        // Close minting
        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;
        await nft.setMintingOpen(false);

        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        await Assert.expect(async () => {
            await nft.publicMint(1n);
        }).toThrow();
    });

    await vm.it('should revert on zero quantity', async () => {
        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        await Assert.expect(async () => {
            await nft.publicMint(0n);
        }).toThrow();
    });

    await vm.it('should revert when quantity exceeds MAX_MINT_PER_TX (10)', async () => {
        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        await Assert.expect(async () => {
            await nft.publicMint(11n);
        }).toThrow();
    });

    await vm.it('should allow minting exactly MAX_MINT_PER_TX (10) if within limits', async () => {
        // Need enough supply and wallet limit
        // Default maxPerWallet is 5, so this should revert due to wallet limit
        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        await Assert.expect(async () => {
            await nft.publicMint(10n);
        }).toThrow();
    });
});

// ─── Public Mint — Wallet Limit ──────────────────────────────────────────────

await opnet('BitcoinNationNFT — publicMint wallet limit', async (vm: OPNetUnit) => {
    let nft: BitcoinNationNFTRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const minter: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, DEFAULT_PARAMS);
        Blockchain.register(nft);
        await nft.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await nft.setMintingOpen(true);
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should allow minting up to wallet limit', async () => {
        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        await nft.publicMint(5n);

        const minted: bigint = await nft.mintedBy(minter);
        Assert.expect(minted).toEqual(5n);
    });

    await vm.it('should revert when exceeding per-wallet limit', async () => {
        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        await nft.publicMint(5n);

        await Assert.expect(async () => {
            await nft.publicMint(1n);
        }).toThrow();
    });

    await vm.it('should revert when single mint exceeds wallet limit', async () => {
        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        // maxPerWallet is 5, trying to mint 6 in one go
        await Assert.expect(async () => {
            await nft.publicMint(6n);
        }).toThrow();
    });
});

// ─── Public Mint — Supply Exhaustion ─────────────────────────────────────────

await opnet('BitcoinNationNFT — publicMint supply exhaustion', async (vm: OPNetUnit) => {
    let nft: BitcoinNationNFTRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const minterA: Address = Blockchain.generateRandomAddress();
    const minterB: Address = Blockchain.generateRandomAddress();

    const tinySupplyParams = { ...DEFAULT_PARAMS, maxSupply: 3n, maxPerWallet: 10n };

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, tinySupplyParams);
        Blockchain.register(nft);
        await nft.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await nft.setMintingOpen(true);
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should revert when public mint exceeds max supply', async () => {
        Blockchain.msgSender = minterA;
        Blockchain.txOrigin = minterA;
        await nft.publicMint(3n);

        Blockchain.msgSender = minterB;
        Blockchain.txOrigin = minterB;

        await Assert.expect(async () => {
            await nft.publicMint(1n);
        }).toThrow();
    });

    await vm.it('should revert when requested quantity exceeds remaining supply', async () => {
        Blockchain.msgSender = minterA;
        Blockchain.txOrigin = minterA;
        await nft.publicMint(2n);

        Blockchain.msgSender = minterB;
        Blockchain.txOrigin = minterB;

        await Assert.expect(async () => {
            await nft.publicMint(2n);
        }).toThrow();
    });
});

// ─── Edge Cases — Max u256 Values ────────────────────────────────────────────

await opnet('BitcoinNationNFT — edge case: extreme u256 values', async (vm: OPNetUnit) => {
    let nft: BitcoinNationNFTRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const minter: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should revert publicMint with MAX_U256 quantity', async () => {
        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, DEFAULT_PARAMS);
        Blockchain.register(nft);
        await nft.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await nft.setMintingOpen(true);

        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        await Assert.expect(async () => {
            await nft.publicMint(MAX_U256);
        }).toThrow();
    });

    await vm.it('should store and return large mint price', async () => {
        const largePriceParams = { ...DEFAULT_PARAMS, mintPrice: 1_000_000_000_000n };
        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, largePriceParams);
        Blockchain.register(nft);
        await nft.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;

        const price: bigint = await nft.mintPrice();
        Assert.expect(price).toEqual(1_000_000_000_000n);
    });
});

// ─── Zero Max Supply (revert) ────────────────────────────────────────────────

await opnet('BitcoinNationNFT — zero maxSupply deployment', async (vm: OPNetUnit) => {
    let nft: BitcoinNationNFTRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();

    const zeroSupplyParams = { ...DEFAULT_PARAMS, maxSupply: 0n };

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should revert deployment when maxSupply is zero', async () => {
        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, zeroSupplyParams);
        Blockchain.register(nft);
        await nft.init();

        // Deployment with maxSupply=0 reverts — any call should fail
        await Assert.expect(async () => {
            await nft.mintPrice();
        }).toThrow();
    });
});

// ─── Zero Max Per Wallet (unlimited wallet mints) ────────────────────────────

await opnet('BitcoinNationNFT — zero maxPerWallet (no wallet limit)', async (vm: OPNetUnit) => {
    let nft: BitcoinNationNFTRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const minter: Address = Blockchain.generateRandomAddress();

    const noWalletLimitParams = { ...DEFAULT_PARAMS, maxSupply: 1000n, maxPerWallet: 0n };

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        nft = new BitcoinNationNFTRuntime(deployer, contractAddress, noWalletLimitParams);
        Blockchain.register(nft);
        await nft.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await nft.setMintingOpen(true);
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should allow minting beyond default wallet limit when maxPerWallet is zero', async () => {
        Blockchain.msgSender = minter;
        Blockchain.txOrigin = minter;

        await nft.publicMint(10n);

        const minted: bigint = await nft.mintedBy(minter);
        Assert.expect(minted).toEqual(10n);
    });
});
