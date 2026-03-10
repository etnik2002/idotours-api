const router = require("express").Router();
const apicache = require("apicache");
const {
  getAllReviews,
  getReviewById,
  getReviewsByOperator,
  getReviewsByUser,
  createReview,
  updateReview,
  deleteReview
} = require('../controllers/reviews-controller');
const cache = apicache.middleware;

router.get('/', cache("5 minutes"), getAllReviews);
router.post('/', createReview);

router.get('/operator/:operatorId', cache("5 minutes"), getReviewsByOperator);
router.get('/user/:userId', cache("5 minutes"), getReviewsByUser);

router.get('/:id', cache("5 minutes"), getReviewById);
router.put('/:id', updateReview);
router.delete('/:id', deleteReview);

module.exports = router;
