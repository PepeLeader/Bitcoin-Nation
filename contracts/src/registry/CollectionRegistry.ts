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
    CollectionSubmittedEvent,
    CollectionApprovedEvent,
    CollectionRejectedEvent,
    AdminTransferredEvent,
    SubmissionFeeUpdatedEvent,
} from './Events';

const STATUS_NONE: u256 = u256.Zero;
const STATUS_PENDING: u256 = u256.One;
const STATUS_APPROVED: u256 = u256.fromU64(2);
const STATUS_REJECTED: u256 = u256.fromU64(3);

@final
export class CollectionRegistry extends ReentrancyGuard {
    protected readonly reentrancyLevel: ReentrancyLevel = ReentrancyLevel.STANDARD;

    private readonly adminPointer: u16 = Blockchain.nextPointer;
    private readonly adminTweakedKeyPointer: u16 = Blockchain.nextPointer;
    private readonly submissionFeePointer: u16 = Blockchain.nextPointer;
    private readonly submissionCountPointer: u16 = Blockchain.nextPointer;
    private readonly submissionByIndexPointer: u16 = Blockchain.nextPointer;
    private readonly submissionSubmitterPointer: u16 = Blockchain.nextPointer;
    private readonly approvalStatusPointer: u16 = Blockchain.nextPointer;

    private readonly _admin: StoredAddress = new StoredAddress(this.adminPointer);
    private readonly _adminTweakedKey: StoredU256 = new StoredU256(
        this.adminTweakedKeyPointer,
        EMPTY_POINTER,
    );
    private readonly _submissionFee: StoredU256 = new StoredU256(
        this.submissionFeePointer,
        EMPTY_POINTER,
    );
    private readonly _submissionCount: StoredU256 = new StoredU256(
        this.submissionCountPointer,
        EMPTY_POINTER,
    );
    private readonly _submissionByIndex: StoredMapU256 = new StoredMapU256(
        this.submissionByIndexPointer,
    );
    private readonly _submissionSubmitter: AddressMemoryMap = new AddressMemoryMap(
        this.submissionSubmitterPointer,
    );
    private readonly _approvalStatus: AddressMemoryMap = new AddressMemoryMap(
        this.approvalStatusPointer,
    );

    public constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const adminTweakedKey: u256 = calldata.readU256();

        this._admin.value = Blockchain.tx.sender;
        this._submissionFee.value = u256.fromU64(10000);
        this._adminTweakedKey.value = adminTweakedKey;
    }

    /**
     * Submit an externally-deployed OP-721 collection for listing.
     * Requires a submission fee output to admin address.
     * The collection must not already be registered.
     */
    @payable
    @method({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('CollectionSubmitted')
    public submitCollection(calldata: Calldata): BytesWriter {
        const collectionAddress: Address = calldata.readAddress();
        const sender: Address = Blockchain.tx.sender;

        // Ensure collection is not already registered
        const existingSubmitter: u256 = this._submissionSubmitter.get(collectionAddress);
        if (existingSubmitter != u256.Zero) {
            throw new Revert('Collection already submitted');
        }

        // Verify submission fee payment
        const fee: u256 = this._submissionFee.value;
        if (fee > u256.Zero) {
            const adminTweakedBytes: Uint8Array = this._adminTweakedKey.value.toUint8Array(true);
            const hrp: string = this._correctHrp();
            const adminP2tr: string = Segwit.p2tr(hrp, adminTweakedBytes);
            let feePaid: bool = false;

            const outputs = Blockchain.tx.outputs;
            for (let i: i32 = 0; i < outputs.length; i++) {
                const output = outputs[i];
                if (u256.fromU64(output.value) < fee) continue;

                const to: string | null = output.to;
                if (to !== null && to == adminP2tr) {
                    feePaid = true;
                    break;
                }

                const script: Uint8Array | null = output.scriptPublicKey;
                if (script !== null && this._matchesP2TR(script, adminTweakedBytes)) {
                    feePaid = true;
                    break;
                }
            }

            if (!feePaid) {
                throw new Revert('Submission fee not paid');
            }
        }

        // Register the submission
        const currentIndex: u256 = this._submissionCount.value;
        this._submissionByIndex.set(currentIndex, u256.fromUint8ArrayBE(collectionAddress));
        this._submissionSubmitter.set(collectionAddress, u256.fromUint8ArrayBE(sender));
        this._submissionCount.value = SafeMath.add(currentIndex, u256.One);
        this._approvalStatus.set(collectionAddress, STATUS_PENDING);

        this.emitEvent(new CollectionSubmittedEvent(sender, collectionAddress));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * Admin approves a submitted collection.
     */
    @method({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('SubmissionApproved')
    public approveSubmission(calldata: Calldata): BytesWriter {
        this.onlyAdmin();

        const collectionAddress: Address = calldata.readAddress();
        const status: u256 = this._approvalStatus.get(collectionAddress);

        if (status != STATUS_PENDING) {
            throw new Revert('Collection is not pending');
        }

        this._approvalStatus.set(collectionAddress, STATUS_APPROVED);
        this.emitEvent(new CollectionApprovedEvent(collectionAddress));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * Admin rejects a submitted collection.
     */
    @method({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('SubmissionRejected')
    public rejectSubmission(calldata: Calldata): BytesWriter {
        this.onlyAdmin();

        const collectionAddress: Address = calldata.readAddress();
        const status: u256 = this._approvalStatus.get(collectionAddress);

        if (status != STATUS_PENDING) {
            throw new Revert('Collection is not pending');
        }

        this._approvalStatus.set(collectionAddress, STATUS_REJECTED);
        this.emitEvent(new CollectionRejectedEvent(collectionAddress));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * Returns the total number of submitted collections.
     */
    @view
    @method()
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    public submissionCount(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._submissionCount.value);
        return writer;
    }

    /**
     * Returns the collection address at the given index.
     */
    @view
    @method({ name: 'index', type: ABIDataTypes.UINT256 })
    @returns({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    public submissionAtIndex(calldata: Calldata): BytesWriter {
        const index: u256 = calldata.readU256();
        const count: u256 = this._submissionCount.value;

        if (index >= count) {
            throw new Revert('Index out of bounds');
        }

        const addressAsU256: u256 = this._submissionByIndex.get(index);
        const collectionAddress: Address = Address.fromUint8Array(addressAsU256.toUint8Array(true));

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeAddress(collectionAddress);
        return writer;
    }

    /**
     * Returns the approval status of a submitted collection.
     * 0=none, 1=pending, 2=approved, 3=rejected
     */
    @view
    @method({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'status', type: ABIDataTypes.UINT256 })
    public submissionStatus(calldata: Calldata): BytesWriter {
        const collectionAddress: Address = calldata.readAddress();
        const status: u256 = this._approvalStatus.get(collectionAddress);

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(status);
        return writer;
    }

    /**
     * Returns the submitter address for a collection.
     */
    @view
    @method({ name: 'collectionAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'submitter', type: ABIDataTypes.ADDRESS })
    public submissionSubmitter(calldata: Calldata): BytesWriter {
        const collectionAddress: Address = calldata.readAddress();
        const submitterAsU256: u256 = this._submissionSubmitter.get(collectionAddress);
        const submitter: Address = Address.fromUint8Array(submitterAsU256.toUint8Array(true));

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeAddress(submitter);
        return writer;
    }

    /**
     * Returns the submission fee in satoshis.
     */
    @view
    @method()
    @returns({ name: 'fee', type: ABIDataTypes.UINT256 })
    public submissionFee(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._submissionFee.value);
        return writer;
    }

    /**
     * Updates the submission fee. Admin only.
     */
    @method({ name: 'newFee', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('SubmissionFeeUpdated')
    public setSubmissionFee(calldata: Calldata): BytesWriter {
        this.onlyAdmin();

        const newFee: u256 = calldata.readU256();
        this._submissionFee.value = newFee;

        this.emitEvent(new SubmissionFeeUpdatedEvent(newFee));

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
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
     * Returns the admin's tweaked public key.
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

    private onlyAdmin(): void {
        if (!Blockchain.tx.sender.equals(this._admin.value)) {
            throw new Revert('Only admin can call this method');
        }
    }

    private _correctHrp(): string {
        const n: Networks = Blockchain.network;
        if (n === Networks.Mainnet) return 'bc';
        if (n === Networks.Testnet) return 'tb';
        if (n === Networks.Regtest) return 'bcrt';
        if (n === Networks.OpnetTestnet) return 'opt';
        return Network.hrp(n);
    }

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
