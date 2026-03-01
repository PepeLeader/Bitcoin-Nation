import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type NFTListedEvent = {
    readonly seller: Address;
    readonly collection: Address;
    readonly tokenId: bigint;
    readonly price: bigint;
    readonly listingId: bigint;
};
export type NFTDelistedEvent = {
    readonly seller: Address;
    readonly listingId: bigint;
};
export type NFTSoldEvent = {
    readonly buyer: Address;
    readonly seller: Address;
    readonly collection: Address;
    readonly tokenId: bigint;
    readonly price: bigint;
    readonly listingId: bigint;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

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
 * @description Represents the result of the revokeCollection function call.
 */
export type RevokeCollection = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the list function call.
 */
export type List = CallResult<
    {
        listingId: bigint;
    },
    OPNetEvent<NFTListedEvent>[]
>;

/**
 * @description Represents the result of the delist function call.
 */
export type Delist = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<NFTDelistedEvent>[]
>;

/**
 * @description Represents the result of the buy function call.
 */
export type Buy = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<NFTSoldEvent>[]
>;

/**
 * @description Represents the result of the getListing function call.
 */
export type GetListing = CallResult<
    {
        collection: Address;
        tokenId: bigint;
        seller: Address;
        price: bigint;
        sellerTweakedKey: bigint;
        active: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the listingCount function call.
 */
export type ListingCount = CallResult<
    {
        count: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the isCollectionApproved function call.
 */
export type IsCollectionApproved = CallResult<
    {
        approved: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the platformFeeNumerator function call.
 */
export type PlatformFeeNumerator = CallResult<
    {
        numerator: bigint;
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
 * @description Represents the result of the treasury function call.
 */
export type Treasury = CallResult<
    {
        treasury: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the treasuryTweakedKey function call.
 */
export type TreasuryTweakedKey = CallResult<
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
 * @description Represents the result of the setTreasury function call.
 */
export type SetTreasury = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setPlatformFee function call.
 */
export type SetPlatformFee = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// INFTMarketplace
// ------------------------------------------------------------------
export interface INFTMarketplace extends IOP_NETContract {
    approveCollection(collection: Address): Promise<ApproveCollection>;
    revokeCollection(collection: Address): Promise<RevokeCollection>;
    list(collection: Address, tokenId: bigint, price: bigint, sellerTweakedKey: bigint): Promise<List>;
    delist(listingId: bigint): Promise<Delist>;
    buy(listingId: bigint): Promise<Buy>;
    getListing(listingId: bigint): Promise<GetListing>;
    listingCount(): Promise<ListingCount>;
    isCollectionApproved(collection: Address): Promise<IsCollectionApproved>;
    platformFeeNumerator(): Promise<PlatformFeeNumerator>;
    admin(): Promise<Admin>;
    treasury(): Promise<Treasury>;
    treasuryTweakedKey(): Promise<TreasuryTweakedKey>;
    transferAdmin(newAdmin: Address, newAdminTweakedKey: bigint): Promise<TransferAdmin>;
    setTreasury(newTreasury: Address, newTreasuryTweakedKey: bigint): Promise<SetTreasury>;
    setPlatformFee(newNumerator: bigint): Promise<SetPlatformFee>;
}
