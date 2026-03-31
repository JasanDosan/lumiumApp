import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  search,
  searchMulti,
  getTrending,
  getPopular,
  getDetails,
  getSimilar,
  getRecommendations,
  getMovieTmdbRecs,
  getMovieCollection,
  getGenres,
  discover,
  getProviders,
} from '../controllers/movieController.js';

const router = Router();

// Static routes MUST come before /:id to avoid Express matching as an id param
router.get('/search', search);
router.get('/search/multi', searchMulti);
router.get('/trending', getTrending);
router.get('/popular', getPopular);
router.get('/genres', getGenres);
router.get('/discover', discover);
router.get('/recommendations/me', protect, getRecommendations);
router.get('/providers', getProviders);
router.get('/collection/:id', getMovieCollection);

// Dynamic routes last
router.get('/:id', getDetails);
router.get('/:id/similar', getSimilar);
router.get('/:id/recommendations', getMovieTmdbRecs);

export default router;
