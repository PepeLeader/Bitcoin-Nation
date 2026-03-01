interface SaleRecord {
    readonly listingId: string;
    readonly collection: string;
    readonly price: string;
    readonly discoveredAt: number;
}

const STORAGE_KEY = 'bn_marketplace_sales';

class VolumeService {
    static #instance: VolumeService | undefined;

    private constructor() {}

    static getInstance(): VolumeService {
        if (!VolumeService.#instance) {
            VolumeService.#instance = new VolumeService();
        }
        return VolumeService.#instance;
    }

    recordSale(listingId: bigint, collection: string, price: bigint): void {
        const sales = this.#readSales();
        const id = listingId.toString();
        if (sales.some((s) => s.listingId === id)) return;
        sales.push({
            listingId: id,
            collection,
            price: price.toString(),
            discoveredAt: Date.now(),
        });
        this.#writeSales(sales);
    }

    hasSale(listingId: bigint): boolean {
        return this.#readSales().some((s) => s.listingId === listingId.toString());
    }

    getVolume(collection: string, since?: number): bigint {
        let total = 0n;
        for (const sale of this.#readSales()) {
            if (sale.collection !== collection) continue;
            if (since !== undefined && sale.discoveredAt < since) continue;
            total += BigInt(sale.price);
        }
        return total;
    }

    getSaleCount(collection: string, since?: number): number {
        let count = 0;
        for (const sale of this.#readSales()) {
            if (sale.collection !== collection) continue;
            if (since !== undefined && sale.discoveredAt < since) continue;
            count++;
        }
        return count;
    }

    #readSales(): SaleRecord[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? (JSON.parse(raw) as SaleRecord[]) : [];
        } catch {
            return [];
        }
    }

    #writeSales(sales: readonly SaleRecord[]): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
        } catch {
            // localStorage full or unavailable
        }
    }
}

export const volumeService = VolumeService.getInstance();
