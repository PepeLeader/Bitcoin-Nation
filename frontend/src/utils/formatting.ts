export function shortenAddress(address: string, chars = 6): string {
    if (address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatSats(sats: bigint): string {
    const btc = Number(sats) / 1e8;
    if (btc === 0) return '0 BTC';
    if (btc < 0.001) return `${sats.toString()} sats`;
    return `${btc.toFixed(8).replace(/\.?0+$/, '')} BTC`;
}

export function formatSupply(supply: bigint, maxSupply: bigint): string {
    if (maxSupply === 0n) return supply.toString();
    return `${supply.toString()} / ${maxSupply.toString()}`;
}

export function formatNumber(n: bigint): string {
    return n.toLocaleString();
}
