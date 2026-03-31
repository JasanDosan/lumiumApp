import User from '../models/User.js';

export const findUserById = (id) =>
  User.findById(id);

export const findUserByIdWithPassword = (id) =>
  User.findById(id).select('+password');

export const findUserByEmail = (email) =>
  User.findOne({ email }).select('+password');

export const createUser = (data) =>
  User.create(data);

export const updateUserFavorites = (userId, favorites) =>
  User.findByIdAndUpdate(userId, { favorites }, { new: true, runValidators: true });

export const pushRecommendationHistory = (userId, historyEntry) =>
  User.findByIdAndUpdate(
    userId,
    {
      $push: {
        recommendationHistory: {
          $each: [historyEntry],
          $slice: -50, // keep last 50 entries
        },
      },
    },
    { new: true }
  );
