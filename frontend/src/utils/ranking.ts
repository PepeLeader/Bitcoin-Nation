/**
 * Rank-based scoring: 1st place gets maxPoints, 2nd gets maxPoints-1, etc.
 * Ties share the same rank (and points). Scores floor at 0.
 */
export function assignRankPoints<T>(
    items: readonly T[],
    getValue: (item: T) => number,
    maxPoints: number,
): readonly number[] {
    const indexed = items.map((item, i) => ({ i, val: getValue(item) }));
    indexed.sort((a, b) => b.val - a.val);

    const points = new Array<number>(items.length).fill(0);
    let currentRank = 0;
    let prevVal: number | null = null;

    for (const entry of indexed) {
        if (prevVal === null || entry.val < prevVal) {
            currentRank = prevVal === null ? 0 : currentRank + 1;
            prevVal = entry.val;
        }
        points[entry.i] = Math.max(0, maxPoints - currentRank);
    }

    return points;
}

export const VOLUME_MAX = 60;
export const HOLDERS_MAX = 25;
export const ENGAGEMENT_MAX = 15;
