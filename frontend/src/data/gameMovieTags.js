/**
 * Game → Movie "Mood Transfer" catalog.
 *
 * Architecture:
 *   1. Each game defines a `meta` object describing its CONCEPT (theme, mood, pacing).
 *   2. translateMetaToTMDB() converts meta-tags → TMDB discover params.
 *
 * This decoupling means:
 *   - You can add new games without knowing any TMDB genre IDs.
 *   - You can tune the translation algorithm independently of the catalog.
 *   - Future: swap meta-tags for IGDB API data automatically.
 */

// ── TMDB genre reference ──────────────────────────────────────────────────────
// 28 Action  | 12 Adventure | 16 Animation | 35 Comedy  | 80 Crime
// 99 Doc     | 18 Drama     | 10751 Family | 14 Fantasy | 36 History
// 27 Horror  | 9648 Mystery | 10749 Romance| 878 Sci-Fi | 53 Thriller
// 10752 War  | 37 Western

// ── Theme tag → TMDB genre IDs ────────────────────────────────────────────────
// Primary genre listed first; secondary (if any) listed second.
const THEME_TO_GENRES = {
  zombies:      [27, 53],    // Horror, Thriller
  survival:     [53],        // Thriller
  horror:       [27],        // Horror
  sci_fi:       [878],       // Sci-Fi
  space:        [878],       // Sci-Fi
  war:          [10752, 28], // War, Action
  crime:        [80],        // Crime
  fantasy:      [14],        // Fantasy
  mystery:      [9648],      // Mystery
  western:      [37],        // Western
  history:      [36],        // History
  animation:    [16],        // Animation
  stealth:      [53, 28],    // Thriller, Action
  conspiracy:   [53, 80],    // Thriller, Crime
  exploration:  [12],        // Adventure
  politics:     [18, 53],    // Drama, Thriller
  noir:         [80, 18],    // Crime, Drama
  cyberpunk:    [878, 80],   // Sci-Fi, Crime
  supernatural: [27, 14],    // Horror, Fantasy
  dystopia:     [878, 53],   // Sci-Fi, Thriller
  mythology:    [14, 12],    // Fantasy, Adventure
  comedy:       [35],        // Comedy
  drama:        [18],        // Drama
  adventure:    [12],        // Adventure
  action:       [28],        // Action
  time_loop:    [9648, 878], // Mystery, Sci-Fi
  narrative:    [18],        // Drama
};

// ── Mood tag sets used by translateMetaToTMDB ─────────────────────────────────
const QUALITY_MOODS  = new Set(['tension', 'dark', 'bleak', 'melancholic', 'contemplative', 'wonder', 'realism', 'prestige', 'dark_humor']);
const POPULAR_MOODS  = new Set(['epic', 'explosive', 'fun']);

// ── translateMetaToTMDB ───────────────────────────────────────────────────────

/**
 * Converts a game's meta-tags into TMDB discover parameters.
 *
 * Algorithm:
 *   1. Collects TMDB genre IDs from theme tags (primary genres first, then secondary).
 *      De-duplicates and caps at 3 genres.
 *   2. Determines sort_by: epic/fun/explosive → popularity.desc; otherwise vote_average.desc.
 *   3. Computes rating_gte floor based on mood intensity.
 *      `prestige` overrides to 7.5; explosive/fun caps at 5.5.
 *
 * @param {{ theme?: string[], mood?: string[], pacing?: string[] }} meta
 * @returns {{ genres: number[], sort_by: string, rating_gte: number }}
 */
export function translateMetaToTMDB(meta) {
  const { theme = [], mood = [], pacing = [] } = meta;

  // ── 1. Build genre list: primary genres first, then secondary ─────────────
  const primary   = [];
  const secondary = [];
  for (const t of theme) {
    const ids = THEME_TO_GENRES[t] ?? [];
    if (ids[0] != null && !primary.includes(ids[0]))   primary.push(ids[0]);
    if (ids[1] != null && !secondary.includes(ids[1])) secondary.push(ids[1]);
  }
  const genres = [...new Set([...primary, ...secondary])].slice(0, 3);

  // ── 2. Determine sort_by ──────────────────────────────────────────────────
  // "Popular" moods win if present (blockbuster intent overrides quality intent).
  const wantsPopular = mood.some(m => POPULAR_MOODS.has(m));
  const sort_by = wantsPopular ? 'popularity.desc' : 'vote_average.desc';

  // ── 3. Determine rating_gte floor ─────────────────────────────────────────
  let rating_gte = 6.0;

  if (mood.some(m => ['bleak', 'tension', 'dark'].includes(m))) {
    rating_gte = Math.max(rating_gte, 6.5);
  }
  if (
    mood.some(m => ['realism', 'melancholic', 'contemplative', 'wonder'].includes(m)) ||
    pacing.some(p => ['slow', 'meditative'].includes(p))
  ) {
    rating_gte = Math.max(rating_gte, 7.0);
  }
  if (mood.includes('prestige')) {
    rating_gte = Math.max(rating_gte, 7.5);
  }
  // High-energy moods → lower the floor to catch more blockbusters
  if (mood.some(m => ['explosive', 'fun'].includes(m))) {
    rating_gte = Math.min(rating_gte, 5.5);
  }

  return { genres, sort_by, rating_gte };
}

// ── Game Catalog ──────────────────────────────────────────────────────────────

export const GAME_CATALOG = [
  // ── Horror / Survival ──────────────────────────────────────────────────────
  {
    id: 'project-zomboid',
    name: 'Project Zomboid',
    emoji: '🧟',
    tagline: 'Gritty survival in a world gone wrong',
    meta: {
      theme: ['zombies', 'survival', 'horror'],
      mood:  ['tension', 'bleak', 'realism'],
      pacing: ['slow', 'high_stakes'],
    },
  },
  {
    id: 'resident-evil',
    name: 'Resident Evil',
    emoji: '🦠',
    tagline: 'Biological horror and desperate escapes',
    meta: {
      theme: ['zombies', 'horror', 'action'],
      mood:  ['tension', 'dark', 'fun'],
      pacing: ['fast', 'high_stakes'],
    },
  },
  {
    id: 'silent-hill',
    name: 'Silent Hill',
    emoji: '🌫️',
    tagline: 'Psychological dread and fractured reality',
    meta: {
      theme: ['horror', 'mystery', 'supernatural'],
      mood:  ['dark', 'contemplative', 'bleak', 'prestige'],
      pacing: ['slow', 'meditative'],
    },
  },
  {
    id: 'dead-space',
    name: 'Dead Space',
    emoji: '👁️',
    tagline: 'Isolation and terror in deep space',
    meta: {
      theme: ['sci_fi', 'horror', 'survival'],
      mood:  ['tension', 'dark', 'bleak'],
      pacing: ['slow', 'high_stakes'],
    },
  },

  // ── Action / Shooter ───────────────────────────────────────────────────────
  {
    id: 'doom',
    name: 'Doom',
    emoji: '💀',
    tagline: 'Relentless, visceral, extreme action',
    meta: {
      theme: ['action', 'horror'],
      mood:  ['explosive', 'fun', 'dark'],
      pacing: ['fast', 'relentless'],
    },
  },
  {
    id: 'halo',
    name: 'Halo',
    emoji: '🪖',
    tagline: 'Epic sci-fi warfare across the stars',
    meta: {
      theme: ['sci_fi', 'war', 'action'],
      mood:  ['epic', 'tension'],
      pacing: ['fast', 'high_stakes'],
    },
  },
  {
    id: 'call-of-duty',
    name: 'Call of Duty',
    emoji: '🎖️',
    tagline: 'Intense military operations under fire',
    meta: {
      theme: ['war', 'action'],
      mood:  ['tension', 'realism', 'epic'],
      pacing: ['fast', 'high_stakes'],
    },
  },
  {
    id: 'metal-gear-solid',
    name: 'Metal Gear Solid',
    emoji: '🐍',
    tagline: 'Cinematic stealth and political conspiracy',
    meta: {
      theme: ['stealth', 'conspiracy', 'politics'],
      mood:  ['tension', 'contemplative', 'dark', 'prestige'],
      pacing: ['slow', 'high_stakes'],
    },
  },

  // ── Open World / Crime ─────────────────────────────────────────────────────
  {
    id: 'gta-v',
    name: 'GTA V',
    emoji: '🚗',
    tagline: 'Crime, chaos and modern American satire',
    meta: {
      theme: ['crime', 'action', 'noir'],
      mood:  ['fun', 'dark', 'explosive'],
      pacing: ['fast'],
    },
  },
  {
    id: 'rdr2',
    name: 'Red Dead Redemption 2',
    emoji: '🤠',
    tagline: 'Honor, loss and the dying American frontier',
    meta: {
      theme: ['western', 'drama'],
      mood:  ['melancholic', 'realism', 'bleak', 'prestige'],
      pacing: ['slow', 'meditative'],
    },
  },
  {
    id: 'cyberpunk-2077',
    name: 'Cyberpunk 2077',
    emoji: '🤖',
    tagline: 'Neon dystopia, corpo power and rebellion',
    meta: {
      theme: ['cyberpunk', 'crime', 'dystopia'],
      mood:  ['dark', 'tension', 'explosive'],
      pacing: ['fast', 'high_stakes'],
    },
  },

  // ── RPG / Fantasy ──────────────────────────────────────────────────────────
  {
    id: 'the-witcher-3',
    name: 'The Witcher 3',
    emoji: '🗡️',
    tagline: 'Morally complex dark fantasy and folklore',
    meta: {
      theme: ['fantasy', 'drama', 'mystery'],
      mood:  ['dark', 'contemplative', 'tension'],
      pacing: ['slow', 'high_stakes'],
    },
  },
  {
    id: 'dark-souls',
    name: 'Dark Souls',
    emoji: '⚔️',
    tagline: 'Bleak worlds where perseverance is everything',
    meta: {
      theme: ['fantasy', 'drama'],
      mood:  ['bleak', 'contemplative', 'dark', 'prestige'],
      pacing: ['slow', 'meditative'],
    },
  },
  {
    id: 'skyrim',
    name: 'Skyrim',
    emoji: '🏔️',
    tagline: 'Grand adventure in vast, mythical lands',
    meta: {
      theme: ['fantasy', 'adventure', 'mythology'],
      mood:  ['epic', 'wonder'],
      pacing: ['slow', 'exploratory'],
    },
  },
  {
    id: 'baldurs-gate-3',
    name: "Baldur's Gate 3",
    emoji: '🎲',
    tagline: 'Choice-driven storytelling and epic ensemble casts',
    meta: {
      theme: ['fantasy', 'drama', 'adventure'],
      mood:  ['contemplative', 'dark', 'epic', 'prestige'],
      pacing: ['slow', 'high_stakes'],
    },
  },

  // ── Sci-Fi / Space ─────────────────────────────────────────────────────────
  {
    id: 'no-mans-sky',
    name: "No Man's Sky",
    emoji: '🪐',
    tagline: 'Meditative exploration of alien worlds',
    meta: {
      theme: ['sci_fi', 'exploration'],
      mood:  ['wonder', 'melancholic', 'contemplative'],
      pacing: ['slow', 'meditative'],
    },
  },
  {
    id: 'mass-effect',
    name: 'Mass Effect',
    emoji: '🚀',
    tagline: 'Operatic sci-fi with crew loyalty at its core',
    meta: {
      theme: ['sci_fi', 'action', 'adventure'],
      mood:  ['tension', 'melancholic', 'contemplative'],
      pacing: ['fast', 'high_stakes'],
    },
  },
  {
    id: 'portal',
    name: 'Portal',
    emoji: '🔵',
    tagline: 'Dark wit, puzzle logic and AI gone rogue',
    meta: {
      theme: ['sci_fi', 'comedy'],
      mood:  ['dark_humor', 'tension', 'wonder', 'prestige'],
      pacing: ['slow', 'meditative'],
    },
  },
  {
    id: 'outer-wilds',
    name: 'Outer Wilds',
    emoji: '☄️',
    tagline: 'Mystery, time loops and existential wonder',
    meta: {
      theme: ['sci_fi', 'mystery', 'time_loop'],
      mood:  ['wonder', 'melancholic', 'contemplative', 'prestige'],
      pacing: ['slow', 'meditative'],
    },
  },

  // ── Strategy / Historical ──────────────────────────────────────────────────
  {
    id: 'civilization',
    name: 'Civilization VI',
    emoji: '🏛️',
    tagline: 'The sweep of human history and power',
    meta: {
      theme: ['history', 'war', 'politics'],
      mood:  ['realism', 'contemplative'],
      pacing: ['slow', 'strategic'],
    },
  },
  {
    id: 'age-of-empires',
    name: 'Age of Empires',
    emoji: '🏰',
    tagline: 'Conquest, empire-building and ancient warfare',
    meta: {
      theme: ['history', 'war', 'adventure'],
      mood:  ['epic', 'realism'],
      pacing: ['fast', 'high_stakes'],
    },
  },
  {
    id: 'crusader-kings',
    name: 'Crusader Kings III',
    emoji: '👑',
    tagline: 'Dynastic intrigue, betrayal and medieval politics',
    meta: {
      theme: ['history', 'politics', 'drama'],
      mood:  ['dark', 'contemplative', 'realism'],
      pacing: ['slow', 'strategic'],
    },
  },

  // ── Indie / Narrative ──────────────────────────────────────────────────────
  {
    id: 'journey',
    name: 'Journey',
    emoji: '🏜️',
    tagline: 'Wordless beauty and transcendent wonder',
    meta: {
      theme: ['adventure', 'drama', 'exploration'],
      mood:  ['wonder', 'melancholic', 'contemplative', 'prestige'],
      pacing: ['slow', 'meditative'],
    },
  },
  {
    id: 'undertale',
    name: 'Undertale',
    emoji: '❤️',
    tagline: 'Subversive storytelling and unexpected empathy',
    meta: {
      theme: ['animation', 'fantasy', 'narrative'],
      mood:  ['wonder', 'melancholic', 'dark_humor', 'prestige'],
      pacing: ['slow', 'emotional'],
    },
  },
  {
    id: 'minecraft',
    name: 'Minecraft',
    emoji: '⛏️',
    tagline: 'Creativity, discovery and building worlds',
    meta: {
      theme: ['adventure', 'fantasy', 'exploration'],
      mood:  ['wonder', 'fun'],
      pacing: ['slow', 'meditative'],
    },
  },
  {
    id: 'disco-elysium',
    name: 'Disco Elysium',
    emoji: '🥃',
    tagline: 'Political noir, failure and the search for meaning',
    meta: {
      theme: ['noir', 'politics', 'mystery'],
      mood:  ['dark', 'contemplative', 'melancholic', 'prestige'],
      pacing: ['slow', 'meditative'],
    },
  },
];

// ── Part 4: Inverse recommendation stubs (Movie → Game) ──────────────────────
// Foundation for suggesting games based on a movie's themes/mood.
// UI not yet implemented — structure is ready for a future /movie/:id sidebar.

export const MOVIE_TO_GAME_HINTS = [
  {
    movieMeta: { theme: ['zombies', 'survival', 'post_apocalyptic'] },
    suggestedGames: ['project-zomboid', 'resident-evil'],
    reason: "Survival horror that mirrors the film's tension",
  },
  {
    movieMeta: { theme: ['sci_fi', 'space', 'exploration'] },
    suggestedGames: ['no-mans-sky', 'mass-effect', 'outer-wilds'],
    reason: 'Expansive space to get lost in after the film',
  },
  {
    movieMeta: { theme: ['crime', 'noir', 'urban'] },
    suggestedGames: ['gta-v', 'disco-elysium'],
    reason: 'Same moral ambiguity, interactive form',
  },
  {
    movieMeta: { theme: ['western', 'frontier'] },
    suggestedGames: ['rdr2'],
    reason: 'Live the frontier — not just watch it',
  },
  {
    movieMeta: { theme: ['fantasy', 'medieval', 'epic'] },
    suggestedGames: ['the-witcher-3', 'baldurs-gate-3', 'skyrim'],
    reason: 'Immersive worlds that expand the fantasy',
  },
  {
    movieMeta: { theme: ['dystopia', 'cyberpunk', 'tech'] },
    suggestedGames: ['cyberpunk-2077', 'portal'],
    reason: 'Experience the system from the inside',
  },
  {
    movieMeta: { theme: ['war', 'military'] },
    suggestedGames: ['call-of-duty', 'halo', 'metal-gear-solid'],
    reason: 'Different fronts of the same conflict',
  },
  {
    movieMeta: { theme: ['mystery', 'time_loop', 'existential'] },
    suggestedGames: ['outer-wilds', 'portal', 'disco-elysium'],
    reason: "Questions that don't stop when the credits roll",
  },
];

// ── Backwards-compat helper ───────────────────────────────────────────────────
export function translateGameToMovieFilters(gameId) {
  const game = GAME_CATALOG.find(g => g.id === gameId);
  return game ? translateMetaToTMDB(game.meta) : null;
}
