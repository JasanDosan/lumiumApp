export const getRecommendationHistory = (req, res) => {
  res.json({ history: req.user.recommendationHistory });
};
