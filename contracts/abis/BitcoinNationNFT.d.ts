import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type TransferredEvent = {
    readonly operator: Address;
    readonly from: Address;
    readonly to: Address;
    readonly amount: bigint;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the ownerMint function call.
 */
export type OwnerMint = CallResult<
    {
        tokenId: bigint;
    },
    OPNetEvent<TransferredEvent>[]
>;

/**
 * @description Represents the result of the mint function call.
 */
export type Mint = CallResult<
    {
        firstTokenId: bigint;
    },
    OPNetEvent<TransferredEvent>[]
>;

/**
 * @description Represents the result of the mintWithURI function call.
 */
export type MintWithURI = CallResult<
    {
        tokenId: bigint;
    },
    OPNetEvent<TransferredEvent>[]
>;

/**
 * @description Represents the result of the setMintingOpen function call.
 */
export type SetMintingOpen = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the mintPrice function call.
 */
export type MintPrice = CallResult<
    {
        price: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the maxPerWallet function call.
 */
export type MaxPerWallet = CallResult<
    {
        maxPerWallet: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the isMintingOpen function call.
 */
export type IsMintingOpen = CallResult<
    {
        isOpen: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the owner function call.
 */
export type Owner = CallResult<
    {
        owner: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the transferOwnership function call.
 */
export type TransferOwnership = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setMintPrice function call.
 */
export type SetMintPrice = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setPlatformFeePercent function call.
 */
export type SetPlatformFeePercent = CallResult<
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
 * @description Represents the result of the mintedBy function call.
 */
export type MintedBy = CallResult<
    {
        count: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the availableSupply function call.
 */
export type AvailableSupply = CallResult<
    {
        available: bigint;
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
 * @description Represents the result of the ownerTweakedKey function call.
 */
export type OwnerTweakedKey = CallResult<
    {
        tweakedKey: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IBitcoinNationNFT
// ------------------------------------------------------------------
export interface IBitcoinNationNFT extends IOP_NETContract {
    ownerMint(to: Address): Promise<OwnerMint>;
    mint(quantity: bigint): Promise<Mint>;
    mintWithURI(to: Address, uri: string): Promise<MintWithURI>;
    setMintingOpen(open: boolean): Promise<SetMintingOpen>;
    mintPrice(): Promise<MintPrice>;
    maxPerWallet(): Promise<MaxPerWallet>;
    isMintingOpen(): Promise<IsMintingOpen>;
    owner(): Promise<Owner>;
    transferOwnership(newOwner: Address, newOwnerTweakedKey: bigint): Promise<TransferOwnership>;
    setMintPrice(newPrice: bigint): Promise<SetMintPrice>;
    setPlatformFeePercent(newPercent: bigint): Promise<SetPlatformFeePercent>;
    setTreasury(newTreasury: Address, newTreasuryTweakedKey: bigint): Promise<SetTreasury>;
    mintedBy(account: Address): Promise<MintedBy>;
    availableSupply(): Promise<AvailableSupply>;
    treasury(): Promise<Treasury>;
    treasuryTweakedKey(): Promise<TreasuryTweakedKey>;
    ownerTweakedKey(): Promise<OwnerTweakedKey>;
}
