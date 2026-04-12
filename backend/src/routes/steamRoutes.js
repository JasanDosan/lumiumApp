import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  importGames,
  syncLibrary,
  syncRecent,
  getProfile,
  getLibrary,
  getRecent,
  getTasteProfile,
} from '../controllers/steamController.js';

const router = Router();

// All Steam routes require authentication — Steam data is personal
router.use(protect);

// ── Read-only ────────────────────────────────────────────────────────────────
router.get('/profile',       getProfile);       // GET  /api/steam/profile
router.get('/library',       getLibrary);       // GET  /api/steam/library
router.get('/recent',        getRecent);        // GET  /api/steam/recent
router.get('/taste-profile', getTasteProfile);  // GET  /api/steam/taste-profile

// ── Write / sync ─────────────────────────────────────────────────────────────
router.post('/import',       importGames);      // POST /api/steam/import       (manual steamInput)
router.post('/sync-library', syncLibrary);      // POST /api/steam/sync-library (uses connected steamId)
router.post('/sync-recent',  syncRecent);       // POST /api/steam/sync-recent

export default router;
