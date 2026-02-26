export interface ForumThread {
    readonly id: string;
    readonly collectionAddress: string;
    readonly title: string;
    readonly body: string;
    readonly author: string;
    readonly createdAt: number;
    readonly votes: Record<string, 1 | -1>;
    readonly replyCount: number;
}

export interface ForumPost {
    readonly id: string;
    readonly threadId: string;
    readonly body: string;
    readonly author: string;
    readonly createdAt: number;
    readonly votes: Record<string, 1 | -1>;
}

const THREADS_KEY = 'bn_forum_threads';
const POSTS_KEY = 'bn_forum_posts';

class ForumService {
    static #instance: ForumService | undefined;

    private constructor() {}

    static getInstance(): ForumService {
        if (!ForumService.#instance) {
            ForumService.#instance = new ForumService();
        }
        return ForumService.#instance;
    }

    getThreads(collectionAddress: string): ForumThread[] {
        const all = this.#readThreads();
        return all
            .filter((t) => t.collectionAddress === collectionAddress)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    getThread(threadId: string): ForumThread | null {
        const all = this.#readThreads();
        return all.find((t) => t.id === threadId) ?? null;
    }

    createThread(
        collectionAddress: string,
        title: string,
        body: string,
        author: string,
    ): ForumThread {
        const threads = this.#readThreads();
        const thread: ForumThread = {
            id: crypto.randomUUID(),
            collectionAddress,
            title,
            body,
            author,
            createdAt: Date.now(),
            votes: {},
            replyCount: 0,
        };
        threads.push(thread);
        this.#writeThreads(threads);
        return thread;
    }

    getPosts(threadId: string): ForumPost[] {
        const all = this.#readPosts();
        return all
            .filter((p) => p.threadId === threadId)
            .sort((a, b) => a.createdAt - b.createdAt);
    }

    createPost(threadId: string, body: string, author: string): ForumPost {
        const posts = this.#readPosts();
        const post: ForumPost = {
            id: crypto.randomUUID(),
            threadId,
            body,
            author,
            createdAt: Date.now(),
            votes: {},
        };
        posts.push(post);
        this.#writePosts(posts);

        // Increment replyCount on the thread
        const threads = this.#readThreads();
        const idx = threads.findIndex((t) => t.id === threadId);
        const existing = threads[idx];
        if (idx !== -1 && existing) {
            threads[idx] = {
                id: existing.id,
                collectionAddress: existing.collectionAddress,
                title: existing.title,
                body: existing.body,
                author: existing.author,
                createdAt: existing.createdAt,
                votes: existing.votes,
                replyCount: existing.replyCount + 1,
            };
            this.#writeThreads(threads);
        }

        return post;
    }

    voteThread(threadId: string, voter: string, direction: 1 | -1): void {
        const threads = this.#readThreads();
        const idx = threads.findIndex((t) => t.id === threadId);
        const existing = threads[idx];
        if (idx === -1 || !existing) return;

        const votes = { ...existing.votes };

        if (votes[voter] === direction) {
            delete votes[voter];
        } else {
            votes[voter] = direction;
        }

        threads[idx] = {
            id: existing.id,
            collectionAddress: existing.collectionAddress,
            title: existing.title,
            body: existing.body,
            author: existing.author,
            createdAt: existing.createdAt,
            replyCount: existing.replyCount,
            votes,
        };
        this.#writeThreads(threads);
    }

    votePost(postId: string, voter: string, direction: 1 | -1): void {
        const posts = this.#readPosts();
        const idx = posts.findIndex((p) => p.id === postId);
        const existing = posts[idx];
        if (idx === -1 || !existing) return;

        const votes = { ...existing.votes };

        if (votes[voter] === direction) {
            delete votes[voter];
        } else {
            votes[voter] = direction;
        }

        posts[idx] = {
            id: existing.id,
            threadId: existing.threadId,
            body: existing.body,
            author: existing.author,
            createdAt: existing.createdAt,
            votes,
        };
        this.#writePosts(posts);
    }

    getEngagement(collectionAddress: string, since?: number): number {
        const threads = this.#readThreads().filter(
            (t) =>
                t.collectionAddress === collectionAddress &&
                (!since || t.createdAt >= since),
        );
        const threadIds = new Set(
            this.#readThreads()
                .filter((t) => t.collectionAddress === collectionAddress)
                .map((t) => t.id),
        );
        const posts = this.#readPosts().filter(
            (p) =>
                threadIds.has(p.threadId) &&
                (!since || p.createdAt >= since),
        );

        let voteCount = 0;
        for (const t of threads) {
            voteCount += Object.keys(t.votes).length;
        }
        for (const p of posts) {
            voteCount += Object.keys(p.votes).length;
        }

        return threads.length + posts.length + voteCount;
    }

    #readThreads(): ForumThread[] {
        try {
            const raw = localStorage.getItem(THREADS_KEY);
            return raw ? (JSON.parse(raw) as ForumThread[]) : [];
        } catch {
            return [];
        }
    }

    #writeThreads(threads: ForumThread[]): void {
        localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    }

    #readPosts(): ForumPost[] {
        try {
            const raw = localStorage.getItem(POSTS_KEY);
            return raw ? (JSON.parse(raw) as ForumPost[]) : [];
        } catch {
            return [];
        }
    }

    #writePosts(posts: ForumPost[]): void {
        localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
    }
}

export const forumService = ForumService.getInstance();
