import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useNFTContract } from '../hooks/useNFTContract';
import { ipfsService } from '../services/IPFSService';
import { shortenAddress } from '../utils/formatting';
import type { NFTMetadata } from '../types/nft';

export function NFTDetailPage(): React.JSX.Element {
    const { address, tokenId: tokenIdStr } = useParams<{ address: string; tokenId: string }>();
    const { isConnected, address: walletAddress } = useWallet();
    const { getTokenURI, getOwnerOf, transfer, loading, error } = useNFTContract();

    const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
    const [owner, setOwner] = useState('');
    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError] = useState('');
    const [transferTo, setTransferTo] = useState('');
    const [transferStatus, setTransferStatus] = useState('');
    const [ownerCopied, setOwnerCopied] = useState(false);
    const [imageUrls, setImageUrls] = useState<readonly string[]>([]);
    const [imgFallbackIdx, setImgFallbackIdx] = useState(0);
    const [loadAttempt, setLoadAttempt] = useState(0);

    const tokenId = BigInt(tokenIdStr ?? '0');

    useEffect(() => {
        if (!address) return;
        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

        void (async () => {
            setPageLoading(true);
            setPageError('');

            const MAX_RETRIES = 12;
            const RETRY_DELAY = 5000;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                if (cancelled) return;

                if (attempt > 0) {
                    setPageError(`Waiting for transaction to confirm... (attempt ${attempt}/${MAX_RETRIES})`);
                    await new Promise<void>((resolve) => {
                        retryTimer = setTimeout(resolve, RETRY_DELAY);
                    });
                    if (cancelled) return;
                }

                try {
                    const [uriResult, ownerResult] = await Promise.all([
                        getTokenURI(address, tokenId),
                        getOwnerOf(address, tokenId),
                    ]);

                    if (cancelled) return;
                    setOwner(ownerResult);
                    setPageError('');

                    try {
                        const res = await ipfsService.fetchIPFS(uriResult);
                        const json = (await res.json()) as NFTMetadata;
                        if (!cancelled) {
                            setMetadata(json);
                            if (json.image) {
                                setImageUrls(ipfsService.resolveIPFSWithFallbacks(json.image));
                                setImgFallbackIdx(0);
                            }
                        }
                    } catch {
                        // metadata not available — leave imageUrls empty for placeholder
                    }

                    // Success — stop retrying
                    break;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : '';
                    const isNotYetMined = msg.includes('does not exist') || msg.includes('not found');

                    if (!isNotYetMined || attempt === MAX_RETRIES) {
                        if (!cancelled) {
                            setPageError(msg || 'Failed to load NFT data');
                        }
                        break;
                    }
                    // Token not yet mined — retry
                }
            }

            if (!cancelled) setPageLoading(false);
        })();

        return () => {
            cancelled = true;
            if (retryTimer) clearTimeout(retryTimer);
        };
    }, [address, tokenId, getTokenURI, getOwnerOf, loadAttempt]);

    const walletHex = walletAddress ? String(walletAddress).toLowerCase() : '';
    const isOwner = isConnected && walletHex !== '' && walletHex === owner.toLowerCase();

    async function handleTransfer(e: FormEvent): Promise<void> {
        e.preventDefault();
        if (!address || !transferTo) return;

        setTransferStatus('Transferring...');
        try {
            await transfer(address, transferTo, tokenId);
            setTransferStatus('Transfer complete!');
            setOwner(transferTo);
            setTransferTo('');
        } catch {
            setTransferStatus('');
        }
    }

    if (pageLoading) {
        return (
            <div className="loading-state">
                <div className="spinner" />
                {pageError && <p style={{ marginTop: 'var(--space-md)' }}>{pageError}</p>}
            </div>
        );
    }

    if (pageError) {
        return (
            <div className="mint-page">
                <div className="form-error" style={{ marginBottom: 'var(--space-md)' }}>
                    {pageError}
                </div>
                <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setLoadAttempt((n) => n + 1)}
                >
                    Retry
                </button>
            </div>
        );
    }

    const imageUrl = imageUrls[imgFallbackIdx] ?? '';

    return (
        <div className="nft-detail-page">
            <div className="nft-detail-layout">
                <div className="nft-detail-image">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={metadata?.name ?? `NFT #${tokenId.toString()}`}
                            onError={() => {
                                if (imgFallbackIdx < imageUrls.length - 1) {
                                    setImgFallbackIdx((i) => i + 1);
                                }
                            }}
                        />
                    ) : (
                        <div className="nft-detail-image__placeholder">
                            No image available
                        </div>
                    )}
                </div>

                <div className="nft-detail-info">
                    <Link to={`/collection/${address ?? ''}`} className="back-link">
                        &larr; Back to Collection
                    </Link>

                    <h1>{metadata?.name ?? `NFT #${tokenId.toString()}`}</h1>
                    {metadata?.description && (
                        <p className="nft-description">{metadata.description}</p>
                    )}

                    <div className="nft-meta-rows">
                        <div className="meta-row">
                            <span className="meta-label">Token ID</span>
                            <span className="meta-value">#{tokenId.toString()}</span>
                        </div>
                        <div className="meta-row">
                            <span className="meta-label">Owner</span>
                            <button
                                type="button"
                                className="collection-address--copyable"
                                onClick={() => {
                                    void navigator.clipboard.writeText(owner).then(() => {
                                        setOwnerCopied(true);
                                        setTimeout(() => setOwnerCopied(false), 1500);
                                    });
                                }}
                                title="Click to copy address"
                            >
                                {ownerCopied ? 'Copied!' : shortenAddress(owner)}
                            </button>
                        </div>
                    </div>

                    {metadata?.attributes && metadata.attributes.length > 0 && (
                        <div className="nft-attributes">
                            <h3>Attributes</h3>
                            <div className="attributes-grid">
                                {metadata.attributes.map((attr, i) => (
                                    <div key={i} className="attribute-badge">
                                        <span className="attr-type">{attr.trait_type}</span>
                                        <span className="attr-value">{String(attr.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {isOwner && (
                        <form
                            className="transfer-form"
                            onSubmit={(e) => void handleTransfer(e)}
                        >
                            <h3>Transfer</h3>
                            <div className="form-group">
                                <input
                                    type="text"
                                    value={transferTo}
                                    onChange={(e) => setTransferTo(e.target.value)}
                                    placeholder="Recipient address"
                                    required
                                />
                            </div>
                            {error && <div className="form-error">{error}</div>}
                            {transferStatus && (
                                <div className="form-status">{transferStatus}</div>
                            )}
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading || !transferTo}
                            >
                                {loading ? 'Transferring...' : 'Transfer NFT'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
