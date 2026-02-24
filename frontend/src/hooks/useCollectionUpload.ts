import { useState, useRef, useCallback } from 'react';
import { ipfsService } from '../services/IPFSService';
import type { NFTImageFile, CollectionUploadState, FailedUploadItem } from '../types/nft';

const BATCH_SIZE = 3;

const INITIAL_STATE: CollectionUploadState = {
    phase: 'idle',
    imageProgress: { completed: 0, total: 0 },
    metadataProgress: { completed: 0, total: 0 },
    baseURI: '',
    error: '',
    failedItems: [],
};

async function uploadBatch(
    items: readonly NFTImageFile[],
    signal: AbortSignal,
    onProgress: (completed: number) => void,
): Promise<{ cids: Map<number, string>; failed: FailedUploadItem[] }> {
    const cids = new Map<number, string>();
    const failed: FailedUploadItem[] = [];
    let completed = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const batch = items.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(async (item, batchIdx) => {
                const idx = i + batchIdx;
                const result = await ipfsService.uploadFileWithSignal(item.file, signal);
                return { idx, cid: result.cid };
            }),
        );

        for (const [j, result] of results.entries()) {
            const idx = i + j;
            if (result.status === 'fulfilled') {
                cids.set(idx, result.value.cid);
            } else {
                const errMsg = result.reason instanceof Error ? result.reason.message : 'Upload failed';
                const item = items[idx];
                failed.push({ index: idx, name: item?.name ?? `Image ${idx}`, error: errMsg });
            }
            completed++;
            onProgress(completed);
        }
    }

    return { cids, failed };
}

interface UseCollectionUploadReturn {
    readonly state: CollectionUploadState;
    readonly startUpload: (
        images: readonly NFTImageFile[],
        collectionName: string,
        collectionDescription: string,
    ) => Promise<string>;
    readonly cancel: () => void;
    readonly reset: () => void;
}

export function useCollectionUpload(): UseCollectionUploadReturn {
    const [state, setState] = useState<CollectionUploadState>(INITIAL_STATE);
    const abortRef = useRef<AbortController | null>(null);

    const cancel = useCallback(() => {
        abortRef.current?.abort();
        setState((s) => ({ ...s, phase: 'cancelled', error: 'Upload cancelled' }));
    }, []);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setState(INITIAL_STATE);
    }, []);

    const startUpload = useCallback(
        async (
            images: readonly NFTImageFile[],
            collectionName: string,
            collectionDescription: string,
        ): Promise<string> => {
            const controller = new AbortController();
            abortRef.current = controller;
            const { signal } = controller;

            const total = images.length;

            try {
                // Phase 1: Upload images
                setState({
                    ...INITIAL_STATE,
                    phase: 'uploading-images',
                    imageProgress: { completed: 0, total },
                    metadataProgress: { completed: 0, total },
                });

                const { cids: imageCids, failed } = await uploadBatch(images, signal, (completed) => {
                    setState((s) => ({
                        ...s,
                        imageProgress: { completed, total },
                    }));
                });

                if (failed.length > 0) {
                    setState((s) => ({
                        ...s,
                        phase: 'error',
                        error: `${failed.length} image(s) failed to upload`,
                        failedItems: failed,
                    }));
                    throw new Error(`${failed.length} image(s) failed to upload`);
                }

                // Phase 2+3: Generate metadata and upload as directory
                setState((s) => ({
                    ...s,
                    phase: 'uploading-metadata',
                    metadataProgress: { completed: 0, total },
                }));

                const metadataFiles: { name: string; content: Blob }[] = [];
                for (let i = 0; i < total; i++) {
                    const tokenId = i + 1; // 1-based
                    const metadata = {
                        name: `${collectionName} #${tokenId}`,
                        description: collectionDescription,
                        image: `ipfs://${imageCids.get(i)}`,
                    };
                    const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
                    metadataFiles.push({ name: String(tokenId), content: blob });
                }

                setState((s) => ({
                    ...s,
                    metadataProgress: { completed: Math.floor(total / 2), total },
                }));

                const { directoryCid } = await ipfsService.uploadDirectory(metadataFiles, signal);
                const baseURI = `ipfs://${directoryCid}/`;

                setState((s) => ({
                    ...s,
                    phase: 'done',
                    metadataProgress: { completed: total, total },
                    baseURI,
                }));

                return baseURI;
            } catch (err) {
                if (signal.aborted) {
                    setState((s) => ({ ...s, phase: 'cancelled', error: 'Upload cancelled' }));
                    throw err;
                }
                const msg = err instanceof Error ? err.message : 'Upload failed';
                setState((s) => ({ ...s, phase: 'error', error: msg }));
                throw err;
            }
        },
        [],
    );

    return { state, startUpload, cancel, reset };
}
