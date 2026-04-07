import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const libraryItemSchema = new mongoose.Schema({
  // ── Identity ───────────────────────────────────────────────────────────────
  id:         { type: String, required: true },  // compound: "movie_12345", "game_3498"
  externalId: { type: String, default: null },   // raw ID from source ("12345", "3498")
  source:     { type: String, enum: ['tmdb', 'rawg', 'manual'], default: 'manual' },
  type:       { type: String, enum: ['game', 'movie', 'series'], required: true },

  // ── Display ────────────────────────────────────────────────────────────────
  title:      { type: String, required: true },
  imageUrl:   { type: String, default: null },   // canonical image field
  image:      { type: String, default: null },   // @deprecated — kept for backward compat

  // ── Classification ─────────────────────────────────────────────────────────
  rating:      { type: Number, default: null },
  genres:      { type: [Number], default: [] },  // TMDB genre IDs; future sources use metadata
  tags:        { type: [String], default: [] },

  // ── Source-specific fields (TMDB) ──────────────────────────────────────────
  rawId:       { type: String },
  tmdbId:      { type: Number },
  posterPath:  { type: String },
  backdropUrl: { type: String },
  posterUrl:   { type: String },
  releaseDate: { type: String },

  // ── UI helpers ─────────────────────────────────────────────────────────────
  emoji:       { type: String },

  // ── Extensible payload (source-specific extras: voteCount, platforms, etc) ─
  metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },

  addedAt:     { type: Date, default: Date.now },
}, { _id: false });

const recommendationHistorySchema = new mongoose.Schema({
  generatedAt: { type: Date, default: Date.now },
  // ── New generic fields ─────────────────────────────────────────────────────
  itemIds:     [{ type: String }],   // compound library IDs: "movie_123", "game_456"
  basedOnIds:  [{ type: String }],   // compound IDs of seed items
  // ── Legacy fields (kept for backward compat with existing history entries) ─
  basedOn:     [{ type: Number }],   // @deprecated: tmdbIds used — use basedOnIds
  movieIds:    [{ type: Number }],   // @deprecated: recommended tmdbIds — use itemIds
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },
  library: { type: [libraryItemSchema], default: [] },
  recommendationHistory: {
    type: [recommendationHistorySchema],
    default: [],
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance method: compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.virtual('libraryCount').get(function () {
  return this.library.length;
});

export default mongoose.model('User', userSchema);
