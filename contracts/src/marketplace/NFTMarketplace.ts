import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    AddressMemoryMap,
    Blockchain,
    BytesWriter,
    Calldata,
    EMPTY_POINTER,
    Network,
    Networks,
    ReentrancyGuard,
    ReentrancyLevel,
    Revert,
    SafeMath,
    Segwit,
    StoredAddress,
    StoredMapU256,
    StoredU256,
} from '@btc-vision/btc-runtime/runtime';

import {
    NFTListedEvent,
    NFTSoldEvent,
    NFTDelistedEvent,
    MarketplaceCollectionApprovedEvent,
    MarketplaceCollectionRevokedEvent,
    AdminTransferredEvent,
} from './Events';

/** OP721 transferFrom(address,address,uint256) — OPNet selector */
const TRANSFER_FROM_SELECTOR: u32 = 0x4b6685e7;

/** Platform fee: 33 / 1000 = 3.3% */
const DEFAULT_FEE_NUMERATOR: u64 = 33;
const FEE_DENOMINATOR: u256 = u256.fromU64(1000);

/** Maximum fee: 10% = 100/1000 */
const MAX_FEE_NUMERATOR: u256 = u256.fromU64(100);

/** Bitcoin dust limit in satoshis */
const DUST_LIMIT: u256 = u256.fromU64(546);

/** Listing status */
const LISTING_ACTIVE: u256 = u256.One;
const LISTING_INACTIVE: u256 = u256.Zero;

@final
export class NFTMarketplace extends ReentrancyGuard {
    protected readonly reentrancyLevel: ReentrancyLevel = ReentrancyLevel.STANDARD;

    // ── Storage pointers ──────────────────────────────────────────────
    private readonly adminPointer: u16 = Blockchain.nextPointer;
    private readonly adminTweakedKeyPointer: u16 = Blockchain.nextPointer;
    private readonly treasuryPointer: u16 = Blockchain.nextPointer;
    private readonly treasuryTweakedKeyPointer: u16 = Blockchain.nextPointer;
    private readonly platformFeeNumeratorPointer: u16 = Blockchain.nextPointer;
    private readonly listingCountPointer: u16 = Blockchain.nextPointer;
    private readonly approvedCollectionsPointer: u16 = Blockchain.nextPointer;
    private readonly listingCollectionPointer: u16 = Blockchain.nextPointer;
    private readonly listingTokenIdPointer: u16 = Blockchain.nextPointer;
    private readonly listingSellerPointer: u16 = Blockchain.nextPointer;
    private readonly listingPricePointer: u16 = Blockchain.nextPointer;
    private readonly listingSellerTweakedKeyPointer: u16 = Blockchain.nextPointer;
    private readonly listingActivePointer: u16 = Blockchain.nextPointer;

    // ── Storage wrappers ──────────────────────────────────────────────
    private readonly _admin: StoredAddress = new StoredAddress(this.adminPointer);
    private readonly _adminTweakedKey: StoredU256 = new StoredU256(
        this.adminTweakedKeyPointer,
        EMPTY_POINTER,
    );
    private readonly _treasury: StoredAddress = new StoredAddress(this.treasuryPointer);
    private readonly _treasuryTweakedKey: StoredU256 = new StoredU256(
        this.treasuryTweakedKeyPointer,
        EMPTY_POINTER,
    );
    private readonly _platformFeeNumerator: StoredU256 = new StoredU256(
        this.platformFeeNumeratorPointer,
        EMPTY_POINTER,
    );
    private readonly _listingCount: StoredU256 = new StoredU256(
        this.listingCountPointer,
        EMPTY_POINTER,
    );
    private readonly _approvedCollections: AddressMemoryMap = new AddressMemoryMap(
        this.approvedCollectionsPointer,
    );

    // Listing fields indexed by listingId (u256)
    private readonly _listingCollection: StoredMapU256 = new StoredMapU256(
        this.listingCollectionPointer,
    );
    private readonly _listingTokenId: StoredMapU256 = new StoredMapU256(
        this.listingTokenIdPointer,
    );
    private readonly _listingSeller: StoredMapU256 = new StoredMapU256(
        this.listingSellerPointer,
    );
    private readonly _listingPrice: StoredMapU256 = new StoredMapU256(
        this.listingPricePointer,
    );
    private readonly _listingSellerTweakedKey: StoredMapU256 = new StoredMapU256(
        this.listingSellerTweakedKeyPointer,
    );
    private readonly _listingActive: StoredMapU256 = new StoredMapU256(
        this.listingActivePointer,
    );

    public constructor() {
        super();
    }

    // ── Deployment ────────────────────────────────────────────────────
    public override onDeployment(calldata: Calldata): void {
        const adminTweakedKey: u256 = calldata.readU256();
        const treasuryTweakedKey: u256 = calldata.readU256();

        this._admin.value = Blockchain.tx.sender;
        this._adminTweakedKey.value = adminTweakedKey;
        this._treasury.value = Blockchain.tx.sender;
        this._treasuryTweakedKey.value = treasuryTweakedKey;
        this._platformFeeNumerator.value = u256.fromU64(DEFAULT_FEE_NUMERATOR);
    }

    // ── Collection approval ───────────────────────────────────────────

    @method({ name: 'collection', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public approveCollection(calldata: Calldata): BytesWriter {
        this.onlyAdmin();

        const collection: Address = calldata.readAddress();
        this._approvedCollections.set(collection, u256.One);

        this.emitEvent(new MarketplaceCollectionApprovedEvent(collection));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    @method({ name: 'collection', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public revokeCollection(calldata: Calldata): BytesWriter {
        this.onlyAdmin();

        const collection: Address = calldata.readAddress();
        this._approvedCollections.set(collection, u256.Zero);

        this.emitEvent(new MarketplaceCollectionRevokedEvent(collection));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ── Listing management ────────────────────────────────────────────

    @method(
        { name: 'collection', type: ABIDataTypes.ADDRESS },
        { name: 'tokenId', type: ABIDataTypes.UINT256 },
        { name: 'price', type: ABIDataTypes.UINT256 },
        { name: 'sellerTweakedKey', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'listingId', type: ABIDataTypes.UINT256 })
    @emit('NFTListed')
    public list(calldata: Calldata): BytesWriter {
        const collection: Address = calldata.readAddress();
        const tokenId: u256 = calldata.readU256();
        const price: u256 = calldata.readU256();
        const sellerTweakedKey: u256 = calldata.readU256();

        // Validate collection is approved
        const approved: u256 = this._approvedCollections.get(collection);
        if (approved != u256.One) {
            throw new Revert('Collection not approved for marketplace');
        }

        // Validate price above dust limit
        if (price < DUST_LIMIT) {
            throw new Revert('Price must be at least 546 sats');
        }

        const sender: Address = Blockchain.tx.sender;
        const listingId: u256 = this._listingCount.value;

        // Store listing data
        this._listingCollection.set(listingId, u256.fromUint8ArrayBE(collection));
        this._listingTokenId.set(listingId, tokenId);
        this._listingSeller.set(listingId, u256.fromUint8ArrayBE(sender));
        this._listingPrice.set(listingId, price);
        this._listingSellerTweakedKey.set(listingId, sellerTweakedKey);
        this._listingActive.set(listingId, LISTING_ACTIVE);

        // Increment counter
        this._listingCount.value = SafeMath.add(listingId, u256.One);

        this.emitEvent(new NFTListedEvent(sender, collection, tokenId, price, listingId));

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(listingId);
        return writer;
    }

    @method({ name: 'listingId', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('NFTDelisted')
    public delist(calldata: Calldata): BytesWriter {
        const listingId: u256 = calldata.readU256();

        // Validate listing exists and is active
        const active: u256 = this._listingActive.get(listingId);
        if (active != LISTING_ACTIVE) {
            throw new Revert('Listing is not active');
        }

        // Validate caller is the seller
        const sellerU256: u256 = this._listingSeller.get(listingId);
        const sender: Address = Blockchain.tx.sender;
        const senderU256: u256 = u256.fromUint8ArrayBE(sender);

        if (sellerU256 != senderU256) {
            throw new Revert('Only seller can delist');
        }

        // Mark inactive
        this._listingActive.set(listingId, LISTING_INACTIVE);

        this.emitEvent(new NFTDelistedEvent(sender, listingId));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * Buy an NFT from an active listing.
     * Buyer must include BTC outputs: 96.7% to seller, 3.3% to treasury.
     * Follows Checks-Effects-Interactions pattern.
     */
    @payable
    @method({ name: 'listingId', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('NFTSold')
    public buy(calldata: Calldata): BytesWriter {
        const listingId: u256 = calldata.readU256();

        // ── CHECKS ────────────────────────────────────────────────────
        const active: u256 = this._listingActive.get(listingId);
        if (active != LISTING_ACTIVE) {
            throw new Revert('Listing is not active');
        }

        const collectionU256: u256 = this._listingCollection.get(listingId);
        const collection: Address = Address.fromUint8Array(collectionU256.toUint8Array(true));
        const tokenId: u256 = this._listingTokenId.get(listingId);
        const sellerU256: u256 = this._listingSeller.get(listingId);
        const seller: Address = Address.fromUint8Array(sellerU256.toUint8Array(true));
        const price: u256 = this._listingPrice.get(listingId);
        const sellerTweakedKey: u256 = this._listingSellerTweakedKey.get(listingId);

        const buyer: Address = Blockchain.tx.sender;
        const buyerU256: u256 = u256.fromUint8ArrayBE(buyer);

        if (buyerU256 == sellerU256) {
            throw new Revert('Cannot buy your own listing');
        }

        // Calculate fee split
        const feeNumerator: u256 = this._platformFeeNumerator.value;
        const platformFee: u256 = SafeMath.div(SafeMath.mul(price, feeNumerator), FEE_DENOMINATOR);
        const sellerProceeds: u256 = SafeMath.sub(price, platformFee);

        // Verify BTC outputs
        const sellerTweakedBytes: Uint8Array = sellerTweakedKey.toUint8Array(true);
        const treasuryTweakedBytes: Uint8Array = this._treasuryTweakedKey.value.toUint8Array(true);

        const hrp: string = this._correctHrp();
        const sellerP2tr: string = Segwit.p2tr(hrp, sellerTweakedBytes);
        const treasuryP2tr: string = Segwit.p2tr(hrp, treasuryTweakedBytes);

        const sameRecipient: bool = sellerP2tr == treasuryP2tr;

        if (sameRecipient) {
            // Single output must cover the full price
            this._verifyOutput(price, sellerTweakedBytes, sellerP2tr);
        } else {
            // Two outputs: seller proceeds + platform fee
            if (sellerProceeds > u256.Zero) {
                this._verifyOutput(sellerProceeds, sellerTweakedBytes, sellerP2tr);
            }
            if (platformFee > u256.Zero) {
                this._verifyOutput(platformFee, treasuryTweakedBytes, treasuryP2tr);
            }
        }

        // ── EFFECTS ───────────────────────────────────────────────────
        this._listingActive.set(listingId, LISTING_INACTIVE);

        // ── INTERACTIONS ──────────────────────────────────────────────
        // Cross-contract call: NFT.transferFrom(seller, buyer, tokenId)
        const transferCalldata: BytesWriter = new BytesWriter(100);
        transferCalldata.writeSelector(TRANSFER_FROM_SELECTOR);
        transferCalldata.writeAddress(seller);
        transferCalldata.writeAddress(buyer);
        transferCalldata.writeU256(tokenId);

        // stopOnFailure=true means the entire tx reverts if transferFrom fails
        Blockchain.call(collection, transferCalldata, true);

        this.emitEvent(new NFTSoldEvent(buyer, seller, collection, tokenId, price, listingId));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ── View methods ──────────────────────────────────────────────────

    @view
    @method({ name: 'listingId', type: ABIDataTypes.UINT256 })
    @returns(
        { name: 'collection', type: ABIDataTypes.ADDRESS },
        { name: 'tokenId', type: ABIDataTypes.UINT256 },
        { name: 'seller', type: ABIDataTypes.ADDRESS },
        { name: 'price', type: ABIDataTypes.UINT256 },
        { name: 'sellerTweakedKey', type: ABIDataTypes.UINT256 },
        { name: 'active', type: ABIDataTypes.BOOL },
    )
    public getListing(calldata: Calldata): BytesWriter {
        const listingId: u256 = calldata.readU256();

        const collectionU256: u256 = this._listingCollection.get(listingId);
        const collection: Address = Address.fromUint8Array(collectionU256.toUint8Array(true));
        const tokenId: u256 = this._listingTokenId.get(listingId);
        const sellerU256: u256 = this._listingSeller.get(listingId);
        const seller: Address = Address.fromUint8Array(sellerU256.toUint8Array(true));
        const price: u256 = this._listingPrice.get(listingId);
        const sellerTweakedKeyVal: u256 = this._listingSellerTweakedKey.get(listingId);
        const active: u256 = this._listingActive.get(listingId);

        const writer: BytesWriter = new BytesWriter(161);
        writer.writeAddress(collection);
        writer.writeU256(tokenId);
        writer.writeAddress(seller);
        writer.writeU256(price);
        writer.writeU256(sellerTweakedKeyVal);
        writer.writeBoolean(active == LISTING_ACTIVE);
        return writer;
    }

    @view
    @method()
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    public listingCount(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._listingCount.value);
        return writer;
    }

    @view
    @method({ name: 'collection', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'approved', type: ABIDataTypes.BOOL })
    public isCollectionApproved(calldata: Calldata): BytesWriter {
        const collection: Address = calldata.readAddress();
        const approved: u256 = this._approvedCollections.get(collection);

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(approved == u256.One);
        return writer;
    }

    @view
    @method()
    @returns({ name: 'numerator', type: ABIDataTypes.UINT256 })
    public platformFeeNumerator(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._platformFeeNumerator.value);
        return writer;
    }

    @view
    @method()
    @returns({ name: 'admin', type: ABIDataTypes.ADDRESS })
    public admin(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeAddress(this._admin.value);
        return writer;
    }

    @view
    @method()
    @returns({ name: 'treasury', type: ABIDataTypes.ADDRESS })
    public treasury(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeAddress(this._treasury.value);
        return writer;
    }

    @view
    @method()
    @returns({ name: 'tweakedKey', type: ABIDataTypes.UINT256 })
    public treasuryTweakedKey(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._treasuryTweakedKey.value);
        return writer;
    }

    // ── Admin methods ─────────────────────────────────────────────────

    @method(
        { name: 'newAdmin', type: ABIDataTypes.ADDRESS },
        { name: 'newAdminTweakedKey', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public transferAdmin(calldata: Calldata): BytesWriter {
        this.onlyAdmin();

        const newAdmin: Address = calldata.readAddress();
        const newAdminTweakedKey: u256 = calldata.readU256();

        if (newAdmin.isZero()) {
            throw new Revert('New admin cannot be zero address');
        }

        const previousAdmin: Address = this._admin.value;
        this._admin.value = newAdmin;
        this._adminTweakedKey.value = newAdminTweakedKey;

        this.emitEvent(new AdminTransferredEvent(previousAdmin, newAdmin));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    @method(
        { name: 'newTreasury', type: ABIDataTypes.ADDRESS },
        { name: 'newTreasuryTweakedKey', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setTreasury(calldata: Calldata): BytesWriter {
        this.onlyAdmin();

        const newTreasury: Address = calldata.readAddress();
        const newTreasuryTweakedKey: u256 = calldata.readU256();

        if (newTreasury.isZero()) {
            throw new Revert('Treasury cannot be zero address');
        }

        this._treasury.value = newTreasury;
        this._treasuryTweakedKey.value = newTreasuryTweakedKey;

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    @method({ name: 'newNumerator', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setPlatformFee(calldata: Calldata): BytesWriter {
        this.onlyAdmin();

        const newNumerator: u256 = calldata.readU256();
        if (newNumerator > MAX_FEE_NUMERATOR) {
            throw new Revert('Fee cannot exceed 10%');
        }

        this._platformFeeNumerator.value = newNumerator;

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ── Private helpers ───────────────────────────────────────────────

    private onlyAdmin(): void {
        if (!Blockchain.tx.sender.equals(this._admin.value)) {
            throw new Revert('Only admin can call this method');
        }
    }

    /**
     * Returns the correct bech32 HRP for the current network.
     * Workaround for btc-runtime bug: Network.hrp() returns 'opt1' for OPNet
     * testnet but the correct HRP is 'opt' (the '1' is the bech32 separator).
     */
    private _correctHrp(): string {
        const n: Networks = Blockchain.network;
        if (n === Networks.Mainnet) return 'bc';
        if (n === Networks.Testnet) return 'tb';
        if (n === Networks.Regtest) return 'bcrt';
        if (n === Networks.OpnetTestnet) return 'opt';
        return Network.hrp(n);
    }

    /**
     * Checks if a P2TR scriptPublicKey matches a 32-byte tweaked public key.
     * P2TR script format: OP_1 (0x51) PUSH32 (0x20) <32-byte-tweaked-key>
     */
    private _matchesP2TR(script: Uint8Array, tweakedKey: Uint8Array): bool {
        if (script.length != 34 || script[0] != 0x51 || script[1] != 0x20) {
            return false;
        }
        for (let i: i32 = 0; i < 32; i++) {
            if (script[i + 2] != tweakedKey[i]) return false;
        }
        return true;
    }

    /**
     * Verifies a BTC output exists paying at least `minValue` to a P2TR address.
     * Dual-check: output.to (simulation path) + scriptPublicKey (on-chain path).
     */
    private _verifyOutput(minValue: u256, tweakedKey: Uint8Array, p2trAddress: string): void {
        const outputs = Blockchain.tx.outputs;
        let found: bool = false;

        for (let i: i32 = 0; i < outputs.length; i++) {
            const output = outputs[i];
            if (u256.fromU64(output.value) < minValue) continue;

            // Check output.to (simulation path)
            const to: string | null = output.to;
            if (to !== null && to == p2trAddress) {
                found = true;
                break;
            }

            // Check scriptPublicKey (on-chain path)
            const script: Uint8Array | null = output.scriptPublicKey;
            if (script !== null && this._matchesP2TR(script, tweakedKey)) {
                found = true;
                break;
            }
        }

        if (!found) {
            throw new Revert('Required BTC output not found');
        }
    }
}
