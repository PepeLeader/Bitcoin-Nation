import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { formatSats } from '../utils/formatting';
import type { NFTMetadata } from '../types/nft';

interface OwnedNFT {
    readonly tokenId: bigint;
    readonly uri: string;
    readonly imageUrl: string;
    readonly collectionAddress: string;
    readonly collectionName: string;
    readonly collectionSymbol: string;
}

export function PortfolioPage(): React.JSX.Element {
    const { network, isConnected, address: walletAddress, walletBalance } = useWallet();
    const [ownedNFTs, setOwnedNFTs] = useState<readonly OwnedNFT[]>([]);
    const [nftsLoading, setNftsLoading] = useState(true);
    const [nftsError, setNftsError] = useState<string | null>(null);

    // Load NFTs owned by the user across all collections
    useEffect(() => {
        if (!isConnected || !walletAddress) {
            setOwnedNFTs([]);
            setNftsLoading(false);
            return;
        }
        let cancelled = false;

        void (async () => {
            setNftsLoading(true);
            setNftsError(null);

            try {
                const factory = contractService.getFactory(network);
                const countResult = await factory.collectionCount();
                const count = countResult.properties.count;
                const limit = count < 50n ? count : 50n;

                // Phase 1: Fetch ALL collection addresses in parallel
                const indexPromises = Array.from({ length: Number(limit) }, (_, i) =>
                    factory.collectionAtIndex(BigInt(i))
                        .then((r) => String(r.properties.collectionAddress))
                        .catch(() => null),
                );
                const addresses = (await Promise.all(indexPromises)).filter(
                    (a): a is string => a !== null,
                );

                if (cancelled) return;

                // Phase 2: Check balances for ALL collections in parallel
                const balanceChecks = addresses.map(async (addr) => {
                    try {
                        const contract = contractService.getNFTContract(addr, network);
                        const balanceResult = await contract.balanceOf(walletAddress);
                        return { addr, balance: balanceResult.properties.balance };
                    } catch {
                        return { addr, balance: 0n };
                    }
                });
                const balances = await Promise.all(balanceChecks);
                const owned = balances.filter((b) => b.balance > 0n);

                if (cancelled || owned.length === 0) {
                    if (!cancelled) setOwnedNFTs([]);
                    return;
                }

                // Phase 3: For each owned collection, fetch metadata + token IDs in parallel
                const collectionPromises = owned.map(async ({ addr, balance }) => {
                    try {
                        const contract = contractService.getNFTContract(addr, network);
                        const tokenLimit = balance < 20n ? balance : 20n;

                        // Fetch metadata + all token IDs in one parallel batch
                        const [meta, ...tokenIdResults] = await Promise.all([
                            contract.metadata(),
                            ...Array.from({ length: Number(tokenLimit) }, (_, j) =>
                                contract.tokenOfOwnerByIndex(walletAddress, BigInt(j)),
                            ),
                        ]);

                        const collectionName = meta.properties.name;
                        const collectionSymbol = meta.properties.symbol;

                        // Fetch all token URIs in parallel
                        const tokenIds = tokenIdResults.map((r) => r.properties.tokenId);
                        const uriResults = await Promise.all(
                            tokenIds.map((tid) => contract.tokenURI(tid).catch(() => null)),
                        );

                        // Resolve IPFS images in parallel
                        const nftPromises = tokenIds.map(async (tokenId, idx) => {
                            const uriResult = uriResults[idx];
                            if (!uriResult) return null;
                            const uri = uriResult.properties.uri;

                            let imageUrl = ipfsService.resolveIPFS(uri);
                            try {
                                const res = await ipfsService.fetchIPFS(uri);
                                const json = (await res.json()) as NFTMetadata;
                                if (json.image) {
                                    imageUrl = ipfsService.resolveIPFS(json.image);
                                }
                            } catch {
                                // fall back to raw URI
                            }

                            return {
                                tokenId,
                                uri,
                                imageUrl,
                                collectionAddress: addr,
                                collectionName,
                                collectionSymbol,
                            } as OwnedNFT;
                        });

                        return (await Promise.all(nftPromises)).filter(
                            (n): n is OwnedNFT => n !== null,
                        );
                    } catch {
                        return [];
                    }
                });

                const results = await Promise.all(collectionPromises);
                if (!cancelled) setOwnedNFTs(results.flat());
            } catch (err) {
                if (!cancelled) {
                    setNftsError(err instanceof Error ? err.message : 'Failed to load owned NFTs');
                }
            } finally {
                if (!cancelled) setNftsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [network, isConnected, walletAddress]);

    if (!isConnected) {
        return (
            <div className="connect-prompt">
                <h2>Connect Your Wallet</h2>
                <p>Connect your wallet to view your portfolio.</p>
            </div>
        );
    }

    return (
        <div className="portfolio-page">
            <div className="page-header">
                <h1>My Portfolio</h1>
            </div>

            {walletBalance && (
                <div className="portfolio-card balance-card">
                    <div>
                        <span className="balance-label">BTC Balance</span>
                        <div className="balance-value">
                            {formatSats(BigInt(walletBalance.confirmed))}
                        </div>
                    </div>
                    {walletBalance.unconfirmed > 0 && (
                        <div>
                            <span className="balance-label">Unconfirmed</span>
                            <div className="balance-value--secondary">
                                {formatSats(BigInt(walletBalance.unconfirmed))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <section className="portfolio-section">
                <h2 className="portfolio-section__title">Owned NFTs</h2>

                {nftsLoading && (
                    <div className="loading-state">
                        <div className="spinner" />
                        <p>Loading your NFTs...</p>
                    </div>
                )}

                {nftsError && <div className="error-state">{nftsError}</div>}

                {!nftsLoading && !nftsError && ownedNFTs.length === 0 && (
                    <div className="empty-state">
                        <p className="empty-state__title">No NFTs yet</p>
                        <p className="empty-state__description">
                            Browse collections and mint your first NFT.
                        </p>
                        <Link to="/mints" className="btn btn--primary" style={{ marginTop: '16px' }}>
                            Active Mints
                        </Link>
                    </div>
                )}

                <div className="nft-gallery">
                    {ownedNFTs.map((nft) => (
                        <Link
                            key={`${nft.collectionAddress}-${nft.tokenId.toString()}`}
                            to={`/collection/${nft.collectionAddress}/nft/${nft.tokenId.toString()}`}
                            className="nft-card"
                        >
                            <div className="nft-card__image">
                                <img
                                    src={nft.imageUrl}
                                    alt={`#${nft.tokenId.toString()}`}
                                    loading="lazy"
                                />
                            </div>
                            <div className="nft-card__info">
                                <span className="nft-card__id">#{nft.tokenId.toString()}</span>
                                <span className="nft-card__name">{nft.collectionName}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
