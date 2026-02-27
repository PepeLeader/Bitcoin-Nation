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
    CollectionCreatedEvent,
    CollectionApprovedEvent,
    CollectionRejectedEvent,
    AdminTransferredEvent,
    CreationFeeUpdatedEvent,
} from '../interfaces/Events';

const STATUS_NONE: u256 = u256.Zero;
const STATUS_PENDING: u256 = u256.One;
const STATUS_APPROVED: u256 = u256.fromU64(2);
const STATUS_REJECTED: u256 = u256.fromU64(3);

const MAX_SUPPLY_CAP: u256 = u256.fromU64(100_000);

@final
export class BitcoinNationFactory extends ReentrancyGuard {
    protected readonly reentrancyLevel: ReentrancyLevel = ReentrancyLevel.STANDARD;

    private readonly templatePointer: u16 = Blockchain.nextPointer;
    private readonly collectionCountPointer: u16 = Blockchain.nextPointer;
    private readonly collectionByIndexPointer: u16 = Blockchain.nextPointer;
    private readonly adminPointer: u16 = Blockchain.nextPointer;
    private readonly approvalStatusPointer: u16 = Blockchain.nextPointer;
    private readonly collectionCreatorPointer: u16 = Blockchain.nextPointer;
    private readonly creationFeePointer: u16 = Blockchain.nextPointer;
    private readonly adminTweakedKeyPointer: u16 = Blockchain.nextPointer;

    private readonly _template: StoredAddress = new StoredAddress(this.templatePointer);
    private readonly _collectionCount: StoredU256 = new StoredU256(
        this.collectionCountPointer,
        EMPTY_POINTER,
    );
    private readonly _collectionByIndex: StoredMapU256 = new StoredMapU256(
        this.collectionByIndexPointer,
    );
    private readonly _admin: StoredAddress = new StoredAddress(this.adminPointer);
    private readonly _approvalStatus: AddressMemoryMap = new AddressMemoryMap(
        this.approvalStatusPointer,
    );
    private readonly _collectionCreator: AddressMemoryMap = new AddressMemoryMap(
        this.collectionCreatorPointer,
    );
    private readonly _creationFee: StoredU256 = new StoredU256(
        this.creationFeePointer,
        EMPTY_POINTER,
    );
    private readonly _adminTweakedKey: StoredU256 = new StoredU256(
        this.adminTweakedKeyPointer,
        EMPTY_POINTER,
    );

    public constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const templateAddress: Address = calldata.readAddress();
        const adminTweakedKey: u256 = calldata.readU256();

        this._template.value = templateAddress;
        this._admin.value = Blockchain.tx.sender;
        this._creationFee.value = u256.fromU64(100000);
        this._adminTweakedKey.value = adminTweakedKey;
    }

    /**
     * Deploys a new NFT collection from the template contract.
     * Requires a creation fee output to admin address.
     * Returns the new collection's address.
     */
    @payable
    @method(
        { name: 'name', type: ABIDataTypes.STRING },
        { name: 'symbol', type: ABIDataTypes.STRING },
        { name: 'baseURI', type: ABIDataTypes.STRING },
        { name: 'maxSupply', type: ABIDataTypes.UINT256 },
        { name: 'mintPrice', type: ABIDataTypes.UINT256 },
        { name: 'maxPerWallet', type: ABIDataTypes.UINT256 },
        { name: 'collectionBanner', type: ABIDataTypes.STRING },
        { name: 'collectionIcon', type: ABIDataTypes.STRING },
        { name: 'collectionWebsite', type: ABIDataTypes.STRING },
        { name: 'collectionDescription', type: ABIDataTypes.STRING },
        { name: 'ownerTweakedKey', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    @emit('CollectionCreated')
    public createCollection(calldata: Calldata): BytesWriter {
        const sender: Address = Blockchain.tx.sender;
        const templateAddress: Address = this._template.value;

        if (templateAddress.isZero()) {
            throw new Revert('Template not set');
        }

        // Verify creation fee payment (dual-check: simulation uses output.to, on-chain uses scriptPublicKey)
        const fee: u256 = this._creationFee.value;
        if (fee > u256.Zero) {
            const adminTweakedBytes: Uint8Array = this._adminTweakedKey.value.toUint8Array(true);
            const hrp: string = this._correctHrp();
            const adminP2tr: string = Segwit.p2tr(hrp, adminTweakedBytes);
            let feePaid: bool = false;

            const outputs = Blockchain.tx.outputs;
            for (let i: i32 = 0; i < outputs.length; i++) {
                const output = outputs[i];
                if (u256.fromU64(output.value) < fee) continue;

                // Check output.to (simulation path: hasTo flag)
                const to: string | null = output.to;
                if (to !== null && to == adminP2tr) {
                    feePaid = true;
                    break;
                }

                // Check scriptPublicKey (on-chain path: hasScriptPubKey flag)
                const script: Uint8Array | null = output.scriptPublicKey;
                if (script !== null && this._matchesP2TR(script, adminTweakedBytes)) {
                    feePaid = true;
                    break;
                }
            }

            if (!feePaid) {
                throw new Revert('Creation fee not paid');
            }
        }

        const name: string = calldata.readStringWithLength();
        const symbol: string = calldata.readStringWithLength();
        const baseURI: string = calldata.readStringWithLength();
        const maxSupply: u256 = calldata.readU256();
        const mintPrice: u256 = calldata.readU256();
        const maxPerWallet: u256 = calldata.readU256();
        const collectionBanner: string = calldata.readStringWithLength();
        const collectionIcon: string = calldata.readStringWithLength();
        const collectionWebsite: string = calldata.readStringWithLength();
        const collectionDescription: string = calldata.readStringWithLength();
        const ownerTweakedKey: u256 = calldata.readU256();

        // M-02: Validate max supply cap
        if (maxSupply > u256.Zero && maxSupply > MAX_SUPPLY_CAP) {
            throw new Revert('Max supply exceeds platform cap');
        }

        const adminAddress: Address = this._admin.value;

        const deployCalldata: BytesWriter = new BytesWriter(1024);
        deployCalldata.writeStringWithLength(name);
        deployCalldata.writeStringWithLength(symbol);
        deployCalldata.writeStringWithLength(baseURI);
        deployCalldata.writeU256(maxSupply);
        deployCalldata.writeU256(mintPrice);
        deployCalldata.writeU256(maxPerWallet);
        deployCalldata.writeStringWithLength(collectionBanner);
        deployCalldata.writeStringWithLength(collectionIcon);
        deployCalldata.writeStringWithLength(collectionWebsite);
        deployCalldata.writeStringWithLength(collectionDescription);
        deployCalldata.writeAddress(adminAddress);
        deployCalldata.writeU256(this._adminTweakedKey.value);
        deployCalldata.writeAddress(sender);
        deployCalldata.writeU256(ownerTweakedKey);

        const currentIndex: u256 = this._collectionCount.value;
        const saltInput: BytesWriter = new BytesWriter(64);
        saltInput.writeAddress(sender);
        saltInput.writeU256(currentIndex);
        const saltHash: Uint8Array = Blockchain.sha256(saltInput.getBuffer());
        const salt: u256 = u256.fromUint8ArrayBE(saltHash);

        const newCollectionAddress: Address = Blockchain.deployContractFromExisting(
            templateAddress,
            salt,
            deployCalldata,
        );

        this._collectionByIndex.set(currentIndex, u256.fromUint8ArrayBE(newCollectionAddress));
        this._collectionCreator.set(newCollectionAddress, u256.fromUint8ArrayBE(sender));
        this._collectionCount.value = SafeMath.add(currentIndex, u256.One);

        this.emitEvent(new CollectionCreatedEvent(sender, newCollectionAddress, currentIndex));

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeAddress(newCollectionAddress);
        return writer;
    }

    /**
     * Returns the total number of deployed collections.
     */
    @view
    @method()
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    public collectionCount(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._collectionCount.value);
        return writer;
    }

    /**
     * Returns the collection address at the given index.
     */
    @view
    @method({ name: 'index', type: ABIDataTypes.UINT256 })
    @returns({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    public collectionAtIndex(calldata: Calldata): BytesWriter {
        const index: u256 = calldata.readU256();
        const count: u256 = this._collectionCount.value;

        if (index >= count) {
            throw new Revert('Index out of bounds');
        }

        const addressAsU256: u256 = this._collectionByIndex.get(index);
        const collectionAddress: Address = Address.fromUint8Array(addressAsU256.toUint8Array(true));

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeAddress(collectionAddress);
        return writer;
    }

    /**
     * Creator applies for minting approval on their collection.
     * Allowed when status is 0 (none) or 3 (rejected, re-apply).
     */
    @method({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public applyForMint(calldata: Calldata): BytesWriter {
        const collectionAddress: Address = calldata.readAddress();
        const sender: Address = Blockchain.tx.sender;

        const creatorAsU256: u256 = this._collectionCreator.get(collectionAddress);
        const senderAsU256: u256 = u256.fromUint8ArrayBE(sender);

        if (creatorAsU256 != senderAsU256) {
            throw new Revert('Only creator can apply');
        }

        const currentStatus: u256 = this._approvalStatus.get(collectionAddress);

        if (currentStatus != STATUS_NONE && currentStatus != STATUS_REJECTED) {
            throw new Revert('Cannot apply in current status');
        }

        this._approvalStatus.set(collectionAddress, STATUS_PENDING);

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * Admin approves a collection for minting visibility.
     */
    @method({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public approveCollection(calldata: Calldata): BytesWriter {
        this.onlyAdmin();

        const collectionAddress: Address = calldata.readAddress();
        this._approvalStatus.set(collectionAddress, STATUS_APPROVED);

        this.emitEvent(new CollectionApprovedEvent(collectionAddress));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * Admin rejects a collection's minting application.
     */
    @method({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public rejectCollection(calldata: Calldata): BytesWriter {
        this.onlyAdmin();

        const collectionAddress: Address = calldata.readAddress();
        this._approvalStatus.set(collectionAddress, STATUS_REJECTED);

        this.emitEvent(new CollectionRejectedEvent(collectionAddress));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * Returns the approval status of a collection.
     * 0=none, 1=pending, 2=approved, 3=rejected
     */
    @view
    @method({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'status', type: ABIDataTypes.UINT256 })
    public approvalStatus(calldata: Calldata): BytesWriter {
        const collectionAddress: Address = calldata.readAddress();
        const status: u256 = this._approvalStatus.get(collectionAddress);

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(status);
        return writer;
    }

    /**
     * Returns the creator address of a collection.
     */
    @view
    @method({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'creator', type: ABIDataTypes.ADDRESS })
    public collectionCreator(calldata: Calldata): BytesWriter {
        const collectionAddress: Address = calldata.readAddress();
        const creatorAsU256: u256 = this._collectionCreator.get(collectionAddress);
        const creator: Address = Address.fromUint8Array(creatorAsU256.toUint8Array(true));

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeAddress(creator);
        return writer;
    }

    /**
     * Returns the admin address.
     */
    @view
    @method()
    @returns({ name: 'admin', type: ABIDataTypes.ADDRESS })
    public admin(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeAddress(this._admin.value);
        return writer;
    }

    /**
     * Returns the creation fee in satoshis.
     */
    @view
    @method()
    @returns({ name: 'fee', type: ABIDataTypes.UINT256 })
    public creationFee(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._creationFee.value);
        return writer;
    }

    /**
     * Returns the admin's tweaked public key (for P2TR output verification).
     */
    @view
    @method()
    @returns({ name: 'tweakedKey', type: ABIDataTypes.UINT256 })
    public adminTweakedKey(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._adminTweakedKey.value);
        return writer;
    }

    /**
     * Transfers admin role to a new address. Admin only.
     */
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

    /**
     * Updates the creation fee. Admin only.
     */
    @method({ name: 'newFee', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setCreationFee(calldata: Calldata): BytesWriter {
        this.onlyAdmin();

        const newFee: u256 = calldata.readU256();
        this._creationFee.value = newFee;

        this.emitEvent(new CreationFeeUpdatedEvent(newFee));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

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
}
