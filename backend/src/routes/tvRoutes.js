import { Router } from 'express';
import { getTrending, getPopular } from '../controllers/tvController.js';

const router = Router();

router.get('/trending', getTrending);
router.get('/popular', getPopular);

export default router;
