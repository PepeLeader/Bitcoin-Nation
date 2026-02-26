export function getVoteScore(votes: Record<string, 1 | -1>): number {
    let score = 0;
    for (const v of Object.values(votes)) {
        score += v;
    }
    return score;
}
