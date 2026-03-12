import { Router } from 'express';
import { analysisController } from '../controllers/analysis.controller';

const router = Router();

// POST /api/analysis — analyse a FEN position (no auth required)
router.post('/', analysisController.analyze.bind(analysisController));

export default router;
