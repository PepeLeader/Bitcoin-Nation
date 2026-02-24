import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '@btc-vision/unit-test-framework';
import { BitcoinNationFactoryRuntime } from './contracts/runtime/BitcoinNationFactoryRuntime.js';
import { BitcoinNationNFTRuntime } from './contracts/runtime/BitcoinNationNFTRuntime.js';

const COLLECTION_PARAMS = {
    name: 'Test Collection',
    symbol: 'TC',
    baseURI: 'ipfs://QmTestCollection/',
    maxSupply: 1000n,
    mintPrice: 50_000n,
    maxPerWallet: 10n,
    collectionBanner: 'ipfs://banner-hash',
    collectionIcon: 'ipfs://icon-hash',
    collectionWebsite: 'https://test-collection.xyz',
    collectionDescription: 'A test NFT collection',
} as const;

// ─── View Methods ────────────────────────────────────────────────────────────

await opnet('BitcoinNationFactory — View Methods', async (vm: OPNetUnit) => {
    let factory: BitcoinNationFactoryRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const factoryAddress: Address = Blockchain.generateRandomAddress();
    const templateAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        // Register the NFT template so the factory can reference it
        const nftTemplate: BitcoinNationNFTRuntime = new BitcoinNationNFTRuntime(
            deployer,
            templateAddress,
            {
                name: 'Template',
                symbol: 'TPL',
                baseURI: '',
                maxSupply: 0n,
                mintPrice: 0n,
                maxPerWallet: 0n,
                collectionBanner: '',
                collectionIcon: '',
                collectionWebsite: '',
                collectionDescription: '',
            },
        );
        Blockchain.register(nftTemplate);
        await nftTemplate.init();

        factory = new BitcoinNationFactoryRuntime(
            deployer,
            factoryAddress,
            templateAddress,
        );
        Blockchain.register(factory);
        await factory.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
    });

    vm.afterEach(() => {
        factory.dispose();
        Blockchain.dispose();
    });

    await vm.it('should return zero collection count on fresh deploy', async () => {
        const count: bigint = await factory.collectionCount();
        Assert.expect(count).toEqual(0n);
    });

    await vm.it('should revert collectionAtIndex on empty factory', async () => {
        await Assert.expect(async () => {
            await factory.collectionAtIndex(0n);
        }).toThrow();
    });
});

// ─── Create Collection ───────────────────────────────────────────────────────

await opnet('BitcoinNationFactory — createCollection', async (vm: OPNetUnit) => {
    let factory: BitcoinNationFactoryRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const factoryAddress: Address = Blockchain.generateRandomAddress();
    const templateAddress: Address = Blockchain.generateRandomAddress();
    const creator: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        const nftTemplate: BitcoinNationNFTRuntime = new BitcoinNationNFTRuntime(
            deployer,
            templateAddress,
            {
                name: 'Template',
                symbol: 'TPL',
                baseURI: '',
                maxSupply: 0n,
                mintPrice: 0n,
                maxPerWallet: 0n,
                collectionBanner: '',
                collectionIcon: '',
                collectionWebsite: '',
                collectionDescription: '',
            },
        );
        Blockchain.register(nftTemplate);
        await nftTemplate.init();

        factory = new BitcoinNationFactoryRuntime(
            deployer,
            factoryAddress,
            templateAddress,
        );
        Blockchain.register(factory);
        await factory.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
    });

    vm.afterEach(() => {
        factory.dispose();
        Blockchain.dispose();
    });

    await vm.it('should create a collection and return an address (happy path)', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        const collectionAddress: Address = await factory.createCollection(COLLECTION_PARAMS);
        // Address should be non-zero (a valid deployed address)
        Assert.expect(collectionAddress.toString().length).toBeGreaterThan(0);
    });

    await vm.it('should increment collection count after creation', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        await factory.createCollection(COLLECTION_PARAMS);

        const count: bigint = await factory.collectionCount();
        Assert.expect(count).toEqual(1n);
    });

    await vm.it('should create multiple collections with unique addresses', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        const addr1: Address = await factory.createCollection(COLLECTION_PARAMS);
        const addr2: Address = await factory.createCollection({
            ...COLLECTION_PARAMS,
            name: 'Second Collection',
            symbol: 'SC',
        });

        Assert.expect(addr1.toString()).toNotEqual(addr2.toString());

        const count: bigint = await factory.collectionCount();
        Assert.expect(count).toEqual(2n);
    });

    await vm.it('should allow different users to create collections', async () => {
        const anotherCreator: Address = Blockchain.generateRandomAddress();

        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;
        await factory.createCollection(COLLECTION_PARAMS);

        Blockchain.msgSender = anotherCreator;
        Blockchain.txOrigin = anotherCreator;
        await factory.createCollection({
            ...COLLECTION_PARAMS,
            name: 'Another Collection',
            symbol: 'AC',
        });

        const count: bigint = await factory.collectionCount();
        Assert.expect(count).toEqual(2n);
    });
});

// ─── Collection At Index ─────────────────────────────────────────────────────

await opnet('BitcoinNationFactory — collectionAtIndex', async (vm: OPNetUnit) => {
    let factory: BitcoinNationFactoryRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const factoryAddress: Address = Blockchain.generateRandomAddress();
    const templateAddress: Address = Blockchain.generateRandomAddress();
    const creator: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        const nftTemplate: BitcoinNationNFTRuntime = new BitcoinNationNFTRuntime(
            deployer,
            templateAddress,
            {
                name: 'Template',
                symbol: 'TPL',
                baseURI: '',
                maxSupply: 0n,
                mintPrice: 0n,
                maxPerWallet: 0n,
                collectionBanner: '',
                collectionIcon: '',
                collectionWebsite: '',
                collectionDescription: '',
            },
        );
        Blockchain.register(nftTemplate);
        await nftTemplate.init();

        factory = new BitcoinNationFactoryRuntime(
            deployer,
            factoryAddress,
            templateAddress,
        );
        Blockchain.register(factory);
        await factory.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
    });

    vm.afterEach(() => {
        factory.dispose();
        Blockchain.dispose();
    });

    await vm.it('should return the correct address at index 0', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        const createdAddress: Address = await factory.createCollection(COLLECTION_PARAMS);
        const indexedAddress: Address = await factory.collectionAtIndex(0n);

        Assert.expect(indexedAddress.toString()).toEqual(createdAddress.toString());
    });

    await vm.it('should revert on out-of-bounds index', async () => {
        await Assert.expect(async () => {
            await factory.collectionAtIndex(0n);
        }).toThrow();
    });

    await vm.it('should revert on index equal to count', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        await factory.createCollection(COLLECTION_PARAMS);

        // count is 1, index 1 is out of bounds
        await Assert.expect(async () => {
            await factory.collectionAtIndex(1n);
        }).toThrow();
    });

    await vm.it('should revert on very large index', async () => {
        await Assert.expect(async () => {
            await factory.collectionAtIndex(
                115792089237316195423570985008687907853269984665640564039457584007913129639935n,
            );
        }).toThrow();
    });
});

// ─── Approval System ─────────────────────────────────────────────────────────

await opnet('BitcoinNationFactory — Approval System', async (vm: OPNetUnit) => {
    let factory: BitcoinNationFactoryRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const factoryAddress: Address = Blockchain.generateRandomAddress();
    const templateAddress: Address = Blockchain.generateRandomAddress();
    const creator: Address = Blockchain.generateRandomAddress();
    const nonCreator: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        const nftTemplate: BitcoinNationNFTRuntime = new BitcoinNationNFTRuntime(
            deployer,
            templateAddress,
            {
                name: 'Template',
                symbol: 'TPL',
                baseURI: '',
                maxSupply: 0n,
                mintPrice: 0n,
                maxPerWallet: 0n,
                collectionBanner: '',
                collectionIcon: '',
                collectionWebsite: '',
                collectionDescription: '',
            },
        );
        Blockchain.register(nftTemplate);
        await nftTemplate.init();

        factory = new BitcoinNationFactoryRuntime(
            deployer,
            factoryAddress,
            templateAddress,
        );
        Blockchain.register(factory);
        await factory.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
    });

    vm.afterEach(() => {
        factory.dispose();
        Blockchain.dispose();
    });

    await vm.it('should set deployer as admin', async () => {
        const adminAddr: Address = await factory.admin();
        Assert.expect(adminAddr.toString()).toEqual(deployer.toString());
    });

    await vm.it('should return 0 (none) for unknown collection approval status', async () => {
        const unknownAddr: Address = Blockchain.generateRandomAddress();
        const status: bigint = await factory.approvalStatus(unknownAddr);
        Assert.expect(status).toEqual(0n);
    });

    await vm.it('should store collection creator on createCollection', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        const collectionAddress: Address = await factory.createCollection(COLLECTION_PARAMS);
        const storedCreator: Address = await factory.collectionCreator(collectionAddress);
        Assert.expect(storedCreator.toString()).toEqual(creator.toString());
    });

    await vm.it('should allow creator to apply for mint', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        const collectionAddress: Address = await factory.createCollection(COLLECTION_PARAMS);
        const success: boolean = await factory.applyForMint(collectionAddress);
        Assert.expect(success).toEqual(true);

        const status: bigint = await factory.approvalStatus(collectionAddress);
        Assert.expect(status).toEqual(1n);
    });

    await vm.it('should revert applyForMint from non-creator', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        const collectionAddress: Address = await factory.createCollection(COLLECTION_PARAMS);

        Blockchain.msgSender = nonCreator;
        Blockchain.txOrigin = nonCreator;

        await Assert.expect(async () => {
            await factory.applyForMint(collectionAddress);
        }).toThrow();
    });

    await vm.it('should allow admin to approve a collection', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        const collectionAddress: Address = await factory.createCollection(COLLECTION_PARAMS);
        await factory.applyForMint(collectionAddress);

        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;

        const success: boolean = await factory.approveCollection(collectionAddress);
        Assert.expect(success).toEqual(true);

        const status: bigint = await factory.approvalStatus(collectionAddress);
        Assert.expect(status).toEqual(2n);
    });

    await vm.it('should revert approveCollection from non-admin', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        const collectionAddress: Address = await factory.createCollection(COLLECTION_PARAMS);

        await Assert.expect(async () => {
            await factory.approveCollection(collectionAddress);
        }).toThrow();
    });

    await vm.it('should allow admin to reject a collection', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        const collectionAddress: Address = await factory.createCollection(COLLECTION_PARAMS);
        await factory.applyForMint(collectionAddress);

        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;

        const success: boolean = await factory.rejectCollection(collectionAddress);
        Assert.expect(success).toEqual(true);

        const status: bigint = await factory.approvalStatus(collectionAddress);
        Assert.expect(status).toEqual(3n);
    });

    await vm.it('should allow creator to re-apply after rejection', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        const collectionAddress: Address = await factory.createCollection(COLLECTION_PARAMS);
        await factory.applyForMint(collectionAddress);

        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;
        await factory.rejectCollection(collectionAddress);

        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;
        const success: boolean = await factory.applyForMint(collectionAddress);
        Assert.expect(success).toEqual(true);

        const status: bigint = await factory.approvalStatus(collectionAddress);
        Assert.expect(status).toEqual(1n);
    });

    await vm.it('should revert applyForMint when already pending', async () => {
        Blockchain.msgSender = creator;
        Blockchain.txOrigin = creator;

        const collectionAddress: Address = await factory.createCollection(COLLECTION_PARAMS);
        await factory.applyForMint(collectionAddress);

        await Assert.expect(async () => {
            await factory.applyForMint(collectionAddress);
        }).toThrow();
    });
});

// ─── Factory — Template Not Set Edge Case ────────────────────────────────────

await opnet('BitcoinNationFactory — template not set', async (vm: OPNetUnit) => {
    let factory: BitcoinNationFactoryRuntime;

    const deployer: Address = Blockchain.generateRandomAddress();
    const factoryAddress: Address = Blockchain.generateRandomAddress();
    // Use a zero-like address as template (simulating unset)
    const zeroTemplate: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        // Deploy factory WITHOUT registering a template contract
        // The factory stores templateAddress but the contract at that address doesn't exist
        factory = new BitcoinNationFactoryRuntime(
            deployer,
            factoryAddress,
            zeroTemplate,
        );
        Blockchain.register(factory);
        await factory.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
    });

    vm.afterEach(() => {
        factory.dispose();
        Blockchain.dispose();
    });

    await vm.it('should revert createCollection when template contract is not registered', async () => {
        await Assert.expect(async () => {
            await factory.createCollection(COLLECTION_PARAMS);
        }).toThrow();
    });
});
