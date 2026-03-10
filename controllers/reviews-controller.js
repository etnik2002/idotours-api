const Review = require('../models/Review');
const Operator = require('../models/Operator');

exports.getAllReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find()
      .populate('user', 'name email')
      .populate('operator', 'name company_metadata.name company_metadata.logo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments();

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalReviews: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'name email')
      .populate('operator', 'name company_metadata.name company_metadata.logo');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getReviewsByOperator = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ operator: req.params.operatorId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({ operator: req.params.operatorId });

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalReviews: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getReviewsByUser = async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.params.userId })
      .populate('operator', 'name company_metadata.name company_metadata.logo')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.createReview = async (req, res) => {
  try {
    const { operator, rating, comment } = req.body;
    const userId = req.user.id;

    const existingReview = await Review.findOne({
      user: userId,
      operator: operator
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this bus operator'
      });
    }

    const review = new Review({
      user: userId,
      operator,
      rating,
      comment
    });

    await review.save();

    await updateOperatorRating(operator);

    const populatedReview = await Review.findById(review._id)
      .populate('user', 'name email')
      .populate('operator', 'name company_metadata.name company_metadata.logo');

    res.status(201).json({
      success: true,
      data: populatedReview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const userId = req.user.id;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    review.updatedAt = Date.now();

    await review.save();

    await updateOperatorRating(review.operator);

    const updatedReview = await Review.findById(review._id)
      .populate('user', 'name email')
      .populate('operator', 'name company_metadata.name company_metadata.logo');

    res.status(200).json({
      success: true,
      data: updatedReview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    const operatorId = review.operator;
    await Review.findByIdAndDelete(req.params.id);

    await updateOperatorRating(operatorId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const updateOperatorRating = async (operatorId) => {
  const reviews = await Review.find({ operator: operatorId });
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
    : 0;

  await Operator.findByIdAndUpdate(operatorId, {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews
  });
};
