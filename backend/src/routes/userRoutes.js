import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getRecommendationHistory } from '../controllers/userController.js';

const router = Router();

router.use(protect);

router.get('/recommendation-history', getRecommendationHistory);

export default router;
