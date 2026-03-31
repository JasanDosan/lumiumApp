import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const favoriteMovieSchema = new mongoose.Schema({
  tmdbId: { type: Number, required: true },
  title: { type: String, required: true },
  posterPath: { type: String },
  rating: { type: Number },
  addedAt: { type: Date, default: Date.now },
}, { _id: false });

const recommendationHistorySchema = new mongoose.Schema({
  generatedAt: { type: Date, default: Date.now },
  basedOn: [{ type: Number }], // tmdbIds of favorites used
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
  favorites: [favoriteMovieSchema],
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

// Virtual: favorites count
userSchema.virtual('favoritesCount').get(function () {
  return this.favorites.length;
});

export default mongoose.model('User', userSchema);
