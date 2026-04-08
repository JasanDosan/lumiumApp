/**
 * Validates required environment variables at startup.
 * Fails fast with a clear message instead of cryptic runtime errors.
 */
const REQUIRED = [
  'MONGO_URI',
  'JWT_SECRET',
  'TMDB_API_KEY',
  'TMDB_BASE_URL',
  'RAWG_API_KEY',
  'RAWG_BASE_URL',
];

export const validateEnv = () => {
  const missing = REQUIRED.filter(key => !process.env[key]);
  if (missing.length) {
    console.error(`\n❌ Missing required environment variables:\n  ${missing.join('\n  ')}`);
    console.error('Copy .env.example to .env and fill in the values.\n');
    process.exit(1);
  }

  if (process.env.JWT_SECRET === 'your_super_secret_jwt_key_change_this_in_production') {
    console.warn('⚠️  WARNING: Using default JWT_SECRET. Change it before deploying.');
  }

  if (!process.env.STEAM_API_KEY) {
    console.warn('⚠️  STEAM_API_KEY not set — Steam import will be unavailable.');
  }
};
