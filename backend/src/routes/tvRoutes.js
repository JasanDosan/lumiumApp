import { Router } from 'express';
import { getTrending, getPopular, discoverTV } from '../controllers/tvController.js';

const router = Router();

router.get('/trending', getTrending);
router.get('/popular', getPopular);
router.get('/discover', discoverTV);

export default router;
