import { computeEloChange, getBotRating } from '../services/elo.service';

describe('computeEloChange', () => {
  describe('win', () => {
    it('gains rating when beating an equal opponent', () => {
      const { delta, newRating } = computeEloChange(1200, 1200, 1);
      // Expected score = 0.5, actual = 1 → gain ≈ +16
      expect(delta).toBe(16);
      expect(newRating).toBe(1216);
    });

    it('gains more rating when beating a stronger opponent', () => {
      const { delta } = computeEloChange(1200, 1600, 1);
      // Expected score very low → large gain
      expect(delta).toBeGreaterThan(25);
    });

    it('gains less rating when beating a much weaker opponent', () => {
      const { delta } = computeEloChange(1600, 1200, 1);
      // Expected score very high → small gain
      expect(delta).toBeGreaterThan(0);
      expect(delta).toBeLessThan(10);
    });
  });

  describe('loss', () => {
    it('loses rating when losing to an equal opponent', () => {
      const { delta, newRating } = computeEloChange(1200, 1200, 0);
      // Expected score = 0.5, actual = 0 → lose ≈ -16
      expect(delta).toBe(-16);
      expect(newRating).toBe(1184);
    });

    it('loses less when losing to a much stronger opponent', () => {
      const { delta } = computeEloChange(1200, 1600, 0);
      expect(delta).toBeGreaterThan(-10);
      expect(delta).toBeLessThan(0);
    });

    it('loses more when losing to a much weaker opponent', () => {
      const { delta } = computeEloChange(1600, 1200, 0);
      expect(delta).toBeLessThan(-25);
    });
  });

  describe('draw', () => {
    it('no change for draw between equal players', () => {
      const { delta, newRating } = computeEloChange(1200, 1200, 0.5);
      expect(delta).toBe(0);
      expect(newRating).toBe(1200);
    });

    it('gains rating for draw against stronger opponent', () => {
      const { delta } = computeEloChange(1000, 1600, 0.5);
      expect(delta).toBeGreaterThan(0);
    });

    it('loses rating for draw against weaker opponent', () => {
      const { delta } = computeEloChange(1600, 1000, 0.5);
      expect(delta).toBeLessThan(0);
    });
  });

  describe('rating floor', () => {
    it('never goes below 100', () => {
      const { newRating } = computeEloChange(105, 2500, 0);
      expect(newRating).toBeGreaterThanOrEqual(100);
    });

    it('floor does not affect delta reporting', () => {
      // delta is raw change before floor, newRating is clamped
      const { newRating } = computeEloChange(100, 2500, 0);
      expect(newRating).toBe(100);
    });
  });

  describe('custom K-factor', () => {
    it('uses K=16 for experienced players', () => {
      const withK32 = computeEloChange(1200, 1200, 1, 32);
      const withK16 = computeEloChange(1200, 1200, 1, 16);
      expect(withK16.delta).toBe(Math.round(withK32.delta / 2));
    });
  });
});

describe('getBotRating', () => {
  it('returns 800 for level 1', () => {
    expect(getBotRating(1)).toBe(800);
  });

  it('returns 2500 for level 20', () => {
    expect(getBotRating(20)).toBe(2500);
  });

  it('returns increasing ratings for increasing levels', () => {
    for (let lvl = 1; lvl < 20; lvl++) {
      expect(getBotRating(lvl)).toBeLessThanOrEqual(getBotRating(lvl + 1));
    }
  });

  it('falls back to 1200 for unknown level', () => {
    expect(getBotRating(99)).toBe(1200);
  });
});
