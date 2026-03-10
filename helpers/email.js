require("dotenv").config();
const nodemailer = require('nodemailer');
const { generateETicket } = require("./pdf");
const moment = require("moment-timezone");
const { sendBookingConfirmationEmailWithAttachmentTranslations, interpolate } = require("./translations/booking");

const transporter = nodemailer.createTransport({
  pool: true,
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


const sendBookingConfirmationEmail = async (booking, operator) => {
  try {
    if (!booking.passengers || booking.passengers.length === 0) {
      return;
    }

    const emailToUse = booking.passengers.find(p => p.email)?.email;
    if (!emailToUse) {
      return;
    }

    for (const passenger of booking.passengers) {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: emailToUse,
        subject: `Your GoBusly Booking Confirmation - Passenger: ${passenger.full_name}`,
        html: `<!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Electronic Ticket</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f2f5; line-height: 1.6; color: #1a2642; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .email-wrapper { background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden; }
        .header { background-color: #1a2642; color: white; padding: 10px; display: flex; align-items: center; }
        .logo-section { display: flex; align-items: center; gap: 12px; }
        .station { flex: 1; padding: 16px; }
        .station-label { color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
        .station-name { font-size: 16px; font-weight: 600; }
        .info-card { background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
        .card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
        .info-label { color: #666; }
        .info-value { font-weight: 500; }
        .footer { background: #1a2642; color: white; text-align: center; padding: 16px; font-size: 12px; }
      </style>
      </head>
      <body>
      <div class="container">
        <div class="email-wrapper">
          <div class="header">
            <div class="logo-section">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 24" class="logo">
                <text x="0" y="18" fill="#ffffff" font-size="16" font-weight="bold">GoBusly</text>
              </svg>
              <span>Electronic Ticket</span>
            </div>
          </div>

          <div class="station">
            <div class="station-label">DEPARTURE</div>
            <div class="station-name">${booking.destinations.departure_station_label}</div>
            <div class="station-time">${moment.utc(booking.departure_date).toLocaleString()}</div>
          </div>
          <div class="station">
            <div class="station-label">ARRIVAL</div>
            <div class="station-name">${booking.destinations.arrival_station_label}</div>
          </div>

          <div class="info-card">
            <div class="card-title">📋 Booking Information</div>
            <div class="info-row"><span class="info-label">Booking ID:</span><span class="info-value">${booking._id}</span></div>
            <div class="info-row"><span class="info-label">Price:</span><span class="info-value">€ ${booking.price.toFixed(2)}</span></div>
            <div class="info-row"><span class="info-label">Platform:</span><span class="info-value">${booking.platform}</span></div>
          </div>

          <div class="info-card">
            <div class="card-title">🚌 Operator Information</div>
            <div class="info-row"><span class="info-label">Company Name:</span><span class="info-value">${operator?.name || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">📞 Phone:</span><span class="info-value">${operator?.company_metadata?.phone || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">✉️ Email:</span><span class="info-value">${operator?.email || 'N/A'}</span></div>
          </div>

          <div class="info-card">
            <div class="card-title">👤 Passenger Details</div>
            <div class="info-row"><span class="info-label">Name:</span><span class="info-value">${passenger.full_name}</span></div>
            <div class="info-row"><span class="info-label">Email:</span><span class="info-value">${passenger.email || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Phone:</span><span class="info-value">${passenger.phone || 'N/A'}</span></div>
          </div>

          <div class="footer">© ${new Date().getUTCFullYear()} GoBusly • Electronic Ticket • Signed by GoBusly e-Sign</div>
        </div>
      </div>
      </body>
      </html>`
      };

      await transporter.sendMail(mailOptions);
    }
  } catch (error) {
  }
};

const sendBookingReceiptEmail = async (receipt_url, passengerEmail, language) => {
  try {
    if (!receipt_url || receipt_url.trim() === "") {
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: passengerEmail,
      subject: 'Your GoBusly Booking Receipt',
      html: `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
            p { font-size: 16px; line-height: 1.5; color: #555555; }
            a { color: #007BFF; text-decoration: none; }
            .footer { margin-top: 20px; font-size: 14px; color: #777777; }
          </style>
        </head>
        <body>
          <div class="container">
            <p>Thank you for booking with GoBusly! We appreciate your business.</p>
            <p>To view your receipt, please click the link below:</p>
            <p><a href="${receipt_url}" target="_blank">View Receipt</a></p>
            <p>If you have any questions or need further assistance, feel free to contact us.</p>
            <div class="footer">
              <p>Best regards,<br>The GoBusly Team</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
  } catch (error) {
  }
};


const sendBookingConfirmationEmailWithAttachment = async (booking, language = 'en') => {
  try {
    console.log({ booking });

    if (!booking.passengers || booking.passengers.length === 0) {
      return;
    }

    console.log({ psg: booking.passengers });

    const emailToUse = booking.passengers.find(p => p.email)?.email;
    console.log({ emailToUse });

    if (!emailToUse) {
      return;
    }

    const t = sendBookingConfirmationEmailWithAttachmentTranslations[language] || sendBookingConfirmationEmailWithAttachmentTranslations.en;

    const passengerTickets = await generateETicket(booking, language);
    console.log({ passengerTickets });

    if (passengerTickets.length === 0) {
      return;
    }

    const attachments = passengerTickets.map(ticket => ({
      filename: ticket.fileName,
      content: ticket.retrievedFile,
      contentType: "application/pdf"
    }));

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: emailToUse,
      subject: interpolate(t.emailSubject, { count: booking.passengers.length }),
      html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #1a2642;">${t.emailTitle}</h2>
              <p>${interpolate(t.greeting, { name: booking.passengers[0].full_name })}</p>
              <p>${t.thankYouMessage}</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #1a2642; margin-top: 0;">${t.bookingDetails}</h3>
                  <p><strong>${t.bookingId}</strong> ${booking._id}</p>
                  <p><strong>${t.from}</strong> ${booking.destinations.departure_station_label}</p>
                  <p><strong>${t.to}</strong> ${booking.destinations.arrival_station_label}</p>
                  <p><strong>${t.departure}</strong> ${moment.utc(booking.departure_date).toLocaleString()}</p>
                  <p><strong>${t.totalPrice}</strong> €${booking.price.toFixed(2)}</p>
              </div>

              <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #1a2642; margin-top: 0;">${interpolate(t.passengers, { count: booking.passengers.length })}</h3>
                  ${booking.passengers.map((passenger, index) => `
                      <div style="border-bottom: 1px solid #ddd; padding: 10px 0;">
                          <strong>${interpolate(t.passenger, { number: index + 1 })}:</strong> ${passenger.full_name}
                          ${passenger.email ? `<br><strong>${t.email}</strong> ${passenger.email}` : ''}
                          ${passenger.phone ? `<br><strong>${t.phone}</strong> ${passenger.phone}` : ''}
                          <br><strong>${t.price}</strong> €${passenger.price?.toFixed(2) || '0.00'}
                      </div>
                  `).join('')}
              </div>

              <p><strong>${t.attached}</strong> ${interpolate(t.attachmentDescription, { count: passengerTickets.length })}</p>
              
              <p>${t.ticketInstructions}</p>
              
              <p>${interpolate(t.journeyWish, { operator: booking.operator?.name || t.fallbackOperator })}</p>
              
              <div style="margin-top: 30px; font-size: 12px; color: #666;">
                  <p>${interpolate(t.footer, { year: new Date().getUTCFullYear() })}</p>
              </div>
          </div>
          `,
      attachments: attachments
    };

    const sent = await transporter.sendMail(mailOptions);
    console.log({ sent });

  } catch (error) {
    return error;
  }
};







const sendRegisteredOperatorEmail = async (receiverEmail, password, language) => {
  try {
    const translations = {
      albanian: {
        subject: 'Llogaria juaj në GoBusly është krijuar!',
        greeting: 'Përshëndetje dhe mirë se vini në GoBusly!',
        body: `Ne jemi të lumtur të ju mirëpresim si operator në platformën tonë. Llogaria juaj është krijuar me sukses. Këto janë kredencialet tuaja për të hyrë në panelin e kontrollit:`,
        credentials: `Email: {receiverEmail}<br>Fjalëkalimi: {password}`,
        nextSteps: 'Për të hyrë në panelin tuaj, ju lutem vizitoni <a href="https://operator.gobusly.com/login">https://operator.gobusly.com/login</a>. Nëse keni pyetje ose keni nevojë për ndihmë, mos hezitoni të na kontaktoni.',
        closing: 'Faleminderit që jeni bashkuar me ne!',
        regards: 'Me respekt,',
        team: 'Ekipi i GoBusly',
      },
      english: {
        subject: 'Your GoBusly Account Has Been Created!',
        greeting: 'Hello and welcome to GoBusly!',
        body: `We are thrilled to have you as an operator on our platform. Your account has been successfully created. Here are your credentials to log in to the dashboard:`,
        credentials: `Email: {receiverEmail}<br>Password: {password}`,
        nextSteps: 'To access your dashboard, please visit <a href="https://operator.gobusly.com/login">https://operator.gobusly.com/login</a>. If you have any questions or need assistance, feel free to reach out to us.',
        closing: 'Thank you for joining us!',
        regards: 'Best regards,',
        team: 'The GoBusly Team',
      },
      macedonian: {
        subject: `Вашата сметка на GoBusly е создадена!`,
        greeting: 'Здраво и добредојдовте во GoBusly!',
        body: `Среќни сме што сте дел од нашата платформа како оператор. Вашата сметка е успешно создадена. Овие се вашите податоци за најава:`,
        credentials: `Емаил: {receiverEmail}<br>Лозинка: {password}`,
        nextSteps: 'За да влезете во вашиот панел, ве молиме посетете <a href="https://operator.gobusly.com/login">https://operator.gobusly.com/login</a>. Ако имате прашања или ви е потребна помош, слободно контактирајте не.',
        closing: 'Ви благодариме што се приклучивте кон нас!',
        regards: 'Со почит,',
        team: 'Тимот на GoBusly',
      },
    };

    const selectedLanguage = translations[language] || translations['english'];

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: receiverEmail,
      subject: selectedLanguage.subject,
      html: `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
            p { font-size: 16px; line-height: 1.5; color: #555555; }
            .footer { margin-top: 20px; font-size: 14px; color: #777777; }
          </style>
        </head>
        <body>
          <div class="container">
            <p>${selectedLanguage.greeting}</p>
            <p>${selectedLanguage.body}</p>
            <p>${selectedLanguage.credentials.replace('{receiverEmail}', receiverEmail).replace('{password}', password)}</p>
            <p>${selectedLanguage.nextSteps}</p>
            <div class="footer">
              <p>${selectedLanguage.closing}<br>${selectedLanguage.regards}<br>${selectedLanguage.team}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
  } catch (error) {
  }
};



async function adminWebhookReceiver(eventType, object) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: "gobuslyinternal@gmail.com",
      subject: "Pat ni ndodhii",
      html: `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
            p { font-size: 16px; line-height: 1.5; color: #555555; }
            .footer { margin-top: 20px; font-size: 14px; color: #777777; }
          </style>
        </head>
        <body>
          <div class="container">
            <p>Ndodhi ni ndodhii</p>
            <p>${eventType}</p>
            <code>${JSON.stringify(object, null, 2)}</code>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
  } catch (error) {
  }
}



async function sendOtp(otp, email) {
  try {
    const logourl = "https://www.gobusly.com/assets/icons/logo.png"

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Your GoBusly verification code",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>GoBusly Verification Code</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              background-color: #f9fafb;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            
            .email-wrapper {
              background-color: #f9fafb;
              padding: 60px 20px;
              min-height: 100vh;
            }
            
            .email-container {
              max-width: 580px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              border: 1px solid #e5e7eb;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            
            .header {
              background: linear-gradient(135deg, #111827 0%, #374151 100%);
              padding: 48px 48px 40px;
              text-align: center;
              position: relative;
            }
            
            .header::after {
              content: '';
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              height: 1px;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
            }
            
            .logo {
              height: 48px;
              width: auto;
              max-width: 180px;
              object-fit: contain;
              filter: brightness(0) invert(1);
            }
            
            .header-subtitle {
              color: rgba(255, 255, 255, 0.8);
              font-size: 15px;
              font-weight: 400;
              margin-top: 12px;
              letter-spacing: 0.3px;
            }
            
            .content {
              padding: 56px 48px 48px;
              text-align: center;
            }
            
            .greeting {
              font-size: 28px;
              font-weight: 600;
              color: #111827;
              margin-bottom: 16px;
              line-height: 1.2;
            }
            
            .message {
              font-size: 16px;
              color: #6b7280;
              margin-bottom: 48px;
              line-height: 1.5;
              max-width: 400px;
              margin-left: auto;
              margin-right: auto;
            }
            
            .otp-container {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 40px 32px;
              margin: 48px 0;
              position: relative;
            }
            
            .otp-label {
              font-size: 13px;
              font-weight: 500;
              color: #6b7280;
              margin-bottom: 16px;
              text-transform: uppercase;
              letter-spacing: 0.8px;
            }
            
            .otp-code {
              font-size: 32px;
              font-weight: 600;
              color: #111827;
              font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
              letter-spacing: 4px;
              margin: 0;
              padding: 20px 32px;
              background: #ffffff;
              border: 2px solid #111827;
              border-radius: 6px;
              display: inline-block;
              box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            }
            
            .security-notice {
              background-color: #fef3c7;
              border: 1px solid #d97706;
              border-left: 4px solid #d97706;
              border-radius: 6px;
              padding: 20px 24px;
              margin: 40px 0;
              text-align: left;
            }
            
            .security-icon {
              display: flex;
              align-items: center;
              gap: 8px;
              font-weight: 500;
              color: #92400e;
              margin-bottom: 8px;
              font-size: 14px;
            }
            
            .security-text {
              font-size: 14px;
              color: #92400e;
              line-height: 1.5;
            }
            
            .expiry-info {
              background-color: #eff6ff;
              border: 1px solid #3b82f6;
              border-left: 4px solid #3b82f6;
              border-radius: 6px;
              padding: 16px 20px;
              margin: 32px 0;
              font-size: 14px;
              color: #1d4ed8;
              text-align: left;
            }
            
            .footer {
              background-color: #f8fafc;
              padding: 40px 48px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
            }
            
            .footer-text {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 20px;
            }
            
            .footer-links {
              font-size: 13px;
              color: #9ca3af;
              margin-bottom: 16px;
            }
            
            .footer-links a {
              color: #111827;
              text-decoration: none;
              margin: 0 12px;
              font-weight: 500;
              transition: color 0.2s ease;
            }
            
            .footer-links a:hover {
              color: #374151;
              text-decoration: underline;
            }
            
            .divider {
              height: 1px;
              background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
              margin: 32px 0;
            }
            
            .copyright {
              margin-top: 20px;
              font-size: 12px;
              color: #9ca3af;
            }
            
            @media (max-width: 600px) {
              .email-wrapper {
                padding: 40px 16px;
              }
              
              .content {
                padding: 40px 24px 32px;
              }
              
              .header {
                padding: 40px 24px 32px;
              }
              
              .footer {
                padding: 32px 24px;
              }
              
              .otp-code {
                font-size: 28px;
                letter-spacing: 3px;
                padding: 16px 24px;
              }
              
              .otp-container {
                padding: 32px 24px;
              }
              
              .logo {
                height: 44px;
              }
              
              .greeting {
                font-size: 24px;
              }
              
              .footer-links a {
                margin: 0 8px;
                display: inline-block;
                margin-bottom: 8px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              <div class="header">
                <div class="logo-container">
                  <img src="${logourl}" alt="GoBusly" class="logo">
                </div>
              </div>
              
              <div class="content">
                <h1 class="greeting">Verify your account</h1>
                <div class="otp-container">
                  <div class="otp-label">Your Verification Code</div>
                  <div class="otp-code">${otp}</div>
                </div>
                
                <div class="expiry-info">
                  ⏱️ This code expires in <strong>30 minutes</strong> for security reasons.
                </div>
                
                <div class="security-notice">
                  <div class="security-icon">
                    🔒 Security Notice
                  </div>
                  <div class="security-text">
                    Keep this code private. GoBusly will never ask for your verification code via phone, email, or text message.
                  </div>
                </div>
                
                <div class="divider"></div>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
                  Didn't request this code? You can safely ignore this email or 
                  <a href="mailto:support@gobusly.com" style="color: #111827; text-decoration: none; font-weight: 500;">contact support</a>.
                </p>
              </div>
              
              <div class="footer">
                <div class="footer-text">
                  Thank you for choosing GoBusly
                </div>
                <div class="footer-links">
                  <a href="https://www.gobusly.com">Website</a>
                  <a href="https://www.gobusly.com/help">Help Center</a>
                  <a href="https://www.gobusly.com/legal/privacy-policy">Privacy</a>
                </div>
                <div class="copyright">
                  © ${new Date().getFullYear()} GoBusly. All rights reserved.
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
  } catch (error) {
  }
}




const sendOperatorBookingNotification = async (booking, operator) => {
  try {
    if (!operator?.email) {
      return { success: false, reason: 'no_operator_email' };
    }

    if (!booking.passengers || booking.passengers.length === 0) {
      return { success: false, reason: 'no_passengers' };
    }

    const logourl = "https://www.gobusly.com/assets/icons/logo.png";
    const passengerCount = booking.passengers.length;
    const departureTimeLocal = moment.utc(booking.departure_date).format('dddd, MMMM Do YYYY [at] h:mm A');
    const bookingId = booking._id?.toString();

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: operator.email,
      subject: `Njoftim për Rezervim të Ri - ${passengerCount} Udhëtar${passengerCount > 1 ? 'ë' : ''} - GoBusly`,
      html: `
        <!DOCTYPE html>
        <html lang="sq">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Njoftim për Rezervim të Ri</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f9f9f9;
            }
            
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border: 1px solid #e5e5e5;
            }
            
            .header {
              background: linear-gradient(135deg, #1a2642 0%, #2d3e5f 100%);
              padding: 40px 30px;
              text-align: center;
              color: white;
            }
            
            .logo {
              height: 48px;
              width: auto;
              max-width: 180px;
              object-fit: contain;
              filter: brightness(0) invert(1);
              margin-bottom: 20px;
            }
            
            .header h1 {
              font-size: 24px;
              font-weight: 600;
              margin: 0;
            }
            
            .header p {
              margin: 10px 0 0 0;
              opacity: 0.9;
              font-size: 14px;
            }
            
            .content {
              padding: 40px 30px;
            }
            
            .alert {
              background: #e8f4f8;
              border-left: 4px solid #1a2642;
              padding: 20px;
              margin-bottom: 30px;
              border-radius: 4px;
            }
            
            .alert-text {
              font-size: 18px;
              font-weight: 600;
              color: #1a2642;
              margin: 0;
            }
            
            .booking-info {
              margin: 30px 0;
            }
            
            .route {
              font-size: 20px;
              font-weight: 600;
              text-align: center;
              margin-bottom: 20px;
              color: #333;
            }
            
            .details-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            
            .details-table td {
              padding: 12px 0;
              border-bottom: 1px solid #f0f0f0;
              vertical-align: top;
            }
            
            .details-table td:last-child {
              border-bottom: none;
            }
            
            .label {
              font-weight: 600;
              color: #666;
              width: 40%;
            }
            
            .value {
              color: #333;
              font-weight: 500;
            }
            
            .passengers-section {
              background: #f8f9fa;
              padding: 20px;
              margin: 30px 0;
              border-radius: 4px;
            }
            
            .passengers-section h3 {
              margin: 0 0 15px 0;
              font-size: 16px;
              font-weight: 600;
              color: #333;
            }
            
            .passenger-item {
              padding: 10px 0;
              border-bottom: 1px solid #e5e5e5;
            }
            
            .passenger-item:last-child {
              border-bottom: none;
            }
            
            .cta {
              text-align: center;
              margin: 30px 0;
            }
            
            .cta-button {
              display: inline-block;
              background: #1a2642;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 600;
            }
            
            .footer {
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e5e5e5;
              background: #f8f9fa;
              color: #666;
              font-size: 14px;
            }
            
            /* Mobile */
            @media (max-width: 600px) {
              .container {
                margin: 0;
                border: none;
              }
              
              .header, .content, .footer {
                padding: 20px;
              }
              
              .logo {
                height: 40px;
              }
              
              .header h1 {
                font-size: 20px;
              }
              
              .route {
                font-size: 18px;
              }
              
              .details-table td {
                display: block;
                width: 100%;
                padding: 8px 0;
              }
              
              .label {
                font-weight: 600;
                margin-bottom: 4px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${logourl}" alt="GoBusly" class="logo">
              <h1>🔔 Njoftim për Rezervim të Ri</h1>
              <p>Një rezervim i ri është bërë përmes GoBusly</p>
            </div>
            
            <div class="content">
              <div class="alert">
                <p class="alert-text">📍 ${passengerCount} Udhëtar${passengerCount > 1 ? 'ë' : ''} • ${booking.destinations.departure_station_label || 'N/A'} → ${booking.destinations.arrival_station_label || 'N/A'}</p>
              </div>
              
              <p>Përshëndetje ${operator.name || 'Operator'},</p>
              <p>Keni marrë një rezervim të ri përmes platformës GoBusly.</p>
              
              <div class="booking-info">
                <div class="route">
                  ${booking.labels?.from_city || 'Nisja'} → ${booking.labels?.to_city || 'Mbërritja'}
                </div>
                
                <table class="details-table">
                  <tr>
                    <td class="label">ID e Rezervimit:</td>
                    <td class="value">${bookingId}</td>
                  </tr>
                  <tr>
                    <td class="label">Numri i Udhëtarëve:</td>
                    <td class="value">${passengerCount}</td>
                  </tr>
                  <tr>
                    <td class="label">Data e Nisjes:</td>
                    <td class="value">${departureTimeLocal}</td>
                  </tr>
                  <tr>
                    <td class="label">Nga:</td>
                    <td class="value">${booking.destinations.departure_station_label || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td class="label">Drejt:</td>
                    <td class="value">${booking.destinations.arrival_station_label || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td class="label">Çmimi Total:</td>
                    <td class="value">€${booking.price?.toFixed(2) || '0.00'}</td>
                  </tr>
                  <tr>
                    <td class="label">Platforma:</td>
                    <td class="value">${booking.platform || 'Web'}</td>
                  </tr>
                </table>
              </div>
              
              <div class="passengers-section">
                <h3>👥 Detajet e Udhëtarëve</h3>
                ${booking.passengers.map((passenger, index) => `
                  <div class="passenger-item">
                    <strong>Udhëtari ${index + 1}:</strong> ${passenger.full_name || passenger.name || 'N/A'}<br>
                    ${passenger.email ? `<strong>Email:</strong> ${passenger.email}<br>` : ''}
                    ${passenger.phone ? `<strong>Telefon:</strong> ${passenger.phone}<br>` : ''}
                    <strong>Çmimi:</strong> €${passenger.price?.toFixed(2) || '0.00'}
                  </div>
                `).join('')}
              </div>
              
              <div class="cta">
                <a href="https://operator.gobusly.com/reports/bookings/${bookingId}" class="cta-button">Shiko Detajet e Rezervimit</a>
              </div>
            </div>
            
            <div class="footer">
              <p>Ky është një njoftim i automatizuar nga GoBusly</p>
              <p style="margin-top: 15px; font-size: 12px;">
                © ${new Date().getFullYear()} GoBusly. Të gjitha të drejtat e rezervuara.<br>
                Pyetje? Kontaktoni në support@gobusly.com
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted
    };

  } catch (error) {
    console.log(error);
  }
};

async function sendDepartureReminder(booking) {
  try {
    if (!booking?.passengers?.[0]?.email) {
      return { success: false, reason: 'no_email' };
    }

    const departureTimeLocal = moment.utc(booking?.departure_date).format('dddd, MMMM Do YYYY [at] h:mm A');
    const bookingId = booking?._id?.toString()

    const minutesUntilDeparture = moment.utc(booking?.departure_date).diff(moment.utc(), 'minutes');

    let timeMessage = '';
    if (minutesUntilDeparture <= 60) {
      timeMessage = `in ${minutesUntilDeparture} minutes`;
    } else {
      const hoursUntilDeparture = Math.floor(minutesUntilDeparture / 60);
      timeMessage = `in ${hoursUntilDeparture} hour${hoursUntilDeparture > 1 ? 's' : ''}`;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: booking?.passengers[0]?.email,
      subject: `Departure Reminder: ${booking?.labels?.from_city || 'Trip'} to ${booking?.labels?.to_city || 'destination'} ${timeMessage}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Departure Reminder</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f9f9f9;
            }
            
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border: 1px solid #e5e5e5;
            }
            
            .header {
              padding: 40px 30px;
              text-align: center;
              border-bottom: 1px solid #e5e5e5;
            }
            
            .logo {
              width: 120px;
              height: auto;
              margin-bottom: 20px;
            }
            
            .header h1 {
              font-size: 24px;
              font-weight: 600;
              margin: 0;
              color: #333;
            }
            
            .content {
              padding: 40px 30px;
            }
            
            .alert {
              background: #fff3cd;
              border: 1px solid #ffeaa7;
              padding: 20px;
              margin-bottom: 30px;
              border-radius: 4px;
              text-align: center;
            }
            
            .alert-text {
              font-size: 18px;
              font-weight: 600;
              color: #856404;
              margin: 0;
            }
            
            .trip-info {
              margin: 30px 0;
              padding: 0;
            }
            
            .route {
              font-size: 20px;
              font-weight: 600;
              text-align: center;
              margin-bottom: 20px;
              color: #333;
            }
            
            .details-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            
            .details-table td {
              padding: 12px 0;
              border-bottom: 1px solid #f0f0f0;
              vertical-align: top;
            }
            
            .details-table td:last-child {
              border-bottom: none;
            }
            
            .label {
              font-weight: 600;
              color: #666;
              width: 40%;
            }
            
            .value {
              color: #333;
              font-weight: 500;
            }
            
            .departure-time {
              color: #d73527;
              font-weight: 700;
            }
            
            .reminders {
              background: #f8f9fa;
              padding: 20px;
              margin: 30px 0;
              border-radius: 4px;
            }
            
            .reminders h3 {
              margin: 0 0 15px 0;
              font-size: 16px;
              font-weight: 600;
              color: #333;
            }
            
            .reminders ul {
              margin: 0;
              padding-left: 20px;
            }
            
            .reminders li {
              margin-bottom: 8px;
              color: #555;
            }
            
            .cta {
              text-align: center;
              margin: 30px 0;
            }
            
            .cta-button {
              display: inline-block;
              background: #ff6700;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 600;
            }
            
            .footer {
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e5e5e5;
              background: #f8f9fa;
              color: #666;
              font-size: 14px;
            }
            
            .footer-logo {
              width: 60px;
              height: auto;
              margin-bottom: 10px;
              opacity: 0.6;
            }
            
            /* Mobile */
            @media (max-width: 600px) {
              .container {
                margin: 0;
                border: none;
              }
              
              .header, .content, .footer {
                padding: 20px;
              }
              
              .logo {
                width: 100px;
              }
              
              .header h1 {
                font-size: 20px;
              }
              
              .route {
                font-size: 18px;
              }
              
              .details-table td {
                display: block;
                width: 100%;
                padding: 8px 0;
              }
              
              .label {
                font-weight: 600;
                margin-bottom: 4px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://ph-files.imgix.net/fd3cbc20-0872-4a89-9363-119924a9e60c.png?auto=format" alt="GoBusly" class="logo">
              <h1>Departure Reminder</h1>
            </div>
            
            <div class="content">
              <div class="alert">
                <p class="alert-text">Your bus departs ${timeMessage}</p>
              </div>
              
              <p>Hello ${booking?.passengers[0]?.name || booking?.passengers[0]?.full_name || 'Traveler'},</p>
              
              <div class="trip-info">
                <div class="route">
                  ${booking?.labels?.from_city || 'Departure'} → ${booking?.labels?.to_city || 'Arrival'}
                </div>
                
                <table class="details-table">
                  <tr>
                    <td class="label">Booking ID:</td>
                    <td class="value">${bookingId}</td>
                  </tr>
                  <tr>
                    <td class="label">Departure:</td>
                    <td class="value departure-time">${departureTimeLocal}</td>
                  </tr>
                  <tr>
                    <td class="label">Passenger:</td>
                    <td class="value">${booking?.passengers[0]?.full_name || booking?.passengers[0]?.name || 'N/A'}</td>
                  </tr>
                  ${booking?.destinations?.departure_station_label ? `
                  <tr>
                    <td class="label">From:</td>
                    <td class="value">${booking.destinations.departure_station_label}</td>
                  </tr>
                  ` : ''}
                  ${booking?.destinations?.arrival_station_label ? `
                  <tr>
                    <td class="label">To:</td>
                    <td class="value">${booking.destinations.arrival_station_label}</td>
                  </tr>
                  ` : ''}
                  ${booking?.operator?.name ? `
                  <tr>
                    <td class="label">Operator:</td>
                    <td class="value">${booking.operator.name}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              
              <div class="reminders">
                <h3>Important Reminders</h3>
                <ul>
                  <li>Ensure you have your booking confirmation available, either as a PDF or within our app.</li>
                  <li>Arrive at the station 20-40 minutes before departure</li>
                  <li>Check the departure platform at the station</li>
                </ul>
              </div>
              <p>Have a safe journey!</p>
            </div>
            
            <div class="footer">
              <p>Questions? Contact us at support@gobusly.com</p>
              <p style="margin-top: 15px; font-size: 12px;">
                © ${new Date().getFullYear()} GoBusly. All rights reserved.<br>
                This is an automated email. Please do not reply.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}








module.exports = { sendBookingConfirmationEmail, sendBookingReceiptEmail, sendRegisteredOperatorEmail, adminWebhookReceiver, sendOtp, sendBookingConfirmationEmailWithAttachment, sendDepartureReminder, sendOperatorBookingNotification };

