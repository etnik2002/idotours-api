const router = require('express').Router();
const walletController = require('../controllers/wallet-controller');

// WEB AND ANDROID
router.post('/google/:bookingId', walletController.generateGooglePass);
router.post('/ios/:bookingId', walletController.generateApplePass);

// MOBILE
router.post('/mobile/ios/:bookingId', walletController.generateApplePassForMobile);
router.post('/mobile/google/:bookingId', walletController.generateGooglePass);

// DOWNLOAD ENDPOINTS
router.get('/download/:fileName', walletController.downloadPass);

module.exports = router;