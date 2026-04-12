import User from '../models/User.js';

export const findUserById = (id) =>
  User.findById(id);

export const findUserByIdWithPassword = (id) =>
  User.findById(id).select('+password');

export const findUserByEmail = (email) =>
  User.findOne({ email }).select('+password');

export const createUser = (data) =>
  User.create(data);

export const pushLibraryItem = (userId, item) =>
  User.findByIdAndUpdate(
    userId,
    { $push: { library: item } },
    { new: true, runValidators: true }
  );

export const pullLibraryItem = (userId, id) =>
  User.findByIdAndUpdate(
    userId,
    { $pull: { library: { id } } },
    { new: true }
  );

export const setLibraryItemField = (userId, id, updates) => {
  const setObj = {};
  for (const [key, val] of Object.entries(updates)) {
    if (key !== 'id' && key !== 'type') setObj[`library.$.${key}`] = val;
  }
  return User.findOneAndUpdate(
    { _id: userId, 'library.id': id },
    { $set: setObj },
    { new: true, runValidators: true }
  );
};

export const updateSteamConnection = (userId, steamData) =>
  User.findByIdAndUpdate(
    userId,
    { $set: { steam: steamData } },
    { new: true }
  );

export const clearSteamConnection = (userId) =>
  User.findByIdAndUpdate(
    userId,
    { $unset: { steam: 1 }, $set: { steamRecentGames: [] } },
    { new: true }
  );

export const updateSteamLastSynced = (userId) =>
  User.findByIdAndUpdate(
    userId,
    { $set: { 'steam.lastSyncedAt': new Date() } },
    { new: true }
  );

export const setRecentGames = (userId, games) =>
  User.findByIdAndUpdate(
    userId,
    { $set: { steamRecentGames: games } },
    { new: true }
  );

export const pushRecommendationHistory = (userId, historyEntry) =>
  User.findByIdAndUpdate(
    userId,
    {
      $push: {
        recommendationHistory: {
          $each: [historyEntry],
          $slice: -50,
        },
      },
    },
    { new: true }
  );
