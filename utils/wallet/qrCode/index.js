const QRCode = require('qrcode');

const generateQRCode = async (url) => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrCodeDataURL;
  } catch (error) {
    throw error;
  }
};

module.exports = { generateQRCode };