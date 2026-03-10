const cron = require('node-cron');
const nodemailer = require('nodemailer');
const AbandonedCheckout = require('../../models/AbandonedCheckout');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.SECURE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const generateResumeURL = (checkoutId) => {
  const baseURL = process.env.FRONTEND_URL || 'https://gobusly.com';
  return `${baseURL}/checkout?resume=${checkoutId}`;
};

const sendAbandonedCheckoutEmail = async (abandonedCheckout) => {
  const resumeURL = generateResumeURL(abandonedCheckout.checkoutId);

  const totalPassengers = abandonedCheckout.passengers.length;

  const ticket = abandonedCheckout.selectedTicket || abandonedCheckout.outboundTicket;
  const tripDetails = ticket ? {
    from: ticket.destination?.from || 'N/A',
    to: ticket.destination?.to || 'N/A',
    date: ticket.departure_date ? new Date(ticket.departure_date).toLocaleDateString() : 'N/A',
    operator: ticket.operatorInfo?.name || ticket.metadata?.operator_name || 'N/A'
  } : null;

  const emailHTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You left something behind! - GoBusly</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.5; 
        color: #333333;
        background-color: #f5f5f5;
        font-size: 16px;
      }
      
      .email-container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }
      
      .header {
        background-color: #ffffff;
        padding: 32px 40px 24px 40px;
        text-align: center;
        border-bottom: 1px solid #f0f0f0;
      }
      
      .logo {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
      }
      
      .logo img {
        width: 40px;
        height: 40px;
        margin-right: 12px;
      }
      
      .logo-text {
        font-size: 32px;
        font-weight: 700;
        color: #1a73e8;
        letter-spacing: -1px;
      }
      
      .main-title {
        font-size: 28px;
        font-weight: 600;
        color: #333333;
        margin-bottom: 0;
        line-height: 1.2;
      }
      
      .content {
        padding: 40px;
        text-align: center;
      }
      
      .greeting {
        font-size: 18px;
        color: #333333;
        margin-bottom: 20px;
        font-weight: 500;
      }
      
      .main-message {
        font-size: 16px;
        color: #666666;
        margin-bottom: 40px;
        line-height: 1.6;
        max-width: 400px;
        margin-left: auto;
        margin-right: auto;
      }
      
      .cta-button {
        display: inline-block;
        background-color: #00d4aa;
        color: #ffffff;
        padding: 16px 32px;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
        font-size: 16px;
        transition: all 0.2s ease;
        margin-bottom: 40px;
      }
      
      .cta-button:hover {
        background-color: #00b894;
        transform: translateY(-1px);
      }
      
      .booking-preview {
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 24px;
        margin: 32px 0;
        text-align: left;
        border: 1px solid #e9ecef;
      }
      
      .preview-title {
        font-size: 16px;
        font-weight: 600;
        color: #333333;
        margin-bottom: 16px;
      }
      
      .booking-item {
        display: flex;
        align-items: center;
        background-color: #ffffff;
        border-radius: 6px;
        padding: 16px;
        border: 1px solid #e9ecef;
      }
      
      .booking-icon {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #1a73e8, #4285f4);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 16px;
        font-size: 24px;
      }
      
      .booking-details {
        flex: 1;
      }
      
      .booking-route {
        font-size: 16px;
        font-weight: 600;
        color: #333333;
        margin-bottom: 4px;
      }
      
      .booking-info {
        font-size: 14px;
        color: #666666;
      }
      
      .booking-price {
        font-size: 18px;
        font-weight: 600;
        color: #333333;
      }
      
      .footer {
        background-color: #f8f9fa;
        padding: 24px 40px;
        text-align: center;
        border-top: 1px solid #e9ecef;
      }
      
      .footer-text {
        font-size: 14px;
        color: #666666;
        line-height: 1.5;
      }
      
      .footer-links {
        margin-top: 16px;
      }
      
      .footer-links a {
        color: #1a73e8;
        text-decoration: none;
        margin: 0 12px;
        font-size: 14px;
      }
      
      @media (max-width: 600px) {
        .email-container {
          margin: 20px;
          border-radius: 0;
        }
        
        .content, .header {
          padding: 24px 20px;
        }
        
        .main-title {
          font-size: 24px;
        }
        
        .logo-text {
          font-size: 28px;
        }
        
        .booking-item {
          flex-direction: column;
          text-align: center;
          padding: 20px;
        }
        
        .booking-icon {
          margin-right: 0;
          margin-bottom: 12px;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo">
          <img src="https://www.gobusly.com/assets/icons/logo.png" alt="GoBusly">
        </div>
        
        <h1 class="main-title">You left something behind!</h1>
      </div>
      
      <div class="content">
        <p class="greeting">Hey ${abandonedCheckout.passengers[0]?.first_name || 'there'}!</p>
        
        <p class="main-message">
          We noticed you left something in your cart and didn't want you to miss out! 
          We've set them aside and they're ready to go when you are.
        </p>
        
        <a href="${resumeURL}" class="cta-button">Take me to my booking!</a>
        
        ${tripDetails ? `
          <div class="booking-preview">
            <div class="preview-title">Item in your cart:</div>
            
            <div class="booking-item">
              <div class="booking-icon">🚌</div>
              
              <div class="booking-details">
                <div class="booking-route">${tripDetails.from} → ${tripDetails.to}</div>
                <div class="booking-info">
                  ${totalPassengers} ${totalPassengers > 1 ? 'passengers' : 'passenger'} • ${tripDetails.date}
                </div>
              </div>
              
              ${abandonedCheckout.totalCost ? `
                <div class="booking-price">$${(abandonedCheckout.totalCost / 100).toFixed(2)}</div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="footer">
        <p class="footer-text">
          You're receiving this because you started a booking on GoBusly.<br>
          Don't want these emails? You can unsubscribe anytime.
        </p>
        
        <div class="footer-links">
          <a href="#">Help Center</a>
          <a href="#">Unsubscribe</a>
          <a href="#">Privacy Policy</a>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  const mailOptions = {
    from: `"GoBusly Team" <${process.env.EMAIL_FROM || 'noreply@yourapp.com'}>`,
    to: abandonedCheckout.userEmail,
    subject: ' Complete Your Travel Booking - Secure Your Seats',
    html: emailHTML,
    text: `
Hello ${abandonedCheckout.passengers[0]?.first_name || 'Valued Customer'},

We noticed you started booking a trip but didn't complete your reservation. Your booking information has been securely saved.

${tripDetails ? `
Your Travel Details:
• Route: ${tripDetails.from} → ${tripDetails.to}
• Date: ${tripDetails.date}
• Operator: ${tripDetails.operator}
• Passengers: ${totalPassengers}
• Traveler: ${abandonedCheckout.passengers[0]?.first_name} ${abandonedCheckout.passengers[0]?.last_name}
${abandonedCheckout.totalCost > 0 ? `• Total: ${(abandonedCheckout.totalCost / 100).toFixed(2)}` : ''}
` : ''}

Complete your booking: ${resumeURL}

Why book now:
✓ Secure your seats before they sell out
✓ Lock in current pricing
✓ All information already saved
✓ One-click completion

This link expires in 24 hours for your security.

Need help? Contact our support team.

Best regards,
GoBusly Team
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending abandoned checkout email:', error);
    return false;
  }
};


const startAbandonedCheckoutCron = () => {
  cron.schedule('*/10 * * * * *', async () => {
    try {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const twoDaysAgo = Date.now() - (48 * 60 * 60 * 1000);

      const abandonedCheckouts = await AbandonedCheckout.find({
        resumed: false,
        emailSent: false,
        // timestamp: {
        //   $gte: twoDaysAgo,
        //   $lte: oneHourAgo
        // }
      }).limit(100);

      let successCount = 0;
      let errorCount = 0;

      for (const checkout of abandonedCheckouts) {
        try {
          const emailSent = await sendAbandonedCheckoutEmail(checkout);

          if (emailSent) {
            checkout.emailSent = true;
            checkout.emailSentAt = new Date();
            await checkout.save();
            successCount++;

            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }


    } catch (error) {
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

};

const startCleanupCron = () => {
  cron.schedule('0 2 * * *', async () => {
    try {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

      const result = await AbandonedCheckout.deleteMany({
        timestamp: { $lt: sevenDaysAgo }
      });

    } catch (error) {
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

};

const manualTriggerEmail = async (req, res) => {
  try {
    const { checkoutId } = req.params;

    const abandonedCheckout = await AbandonedCheckout.findOne({
      checkoutId,
      resumed: false
    });

    if (!abandonedCheckout) {
      return res.status(404).json({ error: 'Abandoned checkout not found or already resumed' });
    }

    const emailSent = await sendAbandonedCheckoutEmail(abandonedCheckout);

    if (emailSent) {
      abandonedCheckout.emailSent = true;
      abandonedCheckout.emailSentAt = new Date();
      await abandonedCheckout.save();

      res.json({ message: 'Email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  startAbandonedCheckoutCron,
  startCleanupCron,
  manualTriggerEmail,
  sendAbandonedCheckoutEmail
};