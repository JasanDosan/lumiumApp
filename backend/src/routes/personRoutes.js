import { Router } from 'express';
import { getPerson } from '../controllers/personController.js';

const router = Router();

router.get('/:id', getPerson);

export default router;
