import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type CollectionCreatedEvent = {
    readonly creator: Address;
    readonly collectionAddress: Address;
    readonly collectionIndex: bigint;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the createCollection function call.
 */
export type CreateCollection = CallResult<
    {
        collectionAddress: Address;
    },
    OPNetEvent<CollectionCreatedEvent>[]
>;

/**
 * @description Represents the result of the collectionCount function call.
 */
export type CollectionCount = CallResult<
    {
        count: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the collectionAtIndex function call.
 */
export type CollectionAtIndex = CallResult<
    {
        collectionAddress: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the applyForMint function call.
 */
export type ApplyForMint = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the approveCollection function call.
 */
export type ApproveCollection = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the rejectCollection function call.
 */
export type RejectCollection = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the approvalStatus function call.
 */
export type ApprovalStatus = CallResult<
    {
        status: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the collectionCreator function call.
 */
export type CollectionCreator = CallResult<
    {
        creator: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the admin function call.
 */
export type Admin = CallResult<
    {
        admin: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the creationFee function call.
 */
export type CreationFee = CallResult<
    {
        fee: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the adminTweakedKey function call.
 */
export type AdminTweakedKey = CallResult<
    {
        tweakedKey: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the transferAdmin function call.
 */
export type TransferAdmin = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setCreationFee function call.
 */
export type SetCreationFee = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IBitcoinNationFactory
// ------------------------------------------------------------------
export interface IBitcoinNationFactory extends IOP_NETContract {
    createCollection(
        name: string,
        symbol: string,
        baseURI: string,
        maxSupply: bigint,
        mintPrice: bigint,
        maxPerWallet: bigint,
        collectionBanner: string,
        collectionIcon: string,
        collectionWebsite: string,
        collectionDescription: string,
        ownerTweakedKey: bigint,
    ): Promise<CreateCollection>;
    collectionCount(): Promise<CollectionCount>;
    collectionAtIndex(index: bigint): Promise<CollectionAtIndex>;
    applyForMint(collectionAddress: Address): Promise<ApplyForMint>;
    approveCollection(collectionAddress: Address): Promise<ApproveCollection>;
    rejectCollection(collectionAddress: Address): Promise<RejectCollection>;
    approvalStatus(collectionAddress: Address): Promise<ApprovalStatus>;
    collectionCreator(collectionAddress: Address): Promise<CollectionCreator>;
    admin(): Promise<Admin>;
    creationFee(): Promise<CreationFee>;
    adminTweakedKey(): Promise<AdminTweakedKey>;
    transferAdmin(newAdmin: Address, newAdminTweakedKey: bigint): Promise<TransferAdmin>;
    setCreationFee(newFee: bigint): Promise<SetCreationFee>;
}
