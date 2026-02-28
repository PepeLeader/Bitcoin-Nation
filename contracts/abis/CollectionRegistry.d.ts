import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type CollectionSubmittedEvent = {
    readonly submitter: Address;
    readonly collectionAddress: Address;
};
export type SubmissionApprovedEvent = {
    readonly collectionAddress: Address;
};
export type SubmissionRejectedEvent = {
    readonly collectionAddress: Address;
};
export type SubmissionFeeUpdatedEvent = {
    readonly newFee: bigint;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the submitCollection function call.
 */
export type SubmitCollection = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<CollectionSubmittedEvent>[]
>;

/**
 * @description Represents the result of the approveSubmission function call.
 */
export type ApproveSubmission = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<SubmissionApprovedEvent>[]
>;

/**
 * @description Represents the result of the rejectSubmission function call.
 */
export type RejectSubmission = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<SubmissionRejectedEvent>[]
>;

/**
 * @description Represents the result of the submissionCount function call.
 */
export type SubmissionCount = CallResult<
    {
        count: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the submissionAtIndex function call.
 */
export type SubmissionAtIndex = CallResult<
    {
        collectionAddress: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the submissionStatus function call.
 */
export type SubmissionStatus = CallResult<
    {
        status: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the submissionSubmitter function call.
 */
export type SubmissionSubmitter = CallResult<
    {
        submitter: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the submissionFee function call.
 */
export type SubmissionFee = CallResult<
    {
        fee: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setSubmissionFee function call.
 */
export type SetSubmissionFee = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<SubmissionFeeUpdatedEvent>[]
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

// ------------------------------------------------------------------
// ICollectionRegistry
// ------------------------------------------------------------------
export interface ICollectionRegistry extends IOP_NETContract {
    submitCollection(collectionAddress: Address): Promise<SubmitCollection>;
    approveSubmission(collectionAddress: Address): Promise<ApproveSubmission>;
    rejectSubmission(collectionAddress: Address): Promise<RejectSubmission>;
    submissionCount(): Promise<SubmissionCount>;
    submissionAtIndex(index: bigint): Promise<SubmissionAtIndex>;
    submissionStatus(collectionAddress: Address): Promise<SubmissionStatus>;
    submissionSubmitter(collectionAddress: Address): Promise<SubmissionSubmitter>;
    submissionFee(): Promise<SubmissionFee>;
    setSubmissionFee(newFee: bigint): Promise<SetSubmissionFee>;
    admin(): Promise<Admin>;
    adminTweakedKey(): Promise<AdminTweakedKey>;
    transferAdmin(newAdmin: Address, newAdminTweakedKey: bigint): Promise<TransferAdmin>;
}
