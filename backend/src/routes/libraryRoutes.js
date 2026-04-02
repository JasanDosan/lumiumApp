import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getLibrary,
  addToLibrary,
  removeFromLibrary,
  updateLibraryItem,
} from '../controllers/libraryController.js';

const router = Router();

router.use(protect); // all library routes require auth

router.get('/', getLibrary);
router.post('/', addToLibrary);
router.delete('/:id', removeFromLibrary);
router.put('/:id', updateLibraryItem);

export default router;
