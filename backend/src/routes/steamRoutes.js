import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { importGames } from '../controllers/steamController.js';

const router = Router();

// All Steam routes require authentication — Steam data is personal
router.use(protect);

// POST /api/steam/import
// Body: { steamInput: string }
router.post('/import', importGames);

export default router;
