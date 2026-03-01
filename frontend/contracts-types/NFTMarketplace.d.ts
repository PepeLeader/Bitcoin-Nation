import { Address } from '@btc-vision/transaction';
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

export type ApproveCollectionResult = CallResult<
    { success: boolean },
    OPNetEvent<never>[]
>;

export type RevokeCollectionResult = CallResult<
    { success: boolean },
    OPNetEvent<never>[]
>;

export type ListResult = CallResult<
    { listingId: bigint },
    OPNetEvent<NFTListedEvent>[]
>;

export type DelistResult = CallResult<
    { success: boolean },
    OPNetEvent<never>[]
>;

export type BuyResult = CallResult<
    { success: boolean },
    OPNetEvent<NFTSoldEvent>[]
>;

export type GetListingResult = CallResult<
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

export type ListingCountResult = CallResult<
    { count: bigint },
    OPNetEvent<never>[]
>;

export type IsCollectionApprovedResult = CallResult<
    { approved: boolean },
    OPNetEvent<never>[]
>;

export type PlatformFeeNumeratorResult = CallResult<
    { numerator: bigint },
    OPNetEvent<never>[]
>;

export type MarketplaceAdminResult = CallResult<
    { admin: Address },
    OPNetEvent<never>[]
>;

export type MarketplaceTreasuryResult = CallResult<
    { treasury: Address },
    OPNetEvent<never>[]
>;

export type MarketplaceTreasuryTweakedKeyResult = CallResult<
    { tweakedKey: bigint },
    OPNetEvent<never>[]
>;

export type MarketplaceTransferAdminResult = CallResult<
    { success: boolean },
    OPNetEvent<never>[]
>;

export type SetTreasuryResult = CallResult<
    { success: boolean },
    OPNetEvent<never>[]
>;

export type SetPlatformFeeResult = CallResult<
    { success: boolean },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// INFTMarketplace
// ------------------------------------------------------------------
export interface INFTMarketplace extends IOP_NETContract {
    // Collection approval
    approveCollection(collection: Address): Promise<ApproveCollectionResult>;
    revokeCollection(collection: Address): Promise<RevokeCollectionResult>;

    // Listing management
    list(
        collection: Address,
        tokenId: bigint,
        price: bigint,
        sellerTweakedKey: bigint,
    ): Promise<ListResult>;
    delist(listingId: bigint): Promise<DelistResult>;
    buy(listingId: bigint): Promise<BuyResult>;

    // View methods
    getListing(listingId: bigint): Promise<GetListingResult>;
    listingCount(): Promise<ListingCountResult>;
    isCollectionApproved(collection: Address): Promise<IsCollectionApprovedResult>;
    platformFeeNumerator(): Promise<PlatformFeeNumeratorResult>;
    admin(): Promise<MarketplaceAdminResult>;
    treasury(): Promise<MarketplaceTreasuryResult>;
    treasuryTweakedKey(): Promise<MarketplaceTreasuryTweakedKeyResult>;

    // Admin methods
    transferAdmin(newAdmin: Address, newAdminTweakedKey: bigint): Promise<MarketplaceTransferAdminResult>;
    setTreasury(newTreasury: Address, newTreasuryTweakedKey: bigint): Promise<SetTreasuryResult>;
    setPlatformFee(newNumerator: bigint): Promise<SetPlatformFeeResult>;
}
