import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { forumService, type ForumThread, type ForumPost } from '../services/ForumService';
import { shortenAddress } from '../utils/formatting';
import { timeAgo } from '../utils/timeAgo';

function getVoteScore(votes: Record<string, 1 | -1>): number {
    let score = 0;
    for (const v of Object.values(votes)) {
        score += v;
    }
    return score;
}

export function ThreadPage(): React.JSX.Element {
    const { address: collectionAddress, threadId } = useParams<{
        address: string;
        threadId: string;
    }>();
    const { isConnected, address, addressStr, network } = useWallet();

    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [thread, setThread] = useState<ForumThread | null>(null);
    const [posts, setPosts] = useState<ForumPost[]>([]);
    const [replyBody, setReplyBody] = useState('');

    const refreshData = (): void => {
        if (!threadId) return;
        setThread(forumService.getThread(threadId));
        setPosts(forumService.getPosts(threadId));
    };

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
                const balanceResult = await nft.balanceOf(address);

                if (cancelled) return;

                const balance = balanceResult.properties.balance;
                setHasAccess(balance > 0n);

                if (balance > 0n && threadId) {
                    setThread(forumService.getThread(threadId));
                    setPosts(forumService.getPosts(threadId));
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
    }, [isConnected, address, collectionAddress, network, threadId]);

    const handleReply = (): void => {
        if (!threadId || !addressStr || !replyBody.trim()) return;

        forumService.createPost(threadId, replyBody.trim(), addressStr);
        setReplyBody('');
        refreshData();
    };

    const handleVoteThread = (direction: 1 | -1): void => {
        if (!threadId || !addressStr) return;
        forumService.voteThread(threadId, addressStr, direction);
        refreshData();
    };

    const handleVotePost = (postId: string, direction: 1 | -1): void => {
        if (!addressStr) return;
        forumService.votePost(postId, addressStr, direction);
        refreshData();
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

    if (!thread) {
        return (
            <div className="portfolio-page">
                <div className="empty-state">
                    <p className="empty-state__title">Thread not found</p>
                    <Link to={`/nations/${collectionAddress}`} className="btn btn--primary" style={{ marginTop: '16px' }}>
                        Back to Forum
                    </Link>
                </div>
            </div>
        );
    }

    const threadScore = getVoteScore(thread.votes);
    const threadUserVote = addressStr ? (thread.votes[addressStr] ?? 0) : 0;

    return (
        <div className="portfolio-page">
            <div className="thread-view">
                {/* Back link */}
                <p style={{ marginBottom: 'var(--space-lg)' }}>
                    <Link to={`/nations/${collectionAddress}`} style={{ color: 'var(--accent-primary)' }}>
                        &larr; Back to Forum
                    </Link>
                </p>

                {/* Thread header */}
                <div className="thread-view__header">
                    <h1 className="thread-view__title">{thread.title}</h1>
                    <div className="thread-view__meta">
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                            {shortenAddress(thread.author)}
                        </span>
                        <span>{timeAgo(thread.createdAt)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                            <button
                                type="button"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: threadUserVote === 1 ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    fontSize: '0.875rem',
                                    padding: '2px',
                                }}
                                onClick={() => handleVoteThread(1)}
                            >
                                &#9650;
                            </button>
                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{threadScore}</span>
                            <button
                                type="button"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: threadUserVote === -1 ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    fontSize: '0.875rem',
                                    padding: '2px',
                                }}
                                onClick={() => handleVoteThread(-1)}
                            >
                                &#9660;
                            </button>
                        </div>
                    </div>
                </div>

                {/* Original post body */}
                <div className="post post--announcement">
                    <div className="post__sidebar">
                        <div className="post__avatar">
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {thread.author.slice(0, 2).toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div className="post__body">
                        <div className="post__text">
                            {thread.body.split('\n').map((line, i) => (
                                <p key={i}>{line}</p>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Replies */}
                {posts.length > 0 && (
                    <div style={{ marginTop: 'var(--space-lg)' }}>
                        <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-lg)' }}>
                            {posts.length} {posts.length === 1 ? 'Reply' : 'Replies'}
                        </h3>
                        {posts.map((post) => {
                            const postScore = getVoteScore(post.votes);
                            const postUserVote = addressStr ? (post.votes[addressStr] ?? 0) : 0;

                            return (
                                <div key={post.id} className="post">
                                    <div className="post__sidebar">
                                        <div className="post__avatar">
                                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                {post.author.slice(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="post__body">
                                        <div className="post__header">
                                            <span className="post__author">
                                                {shortenAddress(post.author)}
                                            </span>
                                            <span className="post__timestamp">
                                                {timeAgo(post.createdAt)}
                                            </span>
                                        </div>
                                        <div className="post__text">
                                            {post.body.split('\n').map((line, i) => (
                                                <p key={i}>{line}</p>
                                            ))}
                                        </div>
                                        <div className="post__actions">
                                            <button
                                                type="button"
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: postUserVote === 1 ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                    fontSize: '0.875rem',
                                                    padding: '2px',
                                                }}
                                                onClick={() => handleVotePost(post.id, 1)}
                                            >
                                                &#9650;
                                            </button>
                                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                                                {postScore}
                                            </span>
                                            <button
                                                type="button"
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: postUserVote === -1 ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                    fontSize: '0.875rem',
                                                    padding: '2px',
                                                }}
                                                onClick={() => handleVotePost(post.id, -1)}
                                            >
                                                &#9660;
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Reply compose */}
                <div className="compose compose--reply">
                    <textarea
                        className="compose__input"
                        placeholder="Write a reply..."
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                    />
                    <div className="compose__actions">
                        <button
                            type="button"
                            className="btn btn--primary"
                            disabled={!replyBody.trim()}
                            onClick={handleReply}
                        >
                            Reply
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
