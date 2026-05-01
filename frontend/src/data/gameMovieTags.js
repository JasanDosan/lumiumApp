/**
 * Game → Movie "Mood Transfer" catalog.
 *
 * Architecture:
 *   1. Each game defines a `meta` object describing its CONCEPT (theme, mood, pacing).
 *   2. translateMetaToTMDB() converts meta-tags → TMDB discover params.
 *
 * Additional fields per game:
 *   image       — Steam CDN header image (460×215), null for non-Steam titles
 *   price       — USD price (0 = free to play)
 *   rating      — simulated user score out of 10
 *   tags        — human-readable display tags (shown on cards / detail pages)
 *   description — 1–2 sentence description for the detail page
 */

// ── Steam header image helper ─────────────────────────────────────────────────
const steam = (appId) =>
  `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;

// ── TMDB genre reference ──────────────────────────────────────────────────────
// 28 Action  | 12 Adventure | 16 Animation | 35 Comedy  | 80 Crime
// 99 Doc     | 18 Drama     | 10751 Family | 14 Fantasy | 36 History
// 27 Horror  | 9648 Mystery | 10749 Romance| 878 Sci-Fi | 53 Thriller
// 10752 War  | 37 Western

// ── Theme tag → TMDB genre IDs ────────────────────────────────────────────────
const THEME_TO_GENRES = {
  zombies:      [27, 53],
  survival:     [53],
  horror:       [27],
  sci_fi:       [878],
  space:        [878],
  war:          [10752, 28],
  crime:        [80],
  fantasy:      [14],
  mystery:      [9648],
  western:      [37],
  history:      [36],
  animation:    [16],
  stealth:      [53, 28],
  conspiracy:   [53, 80],
  exploration:  [12],
  politics:     [18, 53],
  noir:         [80, 18],
  cyberpunk:    [878, 80],
  supernatural: [27, 14],
  dystopia:     [878, 53],
  mythology:    [14, 12],
  comedy:       [35],
  drama:        [18],
  adventure:    [12],
  action:       [28],
  time_loop:    [9648, 878],
  narrative:    [18],
};

const POPULAR_MOODS  = new Set(['epic', 'explosive', 'fun']);

/**
 * Converts a game's meta-tags into TMDB discover parameters.
 */
export function translateMetaToTMDB(meta) {
  const { theme = [], mood = [], pacing = [] } = meta;

  const primary   = [];
  const secondary = [];
  for (const t of theme) {
    const ids = THEME_TO_GENRES[t] ?? [];
    if (ids[0] != null && !primary.includes(ids[0]))   primary.push(ids[0]);
    if (ids[1] != null && !secondary.includes(ids[1])) secondary.push(ids[1]);
  }
  const genres = [...new Set([...primary, ...secondary])].slice(0, 3);

  const wantsPopular = mood.some(m => POPULAR_MOODS.has(m));
  const sort_by = wantsPopular ? 'popularity.desc' : 'vote_average.desc';

  let rating_gte = 6.0;
  if (mood.some(m => ['bleak', 'tension', 'dark'].includes(m))) rating_gte = Math.max(rating_gte, 6.5);
  if (
    mood.some(m => ['realism', 'melancholic', 'contemplative', 'wonder'].includes(m)) ||
    pacing.some(p => ['slow', 'meditative'].includes(p))
  ) rating_gte = Math.max(rating_gte, 7.0);
  if (mood.includes('prestige')) rating_gte = Math.max(rating_gte, 7.5);
  if (mood.some(m => ['explosive', 'fun'].includes(m))) rating_gte = Math.min(rating_gte, 5.5);

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
    image: steam(108600),
    price: 19.99,
    rating: 8.7,
    tags: ['Survival', 'Zombies', 'Horror', 'Open World', 'Post-Apocalyptic'],
    description: 'An open-world isometric zombie survival RPG set in the fictional Knox County. Loot, build, craft — and figure out exactly how you died.',
    meta: {
      theme: ['zombies', 'survival', 'horror'],
      mood:  ['tension', 'bleak', 'realism'],
      pacing: ['slow', 'high_stakes'],
    },
  },
  {
    id: 'resident-evil',
    name: 'Resident Evil 2',
    emoji: '🦠',
    tagline: 'Biological horror and desperate escapes',
    image: steam(883710),
    price: 29.99,
    rating: 9.1,
    tags: ['Horror', 'Zombies', 'Action', 'Story-Rich', 'Third-Person'],
    description: 'Leon S. Kennedy and Claire Redfield attempt to escape Raccoon City as the undead overrun everything. One of gaming\'s finest survival horror experiences, fully remade.',
    meta: {
      theme: ['zombies', 'horror', 'action'],
      mood:  ['tension', 'dark', 'fun'],
      pacing: ['fast', 'high_stakes'],
    },
  },
  {
    id: 'silent-hill',
    name: 'Silent Hill 2',
    emoji: '🌫️',
    tagline: 'Psychological dread and fractured reality',
    image: steam(2124490),
    price: 59.99,
    rating: 9.2,
    tags: ['Horror', 'Psychological', 'Mystery', 'Atmospheric', 'Remake'],
    description: 'James Sunderland arrives in Silent Hill after receiving a letter from his dead wife. A masterwork of psychological horror and unreliable narrative, rebuilt from the ground up.',
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
    image: steam(1693980),
    price: 39.99,
    rating: 8.9,
    tags: ['Sci-Fi', 'Horror', 'Survival', 'Space', 'Atmospheric'],
    description: 'Engineer Isaac Clarke ventures into a stricken mining ship only to find creatures reanimated from human flesh. Claustrophobic, relentless, and genuinely frightening.',
    meta: {
      theme: ['sci_fi', 'horror', 'survival'],
      mood:  ['tension', 'dark', 'bleak'],
      pacing: ['slow', 'high_stakes'],
    },
  },

  // ── Action / Shooter ───────────────────────────────────────────────────────
  {
    id: 'doom',
    name: 'Doom Eternal',
    emoji: '💀',
    tagline: 'Relentless, visceral, extreme action',
    image: steam(782330),
    price: 29.99,
    rating: 8.4,
    tags: ['Action', 'FPS', 'Horror', 'Fast-Paced', 'Challenging'],
    description: 'The Doom Slayer battles demons across Earth and beyond at blistering speed. Pure, refined action — no story required.',
    meta: {
      theme: ['action', 'horror'],
      mood:  ['explosive', 'fun', 'dark'],
      pacing: ['fast', 'relentless'],
    },
  },
  {
    id: 'halo',
    name: 'Halo: MCC',
    emoji: '🪖',
    tagline: 'Epic sci-fi warfare across the stars',
    image: steam(976730),
    price: 39.99,
    rating: 8.6,
    tags: ['Sci-Fi', 'FPS', 'Action', 'Military', 'Co-op'],
    description: 'The Master Chief Collection brings together six Halo campaigns. The definitive sci-fi shooter saga, rebuilt for PC.',
    meta: {
      theme: ['sci_fi', 'war', 'action'],
      mood:  ['epic', 'tension'],
      pacing: ['fast', 'high_stakes'],
    },
  },
  {
    id: 'call-of-duty',
    name: 'Call of Duty: BOCW',
    emoji: '🎖️',
    tagline: 'Intense military operations under fire',
    image: steam(1985810),
    price: 59.99,
    rating: 7.8,
    tags: ['Action', 'FPS', 'Military', 'Multiplayer', 'Cold War'],
    description: 'Tense Cold War operations across multiple continents. Blockbuster multiplayer and a surprisingly sharp espionage campaign.',
    meta: {
      theme: ['war', 'action'],
      mood:  ['tension', 'realism', 'epic'],
      pacing: ['fast', 'high_stakes'],
    },
  },
  {
    id: 'metal-gear-solid',
    name: 'Metal Gear Solid V',
    emoji: '🐍',
    tagline: 'Cinematic stealth and political conspiracy',
    image: steam(287700),
    price: 19.99,
    rating: 9.4,
    tags: ['Stealth', 'Action', 'Open World', 'Cinematic', 'Conspiracy'],
    description: 'Venom Snake builds Diamond Dogs from the ruins of MSF. A vast open-world stealth sandbox that questions war, identity, and loyalty.',
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
    image: steam(271590),
    price: 29.99,
    rating: 9.0,
    tags: ['Open World', 'Crime', 'Action', 'Satire', 'Multiplayer'],
    description: 'Three criminals navigate Los Santos\' criminal underworld in Rockstar\'s sharp, satirical take on modern America. A decade later, still unmatched.',
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
    image: steam(1174180),
    price: 59.99,
    rating: 9.7,
    tags: ['Open World', 'Western', 'Drama', 'Story-Rich', 'Cinematic'],
    description: 'Arthur Morgan rides with the Van der Linde gang as the frontier closes in. A sweeping, melancholic masterpiece about loyalty and loss.',
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
    image: steam(1091500),
    price: 39.99,
    rating: 8.5,
    tags: ['RPG', 'Cyberpunk', 'Open World', 'Sci-Fi', 'Mature'],
    description: 'V, a mercenary in the neon-drenched megacity of Night City, chases immortality — and finds something else entirely.',
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
    image: steam(292030),
    price: 39.99,
    rating: 9.6,
    tags: ['RPG', 'Fantasy', 'Open World', 'Story-Rich', 'Dark'],
    description: 'Geralt of Rivia hunts for his adopted daughter across a war-torn world of monsters, politics, and moral ambiguity. The benchmark for open-world RPGs.',
    meta: {
      theme: ['fantasy', 'drama', 'mystery'],
      mood:  ['dark', 'contemplative', 'tension'],
      pacing: ['slow', 'high_stakes'],
    },
  },
  {
    id: 'dark-souls',
    name: 'Dark Souls III',
    emoji: '⚔️',
    tagline: 'Bleak worlds where perseverance is everything',
    image: steam(374320),
    price: 39.99,
    rating: 8.8,
    tags: ['Dark Fantasy', 'Action RPG', 'Challenging', 'Atmospheric', 'Lore-Rich'],
    description: 'An ashen realm of dying gods and impossible trials. Every death teaches you something; every victory is hard-earned.',
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
    image: steam(489830),
    price: 19.99,
    rating: 8.9,
    tags: ['Open World', 'Fantasy', 'RPG', 'Adventure', 'Dragons'],
    description: 'The last Dragonborn discovers a shout that can end the world — or use it to explore one of gaming\'s most beloved open worlds.',
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
    image: steam(1086940),
    price: 59.99,
    rating: 9.8,
    tags: ['RPG', 'Fantasy', 'Co-op', 'Story-Rich', 'Turn-Based'],
    description: 'A mind-flayer tadpole. A party of unlikely companions. Choices that actually matter. The new benchmark for RPGs.',
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
    image: steam(275850),
    price: 59.99,
    rating: 8.2,
    tags: ['Sci-Fi', 'Exploration', 'Space', 'Survival', 'Multiplayer'],
    description: 'Endless procedurally generated planets to explore, trade, and survive on. A redemption arc turned meditation on an infinite universe.',
    meta: {
      theme: ['sci_fi', 'exploration'],
      mood:  ['wonder', 'melancholic', 'contemplative'],
      pacing: ['slow', 'meditative'],
    },
  },
  {
    id: 'mass-effect',
    name: 'Mass Effect LE',
    emoji: '🚀',
    tagline: 'Operatic sci-fi with crew loyalty at its core',
    image: steam(1328670),
    price: 59.99,
    rating: 9.4,
    tags: ['Sci-Fi', 'RPG', 'Action', 'Story-Rich', 'Space Opera'],
    description: 'Shepherd must unite the galaxy against an ancient threat. One of gaming\'s most emotionally resonant sci-fi trilogies, remastered.',
    meta: {
      theme: ['sci_fi', 'action', 'adventure'],
      mood:  ['tension', 'melancholic', 'contemplative'],
      pacing: ['fast', 'high_stakes'],
    },
  },
  {
    id: 'portal',
    name: 'Portal 2',
    emoji: '🔵',
    tagline: 'Dark wit, puzzle logic and AI gone rogue',
    image: steam(620),
    price: 9.99,
    rating: 9.5,
    tags: ['Puzzle', 'Sci-Fi', 'Dark Humor', 'Co-op', 'Atmospheric'],
    description: 'Test chambers, portals, and GLaDOS. Valve\'s masterclass in puzzle design with some of gaming\'s finest dark comedy.',
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
    image: steam(753640),
    price: 24.99,
    rating: 9.3,
    tags: ['Exploration', 'Mystery', 'Sci-Fi', 'Atmospheric', 'Time Loop'],
    description: 'A solar system stuck in a 22-minute loop. The answers are out there — you just have to explore long enough to find them.',
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
    image: steam(289070),
    price: 29.99,
    rating: 8.1,
    tags: ['Strategy', 'Historical', 'Turn-Based', '4X', 'Civilization'],
    description: 'Lead your civilization from the ancient era to the space age, outmaneuvering rival leaders through diplomacy, culture, and war.',
    meta: {
      theme: ['history', 'war', 'politics'],
      mood:  ['realism', 'contemplative'],
      pacing: ['slow', 'strategic'],
    },
  },
  {
    id: 'age-of-empires',
    name: 'Age of Empires IV',
    emoji: '🏰',
    tagline: 'Conquest, empire-building and ancient warfare',
    image: steam(1466860),
    price: 39.99,
    rating: 7.9,
    tags: ['Strategy', 'Historical', 'RTS', 'War', 'Medieval'],
    description: 'Real-time strategy across the medieval world. Build civilizations, command armies, and rewrite history.',
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
    image: steam(1158310),
    price: 49.99,
    rating: 8.3,
    tags: ['Strategy', 'Medieval', 'Politics', 'Simulation', 'Roleplay'],
    description: 'Manage a medieval dynasty through marriage, intrigue, war, and succession crises. History as an endlessly dramatic soap opera.',
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
    image: steam(638230),
    price: 14.99,
    rating: 9.1,
    tags: ['Adventure', 'Atmospheric', 'Indie', 'Emotional', 'Exploration'],
    description: 'A nameless traveler crosses a vast desert toward a distant mountain. Wordless, beautiful, profound — a 90-minute experience unlike anything else.',
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
    image: steam(391540),
    price: 9.99,
    rating: 9.4,
    tags: ['RPG', 'Indie', 'Emotional', 'Pixel Art', 'Unique'],
    description: 'A human child falls into the Underground, where monsters live. Whether to fight or befriend them is entirely up to you.',
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
    image: null,
    price: 26.95,
    rating: 9.3,
    tags: ['Survival', 'Creative', 'Sandbox', 'Open World', 'Multiplayer'],
    description: 'Place blocks. Break blocks. Build anything. Survive the night. A creative sandbox with no end goal and infinite possibility.',
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
    image: steam(632470),
    price: 39.99,
    rating: 9.5,
    tags: ['RPG', 'Noir', 'Mystery', 'Story-Rich', 'Political'],
    description: 'A disgraced detective with no memory investigates a murder in a city on the edge of collapse. The finest RPG writing ever committed to code.',
    meta: {
      theme: ['noir', 'politics', 'mystery'],
      mood:  ['dark', 'contemplative', 'melancholic', 'prestige'],
      pacing: ['slow', 'meditative'],
    },
  },
];

// ── Recommendation helpers ────────────────────────────────────────────────────

/**
 * Returns up to `count` games similar to `selectedId`, scored by
 * overlapping theme + mood tags (tag intersection).
 */
export function getRelatedGames(selectedId, count = 10) {
  const selected = GAME_CATALOG.find(g => g.id === selectedId);
  if (!selected) return GAME_CATALOG.slice(0, count);

  const themes = new Set(selected.meta.theme);
  const moods  = new Set(selected.meta.mood);

  return GAME_CATALOG
    .filter(g => g.id !== selectedId)
    .map(g => ({
      ...g,
      _score: g.meta.theme.filter(t => themes.has(t)).length * 2
             + g.meta.mood.filter(m => moods.has(m)).length,
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, count);
}

// ── Inverse recommendation stubs (Movie → Game) ───────────────────────────────
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
