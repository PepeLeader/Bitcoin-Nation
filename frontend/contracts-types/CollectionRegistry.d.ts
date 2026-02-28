import { Address } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type CollectionSubmittedEvent = {
    readonly submitter: Address;
    readonly collectionAddress: Address;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

export type SubmitCollection = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<CollectionSubmittedEvent>[]
>;

export type ApproveSubmission = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

export type RejectSubmission = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

export type SubmissionCount = CallResult<
    {
        count: bigint;
    },
    OPNetEvent<never>[]
>;

export type SubmissionAtIndex = CallResult<
    {
        collectionAddress: Address;
    },
    OPNetEvent<never>[]
>;

export type SubmissionStatus = CallResult<
    {
        status: bigint;
    },
    OPNetEvent<never>[]
>;

export type SubmissionSubmitter = CallResult<
    {
        submitter: Address;
    },
    OPNetEvent<never>[]
>;

export type SubmissionFeeResult = CallResult<
    {
        fee: bigint;
    },
    OPNetEvent<never>[]
>;

export type SetSubmissionFee = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

export type RegistryAdminResult = CallResult<
    {
        admin: Address;
    },
    OPNetEvent<never>[]
>;

export type RegistryAdminTweakedKey = CallResult<
    {
        tweakedKey: bigint;
    },
    OPNetEvent<never>[]
>;

export type RegistryTransferAdmin = CallResult<
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
    submissionFee(): Promise<SubmissionFeeResult>;
    setSubmissionFee(newFee: bigint): Promise<SetSubmissionFee>;
    admin(): Promise<RegistryAdminResult>;
    adminTweakedKey(): Promise<RegistryAdminTweakedKey>;
    transferAdmin(newAdmin: Address, newAdminTweakedKey: bigint): Promise<RegistryTransferAdmin>;
}
