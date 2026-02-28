/**
 * Deterministic pixel-art image generator for OP-721 tokens.
 *
 * When a collection doesn't expose tokenURI() (e.g. fully on-chain generative
 * collections like BitGlyphs), this generates a unique symmetrical pixel avatar
 * from the tokenId alone. The output is always the same for the same tokenId.
 *
 * Algorithm:
 *   1. Seed a PRNG with the tokenId
 *   2. Fill a 5×10 half-grid (alive/dead cells)
 *   3. Mirror horizontally → 10×10 symmetric grid
 *   4. Derive foreground + background RGB from the seed
 *   5. Render on an off-screen canvas → data URL
 */

// Simple 32-bit PRNG (mulberry32) — deterministic, fast
function mulberry32(seed: number): () => number {
    let s = seed | 0;
    return (): number => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

interface RGB {
    readonly r: number;
    readonly g: number;
    readonly b: number;
}

function hslToRgb(h: number, s: number, l: number): RGB {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }

    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255),
    };
}

const GRID_ROWS = 10;
const GRID_HALF_COLS = 5;
const RENDER_SIZE = 100; // px — final image size
const CELL_SIZE = RENDER_SIZE / GRID_ROWS; // 10px per cell

/**
 * Generate a deterministic pixel-art data URL for a token.
 * Returns a 100×100 PNG data URL.
 */
export function generateTokenImage(tokenId: bigint): string {
    const seed = Number(tokenId & 0xffffffffn);
    const rand = mulberry32(seed);

    // Generate 5×10 half-grid
    const half: number[][] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
        const line: number[] = [];
        for (let col = 0; col < GRID_HALF_COLS; col++) {
            line.push(rand() > 0.5 ? 1 : 0);
        }
        half.push(line);
    }

    // Mirror to full 10×10
    const grid: number[][] = half.map((row) => {
        const mirrored = [...row];
        for (let i = GRID_HALF_COLS - 1; i >= 0; i--) {
            mirrored.push(row[i]!);
        }
        return mirrored;
    });

    // Derive colors from seed
    const hue = (seed * 137) % 360;
    const fg = hslToRgb(hue, 0.7, 0.55);
    const bg = hslToRgb((hue + 180) % 360, 0.15, 0.08);

    // Render on off-screen canvas
    const canvas = document.createElement('canvas');
    canvas.width = RENDER_SIZE;
    canvas.height = RENDER_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Background
    ctx.fillStyle = `rgb(${bg.r},${bg.g},${bg.b})`;
    ctx.fillRect(0, 0, RENDER_SIZE, RENDER_SIZE);

    // Foreground cells
    ctx.fillStyle = `rgb(${fg.r},${fg.g},${fg.b})`;
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_ROWS; col++) {
            if (grid[row]![col] === 1) {
                ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }

    return canvas.toDataURL('image/png');
}

/**
 * Generate a collection-level icon from a contract address hex string.
 * Uses the first 4 bytes of the address as a seed.
 */
export function generateCollectionIcon(addressHex: string): string {
    const clean = addressHex.startsWith('0x') ? addressHex.slice(2) : addressHex;
    const seed = parseInt(clean.slice(0, 8), 16) || 0;
    return generateTokenImage(BigInt(seed));
}
