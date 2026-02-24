export interface CollectionInfo {
    readonly address: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
    readonly banner: string;
    readonly description: string;
    readonly website: string;
    readonly totalSupply: bigint;
    readonly maxSupply: bigint;
    readonly mintPrice: bigint;
    readonly maxPerWallet: bigint;
    readonly availableSupply: bigint;
    readonly isMintingOpen: boolean;
    readonly approvalStatus: number;
}

export interface NFTMetadata {
    readonly name: string;
    readonly description: string;
    readonly image: string;
    readonly attributes?: readonly NFTAttribute[];
}

export interface NFTAttribute {
    readonly trait_type: string;
    readonly value: string | number;
}

export interface NFTItem {
    readonly tokenId: bigint;
    readonly owner: string;
    readonly uri: string;
    readonly metadata?: NFTMetadata;
    readonly collectionAddress: string;
}

export interface NFTImageFile {
    readonly id: string;
    readonly file: File;
    readonly preview: string;
    readonly name: string;
}

export type UploadPhase = 'idle' | 'uploading-images' | 'uploading-metadata' | 'done' | 'error' | 'cancelled';

export interface CollectionUploadState {
    readonly phase: UploadPhase;
    readonly imageProgress: { readonly completed: number; readonly total: number };
    readonly metadataProgress: { readonly completed: number; readonly total: number };
    readonly baseURI: string;
    readonly error: string;
    readonly failedItems: readonly FailedUploadItem[];
}

export interface FailedUploadItem {
    readonly index: number;
    readonly name: string;
    readonly error: string;
}
