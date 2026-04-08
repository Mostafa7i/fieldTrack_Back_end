const express = require('express');
const router = express.Router();
const {
  createEvaluation,
  getEvaluations,
  getEvaluation,
  getLeaderboard
} = require('../controllers/evaluationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/leaderboard', getLeaderboard);

router
  .route('/')
  .post(authorize('company'), createEvaluation)
  .get(getEvaluations);

router.route('/:id').get(getEvaluation);

module.exports = router;
