import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe } from '../controllers/authController.js';
import {
  steamLogin,
  steamCallback,
  steamDisconnect,
} from '../controllers/authSteamController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.get('/me', protect, getMe);

// ─── Steam OpenID account linking ─────────────────────────────────────────────
// GET  /api/auth/steam/login        → initiates OpenID flow (needs ?token=<jwt>)
// GET  /api/auth/steam/callback     → Steam redirect target; verifies & saves
// POST /api/auth/steam/disconnect   → unlinks Steam from the authenticated user
router.get('/steam/login',       steamLogin);
router.get('/steam/callback',    steamCallback);
router.post('/steam/disconnect', protect, steamDisconnect);

export default router;
