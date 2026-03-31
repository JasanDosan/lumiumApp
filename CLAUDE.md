# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (`frontend/`)
```bash
npm run dev      # Start Vite dev server on port 5173
npm run build    # Production build
npm run lint     # ESLint (max-warnings 0 — treat warnings as errors)
```

### Backend (`backend/`)
```bash
npm run dev      # Nodemon with auto-reload
npm run start    # Production start
npm test         # Jest with coverage
```

Both servers must run simultaneously for development. The Vite dev server proxies `/api/*` to `http://localhost:5000`.

## Environment Setup

**Backend** requires `backend/.env`:
```
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/appmovies
JWT_SECRET=<any_secret>
JWT_EXPIRES_IN=7d
TMDB_API_KEY=<tmdb_key>
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p
CLIENT_URL=http://localhost:5173
```

**Frontend** requires `frontend/.env`:
```
VITE_API_BASE_URL=http://localhost:5000/api
```

## Architecture

### Monorepo Layout
Two independent Node apps — `frontend/` (React/Vite) and `backend/` (Express/MongoDB) — with no shared packages.

### Frontend

**Path alias**: `@` → `src/` (configured in `vite.config.js`). Use `@/` for all non-relative imports.

**State management**: Zustand stores in `src/features/*/` co-located with their feature. Two stores:
- `authStore` — user session, calls `authService`, writes token to `tokenStore`
- `favoritesStore` — persists to backend when authenticated, falls back to `localStorage` when not

**Circular dependency pattern**: `api.js` needs the JWT token but importing `authStore` creates a circular dep. Solution: `src/services/tokenStore.js` is a plain module (no Zustand) that holds the token in memory. `api.js` imports `tokenStore` directly; `authStore` writes to `tokenStore` after login.

**API layer**: `src/services/api.js` is an Axios instance with two interceptors:
1. Request: injects `Authorization: Bearer <token>` from `tokenStore`
2. Response: on 401, clears token and triggers logout via a lazy `import()` of `authStore` (avoids circular dep at module load time)

**Tailwind v3 JIT gotcha**: Custom color utilities (e.g. `bg-canvas`, `text-ink`) are only available in JSX/component files. In `src/index.css`, use `theme('colors.ink.DEFAULT')` inside `@layer base` — NOT `@apply text-ink`. The JIT doesn't process `@apply` for custom utilities in the base layer at startup.

**Feature structure**: `src/features/<name>/` contains the page component, store, and any feature-specific subcomponents. Shared UI lives in `src/components/ui/`.

**Design system** (A24-inspired minimal):
- Background: `bg-canvas` (#fafafa), surfaces: `bg-white`
- Text: `text-ink` (#111), `text-ink-mid` (#6b6b6b), `text-ink-light` (#a0a0a0)
- Borders: `border-line` (#e5e5e5)
- Font: Inter only — no serif anywhere
- MovieCards: poster + title only, no container box, hover scale effect
- Primary button: `bg-ink text-white rounded-full`

**Rate limit protection** (frontend): TMDB calls that fire on mount must be staggered. Use sequential loading with `setTimeout(fn, i * 300)` delays, not `Promise.all`. Use a `useRef(false)` guard (`fetchedRef`) to prevent double-fetch in React StrictMode.

### Backend

**TMDB integration**: All external calls go through `src/services/tmdbService.js`, which has a retry interceptor (3 retries, exponential backoff) for 429/5xx responses. All movie data is normalized via `normalizeMovie()` before being returned — never pass raw TMDB objects to the client.

**Route ordering**: In `movieRoutes.js`, static path segments must come before `/:id` params. Current order: `/search`, `/search/multi`, `/trending`, `/popular`, `/genres`, `/discover`, `/recommendations/me`, `/providers`, `/collection/:id`, then `/:id`, `/:id/similar`, `/:id/recommendations`.

**Auth middleware**: `protect` from `src/middleware/authMiddleware.js` — attach to any route that requires a logged-in user. Verified user is on `req.user`.

**Data model**: Single `User` model with embedded `favorites[]` (no separate Favorites collection). Favorites contain denormalized movie data (`tmdbId`, `title`, `posterPath`, `rating`) so movie details pages don't need DB lookups.

**Recommendation scoring**:
```
score = (crossHits × 3) + (bayesianRating × 2) + (log10(popularity+1)/log10(1001)×10)
```
Bayesian rating: `(v/(v+500)) × R + (500/(v+500)) × 6.5` — smooths ratings for low vote-count movies. Results cached in `user.recommendationHistory`.

### Routes (full list)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | ✓ | Current user |
| GET | `/api/movies/search?q=&page=` | — | Movie search |
| GET | `/api/movies/search/multi?q=` | — | Movies + people (TMDB multi) |
| GET | `/api/movies/trending` | — | Trending this week |
| GET | `/api/movies/popular` | — | Popular movies |
| GET | `/api/movies/genres` | — | Genre list |
| GET | `/api/movies/discover` | — | Filtered discover (genres, year, rating, provider, person) |
| GET | `/api/movies/recommendations/me` | ✓ | Personalized recs |
| GET | `/api/movies/providers?region=US` | — | Watch providers by region |
| GET | `/api/movies/collection/:id` | — | Movie collection/saga |
| GET | `/api/movies/:id` | — | Movie details (credits, videos) |
| GET | `/api/movies/:id/similar` | — | Similar movies |
| GET | `/api/movies/:id/recommendations` | — | TMDB recommendations for movie |
| GET | `/api/people/:id` | — | Person details + filmography |
| GET/POST/DELETE | `/api/users/favorites` | ✓ | Manage favorites |
