import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  getRecommendationHistory,
} from '../controllers/userController.js';

const router = Router();

router.use(protect); // all user routes are protected

router.get('/favorites', getFavorites);
router.post('/favorites', addFavorite);
router.delete('/favorites/:tmdbId', removeFavorite);
router.get('/recommendation-history', getRecommendationHistory);

export default router;
