import { getPersonDetails } from '../services/tmdbService.js';

export const getPerson = async (req, res, next) => {
  try {
    const { id } = req.params;
    const person = await getPersonDetails(Number(id));
    res.json(person);
  } catch (error) {
    next(error);
  }
};
