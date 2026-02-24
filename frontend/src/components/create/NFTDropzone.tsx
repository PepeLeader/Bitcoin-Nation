import { useState, useRef, useCallback, type DragEvent } from 'react';
import type { NFTImageFile } from '../../types/nft';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface NFTDropzoneProps {
    readonly images: readonly NFTImageFile[];
    readonly maxSupply: number;
    readonly disabled?: boolean;
    readonly onImagesChange: (images: NFTImageFile[]) => void;
}

function naturalSort(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function makeId(): string {
    return Math.random().toString(36).slice(2, 10);
}

async function readDirectoryEntries(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
    const reader = entry.createReader();
    const entries: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];
    do {
        batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
            reader.readEntries(resolve, reject);
        });
        entries.push(...batch);
    } while (batch.length > 0);
    return entries;
}

async function entryToFile(entry: FileSystemFileEntry): Promise<File> {
    return new Promise<File>((resolve, reject) => {
        entry.file(resolve, reject);
    });
}

async function extractFiles(items: DataTransferItemList): Promise<File[]> {
    const files: File[] = [];
    const entries: FileSystemEntry[] = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        const entry = item.webkitGetAsEntry();
        if (entry) entries.push(entry);
    }

    for (const entry of entries) {
        if (entry.isFile) {
            files.push(await entryToFile(entry as FileSystemFileEntry));
        } else if (entry.isDirectory) {
            const children = await readDirectoryEntries(entry as FileSystemDirectoryEntry);
            for (const child of children) {
                if (child.isFile) {
                    files.push(await entryToFile(child as FileSystemFileEntry));
                }
            }
        }
    }

    return files;
}

function filterAndSort(files: File[]): File[] {
    return files
        .filter((f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE)
        .sort((a, b) => naturalSort(a.name, b.name));
}

function toNFTImages(files: File[]): NFTImageFile[] {
    return files.map((file) => ({
        id: makeId(),
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
    }));
}

export function NFTDropzone({ images, maxSupply, disabled, onImagesChange }: NFTDropzoneProps): React.JSX.Element {
    const [dragover, setDragover] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback(
        (files: File[]) => {
            const sorted = filterAndSort(files);
            if (sorted.length === 0) return;
            const next = [...images, ...toNFTImages(sorted)];
            onImagesChange(next);
        },
        [images, onImagesChange],
    );

    const handleDrop = useCallback(
        async (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setDragover(false);
            if (disabled) return;

            const files = await extractFiles(e.dataTransfer.items);

            handleFiles(files);
        },
        [disabled, handleFiles],
    );

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) {
                handleFiles(Array.from(e.target.files));
            }
            e.target.value = '';
        },
        [handleFiles],
    );

    const remove = useCallback(
        (id: string) => {
            const img = images.find((i) => i.id === id);
            if (img) URL.revokeObjectURL(img.preview);
            onImagesChange(images.filter((i) => i.id !== id));
        },
        [images, onImagesChange],
    );

    const handleThumbDragStart = useCallback((idx: number) => {
        setDragIdx(idx);
    }, []);

    const handleThumbDragOver = useCallback(
        (e: DragEvent<HTMLDivElement>, idx: number) => {
            e.preventDefault();
            if (dragIdx !== null && dragIdx !== idx) {
                setDragOverIdx(idx);
            }
        },
        [dragIdx],
    );

    const handleThumbDrop = useCallback(
        (idx: number) => {
            if (dragIdx === null || dragIdx === idx) return;
            const next = [...images];
            const moved = next.splice(dragIdx, 1)[0];
            if (!moved) return;
            next.splice(idx, 0, moved);
            onImagesChange(next);
            setDragIdx(null);
            setDragOverIdx(null);
        },
        [dragIdx, images, onImagesChange],
    );

    const count = images.length;
    const countClass =
        count === maxSupply && maxSupply > 0
            ? 'nft-dropzone__count nft-dropzone__count--match'
            : count > maxSupply && maxSupply > 0
              ? 'nft-dropzone__count nft-dropzone__count--exceed'
              : 'nft-dropzone__count';

    return (
        <div
            className={`nft-dropzone${dragover ? ' nft-dropzone--dragover' : ''}${disabled ? ' nft-dropzone--disabled' : ''}`}
            onDragOver={(e) => {
                e.preventDefault();
                setDragover(true);
            }}
            onDragLeave={() => { setDragover(false); }}
            onDrop={(e) => void handleDrop(e)}
        >
            {count === 0 ? (
                <div className="nft-dropzone__empty" onClick={() => inputRef.current?.click()}>
                    <div className="nft-dropzone__icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                    </div>
                    <div className="nft-dropzone__text">Drop a folder of images here</div>
                    <div className="nft-dropzone__hint">PNG, JPG, GIF, WEBP — max 10 MB each</div>
                </div>
            ) : (
                <>
                    <div className="nft-dropzone__grid">
                        {images.map((img, idx) => (
                            <div
                                key={img.id}
                                className={`nft-dropzone__thumb${dragIdx === idx ? ' nft-dropzone__thumb--dragging' : ''}${dragOverIdx === idx ? ' nft-dropzone__thumb--dragover' : ''}`}
                                draggable
                                onDragStart={() => { handleThumbDragStart(idx); }}
                                onDragOver={(e) => { handleThumbDragOver(e, idx); }}
                                onDrop={() => { handleThumbDrop(idx); }}
                                onDragEnd={() => {
                                    setDragIdx(null);
                                    setDragOverIdx(null);
                                }}
                            >
                                <img src={img.preview} alt={img.name} className="nft-dropzone__img" />
                                <div className="nft-dropzone__index">#{idx + 1}</div>
                                <button
                                    type="button"
                                    className="nft-dropzone__remove"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        remove(img.id);
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        <div className="nft-dropzone__add" onClick={() => inputRef.current?.click()}>
                            +
                        </div>
                    </div>
                    <div className="nft-dropzone__footer">
                        <span className={countClass}>
                            {count} image{count !== 1 ? 's' : ''}
                            {maxSupply > 0 ? ` / ${maxSupply}` : ''}
                        </span>
                    </div>
                </>
            )}
            <input
                ref={inputRef}
                type="file"
                className="nft-dropzone__input"
                accept={ACCEPTED_TYPES.join(',')}
                multiple
                /* @ts-expect-error webkitdirectory is non-standard but widely supported */
                webkitdirectory=""
                onChange={handleInputChange}
            />
        </div>
    );
}
