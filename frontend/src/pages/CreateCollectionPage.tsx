import { useState, type SyntheticEvent } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useFactoryContract } from '../hooks/useFactoryContract';
import { useCollectionUpload } from '../hooks/useCollectionUpload';
import { ipfsService } from '../services/IPFSService';
import { isValidCollectionName, isValidSymbol, isValidUrl, isPositiveBigInt, isNonNegativeBigInt } from '../utils/validation';
import { NFTDropzone } from '../components/create/NFTDropzone';
import { CollectionUploadProgress } from '../components/create/CollectionUploadProgress';
import type { NFTImageFile } from '../types/nft';

export function CreateCollectionPage(): React.JSX.Element {
    const { isConnected } = useWallet();
    const { createCollection, loading, error } = useFactoryContract();
    const { state: uploadState, startUpload, cancel: cancelUpload, reset: resetUpload } = useCollectionUpload();

    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [description, setDescription] = useState('');
    const [website, setWebsite] = useState('');
    const [mintPrice, setMintPrice] = useState('');
    const [maxPerWallet, setMaxPerWallet] = useState('');
    const [nftImages, setNftImages] = useState<NFTImageFile[]>([]);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState('');
    const [bannerPreview, setBannerPreview] = useState('');
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState('');

    const isUploadActive = uploadState.phase === 'uploading-images' || uploadState.phase === 'uploading-metadata';

    const isValid =
        isValidCollectionName(name) &&
        isValidSymbol(symbol) &&
        isNonNegativeBigInt(mintPrice) &&
        isPositiveBigInt(maxPerWallet) &&
        isValidUrl(website) &&
        nftImages.length > 0;

    async function handleSubmit(e: SyntheticEvent): Promise<void> {
        e.preventDefault();
        if (!isValid || !isConnected) return;

        setStatus('');

        try {
            let resolvedBaseURI = '';

            // Upload NFT images to IPFS
            try {
                resolvedBaseURI = await startUpload(nftImages, name, description);
            } catch {
                setStatus('NFT upload failed. Check errors and try again.');
                return;
            }

            let iconUri = '';
            let bannerUri = '';

            if (iconFile || bannerFile) {
                setUploading(true);
                setStatus('Uploading images to IPFS...');

                try {
                    if (iconFile) {
                        const result = await ipfsService.uploadFile(iconFile);
                        iconUri = result.ipfsUri;
                    }
                    if (bannerFile) {
                        const result = await ipfsService.uploadFile(bannerFile);
                        bannerUri = result.ipfsUri;
                    }
                } catch {
                    setUploading(false);
                    setStatus(
                        'IPFS upload failed. Remove images or try again later.',
                    );
                    return;
                }

                setUploading(false);
            }

            setStatus('Confirm the transaction in your wallet...');

            const collectionAddress = await createCollection({
                name,
                symbol,
                baseURI: resolvedBaseURI,
                maxSupply: BigInt(nftImages.length),
                mintPrice: BigInt(mintPrice),
                maxPerWallet: BigInt(maxPerWallet),
                banner: bannerUri,
                icon: iconUri,
                website,
                description,
            });

            resetUpload();
            setStatus(
                `Transaction broadcast! Waiting for confirmation... Your collection will be available at /collection/${collectionAddress} once the transaction is mined.`,
            );
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : 'Transaction failed';
            setStatus(`Error: ${msg}`);
        }
    }

    if (!isConnected) {
        return (
            <div className="create-page">
                <div className="connect-prompt">
                    <h2>Connect Your Wallet</h2>
                    <p>You need to connect your wallet to create a collection.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="create-page">
            <div className="page-header">
                <h1>Create Collection</h1>
                <p>Deploy a new NFT collection on Bitcoin</p>
            </div>

            <form className="create-form" onSubmit={(e) => void handleSubmit(e)}>
                <div className="form-group">
                    <label htmlFor="name">Collection Name</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); }}
                        placeholder="My NFT Collection"
                        maxLength={64}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="symbol">Symbol</label>
                    <input
                        id="symbol"
                        type="text"
                        value={symbol}
                        onChange={(e) => { setSymbol(e.target.value.toUpperCase()); }}
                        placeholder="MNFT"
                        maxLength={10}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => { setDescription(e.target.value); }}
                        placeholder="Describe your collection..."
                        rows={3}
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="mintPrice">Mint Price (sats)</label>
                        <input
                            id="mintPrice"
                            type="text"
                            value={mintPrice}
                            onChange={(e) => { setMintPrice(e.target.value); }}
                            placeholder="10000"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="maxPerWallet">Max Per Wallet</label>
                        <input
                            id="maxPerWallet"
                            type="text"
                            value={maxPerWallet}
                            onChange={(e) => { setMaxPerWallet(e.target.value); }}
                            placeholder="5"
                            required
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>NFT Images</label>
                    <NFTDropzone
                        images={nftImages}
                        maxSupply={0}
                        disabled={isUploadActive}
                        onImagesChange={setNftImages}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="website">Website (optional)</label>
                    <input
                        id="website"
                        type="text"
                        value={website}
                        onChange={(e) => { setWebsite(e.target.value); }}
                        placeholder="https://..."
                    />
                </div>

                <div className="form-group">
                    <label>Collection Icon (optional)</label>
                    <div
                        className={`image-upload${iconPreview ? ' image-upload--has-image' : ''}`}
                        onClick={() => document.getElementById('icon')?.click()}
                    >
                        {iconPreview ? (
                            <img src={iconPreview} alt="Icon preview" className="image-upload__preview" />
                        ) : (
                            <>
                                <div className="image-upload__icon">+</div>
                                <div className="image-upload__text">Click to upload icon</div>
                                <div className="image-upload__hint">Square image recommended (256x256+)</div>
                            </>
                        )}
                        <input
                            id="icon"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setIconFile(file);
                                if (file) {
                                    setIconPreview(URL.createObjectURL(file));
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Collection Banner (optional)</label>
                    <div
                        className={`image-upload image-upload--banner${bannerPreview ? ' image-upload--has-image' : ''}`}
                        onClick={() => document.getElementById('banner')?.click()}
                    >
                        {bannerPreview ? (
                            <img src={bannerPreview} alt="Banner preview" className="image-upload__preview" />
                        ) : (
                            <>
                                <div className="image-upload__icon">+</div>
                                <div className="image-upload__text">Click to upload banner</div>
                                <div className="image-upload__hint">Wide image recommended (1200x400+)</div>
                            </>
                        )}
                        <input
                            id="banner"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setBannerFile(file);
                                if (file) {
                                    setBannerPreview(URL.createObjectURL(file));
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="creation-fee-notice">
                    <strong>Collection creation fee:</strong> 100,000 sats
                    <p>This fee is paid to the platform when deploying your collection.</p>
                </div>

                {error && <div className="form-error">{error}</div>}
                {status && <div className="form-status">{status}</div>}

                <button
                    type="submit"
                    className="btn btn--primary btn--lg"
                    disabled={!isValid || loading || uploading || isUploadActive}
                >
                    {uploading || isUploadActive ? 'Uploading...' : loading ? 'Creating...' : 'Create Collection (100,000 sats)'}
                </button>
            </form>

            {isUploadActive && (
                <CollectionUploadProgress state={uploadState} onCancel={cancelUpload} />
            )}
        </div>
    );
}
