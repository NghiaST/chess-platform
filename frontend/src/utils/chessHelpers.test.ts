import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { getLegalMoveSquares, isOwnPiece } from './chessHelpers';

describe('getLegalMoveSquares', () => {
  it('returns pawn push squares from starting position', () => {
    const chess = new Chess();
    const squares = getLegalMoveSquares(chess, 'e2');
    expect(squares).toContain('e3');
    expect(squares).toContain('e4');
    expect(squares).toHaveLength(2);
  });

  it('returns knight jump squares from starting position', () => {
    const chess = new Chess();
    const squares = getLegalMoveSquares(chess, 'b1');
    expect(squares).toContain('a3');
    expect(squares).toContain('c3');
    expect(squares).toHaveLength(2);
  });

  it('returns empty array for an empty square', () => {
    const chess = new Chess();
    const squares = getLegalMoveSquares(chess, 'e4');
    expect(squares).toHaveLength(0);
  });

  it('returns restricted squares for a pinned piece', () => {
    // White king on e1, white rook on e2, black rook on e8, black king on a8
    // The white rook on e2 is pinned to the e-file by the black rook on e8
    const chess = new Chess('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1');
    const squares = getLegalMoveSquares(chess, 'e2');
    // Pinned rook can only move along the pin axis (e-file)
    for (const sq of squares) {
      expect(sq[0]).toBe('e');
    }
  });
});

describe('isOwnPiece', () => {
  it('returns true for a piece of the side to move', () => {
    const chess = new Chess();
    expect(isOwnPiece(chess, 'e2')).toBe(true); // white pawn, white to move
  });

  it('returns false for an opponent piece', () => {
    const chess = new Chess();
    expect(isOwnPiece(chess, 'e7')).toBe(false); // black pawn, white to move
  });

  it('returns false for an empty square', () => {
    const chess = new Chess();
    expect(isOwnPiece(chess, 'e4')).toBe(false);
  });
});
