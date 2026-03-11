// ELO pseudo-ratings for each bot difficulty level
const BOT_RATINGS: Record<number, number> = {
  1: 800,
  2: 900,
  3: 1000,
  4: 1100,
  5: 1200,
  6: 1300,
  7: 1400,
  8: 1500,
  9: 1600,
  10: 1700,
  11: 1750,
  12: 1800,
  13: 1850,
  14: 1900,
  15: 1950,
  16: 2000,
  17: 2100,
  18: 2200,
  19: 2300,
  20: 2500,
};

export function getBotRating(botLevel: number): number {
  return BOT_RATINGS[botLevel] ?? 1200;
}

/**
 * Compute the ELO change for a player after a game.
 * @param playerRating   Current rating of the player
 * @param opponentRating Current rating of the opponent (or bot pseudo-rating)
 * @param score          1.0 = win, 0.5 = draw, 0.0 = loss
 * @param k              Development coefficient (default K=32)
 * @returns newRating and the rounded integer delta
 */
export function computeEloChange(
  playerRating: number,
  opponentRating: number,
  score: number,
  k = 32,
): { newRating: number; delta: number } {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const change = Math.round(k * (score - expected));
  const newRating = Math.max(100, playerRating + change);
  return { newRating, delta: newRating - playerRating };
}
