export function isValidCollectionName(name: string): boolean {
    return name.length >= 1 && name.length <= 64;
}

export function isValidSymbol(symbol: string): boolean {
    return /^[A-Z0-9]{1,10}$/.test(symbol);
}

export function isValidUrl(url: string): boolean {
    if (url === '') return true;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

export function isPositiveBigInt(value: string): boolean {
    try {
        const n = BigInt(value);
        return n > 0n;
    } catch {
        return false;
    }
}

export function isNonNegativeBigInt(value: string): boolean {
    try {
        const n = BigInt(value);
        return n >= 0n;
    } catch {
        return false;
    }
}
