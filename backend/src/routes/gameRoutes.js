import { Router } from 'express';
import {
  search,
  getTrending,
  getTopRated,
  getByCategory,
  getMultiCategory,
  getDetails,
  getSimilar,
} from '../controllers/gameController.js';

const router = Router();

// ── Static routes first (must come before /:id) ───────────────────────────────

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

// ── Param routes last ─────────────────────────────────────────────────────────

// GET /api/games/:id/similar  — must come before /:id
router.get('/:id/similar', getSimilar);

// GET /api/games/:id  — full RAWG game detail
router.get('/:id', getDetails);

export default router;
