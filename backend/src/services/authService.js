import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail } from '../repositories/userRepository.js';
import { AppError } from '../middleware/errorHandler.js';

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

export const register = async ({ name, email, password }) => {
  const existing = await findUserByEmail(email);
  if (existing) throw new AppError('Email already in use.', 409);

  const user = await createUser({ name, email, password });
  const token = signToken(user._id);

  return { token, user: sanitizeUser(user) };
};

export const login = async ({ email, password }) => {
  const user = await findUserByEmail(email);
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password.', 401);
  }

  const token = signToken(user._id);
  return { token, user: sanitizeUser(user) };
};
