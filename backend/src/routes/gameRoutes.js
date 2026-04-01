import { Router } from 'express';
import { search, getTrending, getTopRated } from '../controllers/gameController.js';

const router = Router();

// GET /api/games/search?q=QUERY&count=N
router.get('/search', search);

// GET /api/games/trending?count=N
router.get('/trending', getTrending);

// GET /api/games/top-rated?count=N
router.get('/top-rated', getTopRated);

export default router;
