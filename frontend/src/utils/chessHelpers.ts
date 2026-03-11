import { Chess, Square } from 'chess.js';

/**
 * Returns the destination squares of all legal moves from `square`
 * in the given chess position. Returns [] if the square is empty or has no moves.
 */
export function getLegalMoveSquares(chess: Chess, square: Square): Square[] {
  return chess.moves({ square, verbose: true }).map((m) => m.to as Square);
}

/**
 * Returns true if `square` contains a piece belonging to the side whose
 * turn it is to move.
 */
export function isOwnPiece(chess: Chess, square: Square): boolean {
  const piece = chess.get(square);
  return !!piece && piece.color === chess.turn();
}
