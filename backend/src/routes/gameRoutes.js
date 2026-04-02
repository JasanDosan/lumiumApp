import { Router } from 'express';
import { search, getTrending, getTopRated, getByCategory, getMultiCategory } from '../controllers/gameController.js';

const router = Router();

// GET /api/games/search?q=QUERY&count=N
router.get('/search', search);

// GET /api/games/trending?count=N
router.get('/trending', getTrending);

// GET /api/games/top-rated?count=N
router.get('/top-rated', getTopRated);

// GET /api/games/by-category?category=CATEGORY_ID&count=N
router.get('/by-category', getByCategory);

// GET /api/games/multi-category?categories=rpg,horror&count=40
router.get('/multi-category', getMultiCategory);

export default router;
