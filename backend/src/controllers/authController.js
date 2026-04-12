import * as authService from '../services/authService.js';

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const result = await authService.register({ name, email, password });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getMe = (req, res) => {
  const { steam } = req.user;
  res.json({
    id:             req.user._id,
    name:           req.user.name,
    email:          req.user.email,
    favoritesCount: req.user.favoritesCount,
    createdAt:      req.user.createdAt,
    steam: steam?.steamId
      ? {
          connected:   true,
          steamId:     steam.steamId,
          personaName: steam.personaName,
          avatarUrl:   steam.avatarUrl,
        }
      : null,
  });
};
