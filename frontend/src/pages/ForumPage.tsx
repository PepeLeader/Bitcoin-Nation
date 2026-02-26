import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { forumService, type ForumThread } from '../services/ForumService';
import { shortenAddress } from '../utils/formatting';
import { timeAgo } from '../utils/timeAgo';
import { getVoteScore } from '../utils/forum';

export function ForumPage(): React.JSX.Element {
    const { address: collectionAddress } = useParams<{ address: string }>();
    const navigate = useNavigate();
    const { isConnected, address, addressStr, network } = useWallet();

    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [collectionName, setCollectionName] = useState('');
    const [collectionIcon, setCollectionIcon] = useState('');
    const [threads, setThreads] = useState<ForumThread[]>([]);
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');

    useEffect(() => {
        if (!isConnected || !address || !collectionAddress) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        void (async () => {
            setLoading(true);
            try {
                const nft = contractService.getNFTContract(collectionAddress, network);
                const [meta, balanceResult] = await Promise.all([
                    nft.metadata(),
                    nft.balanceOf(address),
                ]);

                if (cancelled) return;

                const balance = balanceResult.properties.balance;
                setHasAccess(balance > 0n);
                setCollectionName(meta.properties.name);
                setCollectionIcon(meta.properties.icon);

                if (balance > 0n) {
                    setThreads(forumService.getThreads(collectionAddress));
                }
            } catch {
                setHasAccess(false);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isConnected, address, collectionAddress, network]);

    const handleCreateThread = (): void => {
        if (!collectionAddress || !addressStr || !newTitle.trim() || !newBody.trim()) return;

        forumService.createThread(collectionAddress, newTitle.trim(), newBody.trim(), addressStr);
        setThreads(forumService.getThreads(collectionAddress));
        setNewTitle('');
        setNewBody('');
    };

    const handleVote = (threadId: string, direction: 1 | -1): void => {
        if (!addressStr) return;
        forumService.voteThread(threadId, addressStr, direction);
        if (collectionAddress) {
            setThreads(forumService.getThreads(collectionAddress));
        }
    };

    if (!isConnected) {
        return (
            <div className="portfolio-page">
                <div className="connect-prompt">
                    <h2>Connect Your Wallet</h2>
                    <p>Connect your wallet to access this forum.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="portfolio-page">
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Checking access...</p>
                </div>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div className="portfolio-page">
                <div className="page-header">
                    <h1>Access Denied</h1>
                </div>
                <div className="empty-state">
                    <p className="empty-state__title">Token Gate</p>
                    <p className="empty-state__description">
                        You must hold an NFT from this collection to access its forum.
                    </p>
                    <Link
                        to={`/collection/${collectionAddress}/mint`}
                        className="btn btn--primary"
                        style={{ marginTop: '16px' }}
                    >
                        Mint an NFT
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="portfolio-page">
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                {collectionIcon ? (
                    <img
                        src={ipfsService.resolveIPFS(collectionIcon)}
                        alt=""
                        style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', objectFit: 'cover' }}
                    />
                ) : null}
                <div>
                    <h1>{collectionName} Nation Forum</h1>
                    <p>
                        <Link to="/nations" style={{ color: 'var(--accent-primary)' }}>
                            &larr; Back to Your Nations
                        </Link>
                    </p>
                </div>
            </div>

            <div className="forum-disclaimer">
                Posts are stored locally on this device and are not shared with other users.
            </div>

            {/* Compose new thread */}
            <div className="compose" style={{ marginBottom: 'var(--space-xl)' }}>
                <input
                    type="text"
                    className="compose__title-input"
                    placeholder="Thread title..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                />
                <textarea
                    className="compose__input"
                    placeholder="What's on your mind?"
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                />
                <div className="compose__actions">
                    <button
                        type="button"
                        className="btn btn--primary"
                        disabled={!newTitle.trim() || !newBody.trim()}
                        onClick={handleCreateThread}
                    >
                        New Thread
                    </button>
                </div>
            </div>

            {/* Thread list */}
            <div className="thread-list">
                {threads.length === 0 && (
                    <div className="empty-state">
                        <p className="empty-state__description">
                            No threads yet. Be the first to start a discussion!
                        </p>
                    </div>
                )}
                {threads.map((thread) => {
                    const score = getVoteScore(thread.votes);
                    const userVote = addressStr ? (thread.votes[addressStr] ?? 0) : 0;

                    return (
                        <div
                            key={thread.id}
                            className="thread-item"
                            onClick={() => navigate(`/nations/${collectionAddress}/thread/${thread.id}`)}
                        >
                            <div className="thread-item__votes">
                                <button
                                    type="button"
                                    className={`vote-btn${userVote === 1 ? ' vote-btn--active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleVote(thread.id, 1);
                                    }}
                                >
                                    &#9650;
                                </button>
                                <span className="thread-item__score">{score}</span>
                                <button
                                    type="button"
                                    className={`vote-btn${userVote === -1 ? ' vote-btn--active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleVote(thread.id, -1);
                                    }}
                                >
                                    &#9660;
                                </button>
                            </div>
                            <div className="thread-item__content">
                                <div className="thread-item__title">{thread.title}</div>
                                <div className="thread-item__meta">
                                    <span className="thread-item__author">
                                        {shortenAddress(thread.author)}
                                    </span>
                                    <span>{timeAgo(thread.createdAt)}</span>
                                </div>
                            </div>
                            <div className="thread-item__stats">
                                <span className="thread-item__stat">
                                    {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
