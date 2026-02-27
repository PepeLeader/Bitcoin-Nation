const IPFS_API_URL = 'https://ipfs.opnet.org/api/v0/add';
const IPFS_GATEWAY_URL = 'https://ipfs.opnet.org/ipfs';
const IPFS_FALLBACK_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs',
    'https://cloudflare-ipfs.com/ipfs',
    'https://ipfs.io/ipfs',
];

interface IPFSUploadResult {
    readonly cid: string;
    readonly url: string;
    readonly ipfsUri: string;
}

class IPFSService {
    static #instance: IPFSService | undefined;

    private constructor() {}

    static getInstance(): IPFSService {
        if (!IPFSService.#instance) {
            IPFSService.#instance = new IPFSService();
        }
        return IPFSService.#instance;
    }

    async uploadFile(file: File): Promise<IPFSUploadResult> {
        const formData = new FormData();
        formData.append('file', file);

        let response: Response;
        try {
            response = await fetch(IPFS_API_URL, {
                method: 'POST',
                body: formData,
            });
        } catch {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            throw new Error(
                `Failed to upload "${file.name}" (${sizeMB} MB). Check your connection and try again.`,
            );
        }

        if (!response.ok) {
            throw new Error(
                `Upload failed for "${file.name}" (HTTP ${response.status}). The IPFS server may be temporarily unavailable.`,
            );
        }

        const data: { Hash: string } = await response.json() as { Hash: string };
        const cid = data.Hash;

        return {
            cid,
            url: `${IPFS_GATEWAY_URL}/${cid}`,
            ipfsUri: `ipfs://${cid}`,
        };
    }

    async uploadJSON(json: Record<string, unknown>): Promise<IPFSUploadResult> {
        const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
        const file = new File([blob], 'metadata.json', { type: 'application/json' });
        return this.uploadFile(file);
    }

    async uploadNFTMetadata(
        name: string,
        description: string,
        imageFile: File,
        attributes?: readonly { trait_type: string; value: string | number }[],
    ): Promise<IPFSUploadResult> {
        const imageResult = await this.uploadFile(imageFile);

        const metadata: Record<string, unknown> = {
            name,
            description,
            image: imageResult.ipfsUri,
        };

        if (attributes && attributes.length > 0) {
            metadata['attributes'] = attributes;
        }

        return this.uploadJSON(metadata);
    }

    async uploadFileWithSignal(file: File, signal?: AbortSignal): Promise<IPFSUploadResult> {
        const formData = new FormData();
        formData.append('file', file);

        let response: Response;
        try {
            response = await fetch(IPFS_API_URL, {
                method: 'POST',
                body: formData,
                signal,
            });
        } catch (err: unknown) {
            if (signal?.aborted) throw err;
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            throw new Error(
                `Failed to upload "${file.name}" (${sizeMB} MB). Check your connection and try again.`,
                { cause: err },
            );
        }

        if (!response.ok) {
            throw new Error(
                `Upload failed for "${file.name}" (HTTP ${response.status}). The IPFS server may be temporarily unavailable.`,
            );
        }

        const data: { Hash: string } = await response.json() as { Hash: string };
        const cid = data.Hash;

        return {
            cid,
            url: `${IPFS_GATEWAY_URL}/${cid}`,
            ipfsUri: `ipfs://${cid}`,
        };
    }

    async uploadDirectory(
        files: readonly { name: string; content: Blob }[],
        signal?: AbortSignal,
    ): Promise<{ files: Map<string, string>; directoryCid: string }> {
        const formData = new FormData();
        for (const f of files) {
            formData.append('file', f.content, f.name);
        }

        const response = await fetch(`${IPFS_API_URL}?wrap-with-directory=true`, {
            method: 'POST',
            body: formData,
            signal,
        });

        if (!response.ok) {
            throw new Error(
                `Metadata upload failed (HTTP ${response.status}). The IPFS server may be temporarily unavailable.`,
            );
        }

        const text = await response.text();
        const lines = text.trim().split('\n');
        const fileMap = new Map<string, string>();
        let directoryCid = '';

        for (const line of lines) {
            let entry: { Name: string; Hash: string };
            try {
                entry = JSON.parse(line) as { Name: string; Hash: string };
            } catch {
                continue;
            }
            if (entry.Name === '') {
                directoryCid = entry.Hash;
            } else {
                fileMap.set(entry.Name, entry.Hash);
            }
        }

        if (!directoryCid) {
            throw new Error('IPFS directory upload did not return a directory CID');
        }

        return { files: fileMap, directoryCid };
    }

    resolveIPFS(uri: string): string {
        if (uri.startsWith('ipfs://')) {
            return `${IPFS_GATEWAY_URL}/${uri.slice(7)}`;
        }
        return uri;
    }

    resolveIPFSWithFallbacks(uri: string): readonly string[] {
        if (!uri.startsWith('ipfs://')) return [uri];
        const path = uri.slice(7);
        return [
            `${IPFS_GATEWAY_URL}/${path}`,
            ...IPFS_FALLBACK_GATEWAYS.map((gw) => `${gw}/${path}`),
        ];
    }

    async fetchIPFS(uri: string): Promise<Response> {
        const urls = this.resolveIPFSWithFallbacks(uri);
        for (const url of urls) {
            try {
                const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
                if (res.ok) return res;
            } catch {
                // try next gateway
            }
        }
        throw new Error(`Failed to fetch from all IPFS gateways: ${uri}`);
    }
}

export const ipfsService = IPFSService.getInstance();
