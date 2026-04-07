import { Router } from 'express';
import { getTrending, getPopular, discoverTV, getDetails, getSimilar } from '../controllers/tvController.js';

const router = Router();

// Static paths must come before /:id param routes
router.get('/trending', getTrending);
router.get('/popular',  getPopular);
router.get('/discover', discoverTV);

// Specific sub-path before generic /:id
router.get('/:id/similar', getSimilar);
router.get('/:id',         getDetails);

export default router;
