import { Request, Response, NextFunction } from 'express';
import { Chess } from 'chess.js';
import { analyzePosition } from '../services/bot.service';

export class AnalysisController {
  /**
   * POST /api/analysis
   * Body: { fen: string; numLines?: number; quick?: boolean }
   *
   * Returns top `numLines` engine lines for the given FEN with centipawn scores
   * and an overall evaluation (white-relative).
   *
   * Set quick=true for a fast one-line evaluation (movetime 350ms) used by the
   * evaluation bar in standard/practice mode.  Default is a full analysis
   * (movetime 2500ms) used by the study panel.
   */
  async analyze(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fen, numLines, quick } = req.body as {
        fen?: unknown;
        numLines?: unknown;
        quick?: unknown;
      };

      if (!fen || typeof fen !== 'string') {
        res.status(400).json({ status: 'error', message: 'fen is required' });
        return;
      }

      // Validate FEN with chess.js
      try {
        new Chess(fen);
      } catch {
        res.status(400).json({ status: 'error', message: 'Invalid FEN string' });
        return;
      }

      const isQuick = quick === true || quick === 'true';
      const lines = isQuick ? 1 : Math.min(Math.max(1, parseInt(String(numLines ?? '3')) || 3), 5);
      const movetime = isQuick ? 350 : 2500;

      const analysisLines = await analyzePosition(fen, lines, movetime);

      const evaluation = analysisLines.length > 0 ? analysisLines[0].score : 0;
      const mate = analysisLines.length > 0 ? analysisLines[0].mate : null;

      res.json({
        status: 'ok',
        data: { lines: analysisLines, evaluation, mate },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const analysisController = new AnalysisController();
