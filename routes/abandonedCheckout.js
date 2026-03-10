const express = require('express');
const router = express.Router();
const {
  createAbandonedCheckout,
  getAbandonedCheckout,
  deleteAbandonedCheckout,
  getAllAbandonedCheckouts,
  updateEmailSentStatus
} = require('../controllers/abandonedCheckout-controller');

router.post('/abandoned-checkout', createAbandonedCheckout);
router.get('/abandoned-checkout/:checkoutId', getAbandonedCheckout);
router.delete('/abandoned-checkout/:checkoutId', deleteAbandonedCheckout);
router.get('/abandoned-checkout', getAllAbandonedCheckouts);
router.put('/abandoned-checkout/:checkoutId/email-sent', updateEmailSentStatus);

module.exports = router;