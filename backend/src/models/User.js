import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const libraryItemSchema = new mongoose.Schema({
  id:          { type: String, required: true },  // "game_3498" | "movie_12345" | "series_456"
  type:        { type: String, enum: ['game', 'movie', 'series'], required: true },
  title:       { type: String, required: true },
  image:       { type: String, default: null },
  rating:      { type: Number, default: null },
  genres:      { type: [Number], default: [] },
  tags:        { type: [String], default: [] },
  rawId:       { type: String },
  tmdbId:      { type: Number },
  posterPath:  { type: String },
  backdropUrl: { type: String },
  posterUrl:   { type: String },
  releaseDate: { type: String },
  emoji:       { type: String },
  addedAt:     { type: Date, default: Date.now },
}, { _id: false });

const recommendationHistorySchema = new mongoose.Schema({
  generatedAt: { type: Date, default: Date.now },
  basedOn: [{ type: Number }], // tmdbIds used
  movieIds: [{ type: Number }], // recommended tmdbIds
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
