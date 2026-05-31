const htmlToPdf = require('html-pdf-node');
const { storage } = require("../appwrite/appwrite.config");
const { InputFile } = require("node-appwrite/file");
const moment = require("moment-timezone");
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { generateETicketTranslations, interpolate } = require('./translations/booking');

const logoPath = path.join(__dirname, 'assets', 'cfajdo.png');
const logoBase64 = fs.readFileSync(logoPath, { encoding: 'base64' });

const escapeAttribute = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const getAgencyLogoHtml = (booking) => {
    const agency = booking?.agency;
    if (!agency || typeof agency !== 'object') return '';

    const logoUrl = String(agency?.company_metadata?.logo || '').trim();
    if (!logoUrl) return '';

    const agencyName = agency?.company_metadata?.name || agency?.name || 'Agency';

    return `
        <div class="agency-logo-wrap">
            <img src="${escapeAttribute(logoUrl)}" alt="${escapeAttribute(agencyName)} logo" class="logo agency-logo">
        </div>
    `;
};

const generateETicket = async (booking, language = 'en') => {
    const t = generateETicketTranslations[language] || generateETicketTranslations.en;

    const qrCodeData = `https://www.gobusly.com/authorize-booking?id=${booking?._id?.toString()}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData);
    const formattedDepartureDate = moment.utc(booking?.departure_date).format('dddd, DD MMM YYYY');
    const formattedTime = moment.utc(booking?.departure_date).format('HH:mm');
    const agencyLogoHtml = getAgencyLogoHtml(booking);

    const results = [];

    for (let i = 0; i < booking?.passengers?.length; i++) {
        const passenger = booking.passengers[i];

        const passengerHtml = `
        <div class="passenger-item" style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #dbeafe; border-radius: 0.5rem; background: #f0f9ff;">
            <div class="passenger-title" style="font-weight: 600; font-size: 1rem; margin-bottom: 1rem; color: #1e3a8a;">
                ${interpolate(t.passengerTitle, { number: i + 1 })}
            </div>
            <div class="passenger-details" style="font-size: 0.875rem; color: #1e293b;">
                <div style="margin-bottom: 0.5rem;"><strong>${t.name}</strong> ${passenger.full_name}</div>
                ${passenger.phone ? `<div style="margin-bottom: 0.5rem;"><strong>${t.phone}</strong> ${passenger.phone}</div>` : ''}
                ${passenger.email ? `<div style="margin-bottom: 0.5rem;"><strong>${t.email}</strong> ${passenger.email}</div>` : ''}
                <div style="margin-bottom: 0.5rem;"><strong>${t.price}</strong> €${passenger.price?.toFixed(2) || '0.00'}</div>
            </div>
        </div>
        `;

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="${language}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${interpolate(t.ticketTitle, { number: i + 1 })}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
                body { background-color: #ffffff; color: #1e293b; line-height: 1.5; }
                .container { max-width: 800px; margin: 0 auto; background: white; border: 1px solid #dbeafe; border-radius: 0.5rem; overflow: hidden; }
                .header { padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #dbeafe; }
                .brand-logos { display: flex; align-items: center; gap: 1rem; }
                .logo { width: 120px; height: 60px; object-fit: contain; }
                .agency-logo-wrap { padding-left: 1rem; border-left: 1px solid #dbeafe; }
                .agency-logo { max-width: 120px; }
                .booking-id { font-size: 0.875rem; color: #64748b; }
                .main-content { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #dbeafe; }
                .left-column, .right-column { padding: 1.5rem; }
                .left-column { border-right: 1px dashed #dbeafe; }
                .destination-info { margin-bottom: 2rem; }
                .date { font-weight: 500; margin-bottom: 0.5rem; color: #1e3a8a; }
                .route { display: flex; gap: 1rem; height: 9rem; position: relative; }
                .times { display: flex; flex-direction: column; justify-content: space-between; font-weight: 500; height: 100%; color: #2563eb; }
                .inner-line { height:100%; border-right:2px dashed #2563eb; }
                .route-line { height:140px; justify-content:space-between; display: flex; flex-direction: column; align-items: center; position: relative; padding: 0.25rem 0; }
                .route-line::after { content: ''; position: absolute; top: 1.25rem; bottom: 1.25rem; width: 0.125rem; background-color: #2563eb; border-radius: 9999px; z-index: 0; }
                .dot { width: 1.25rem; height: 1.25rem; background-color: #2563eb; border-radius: 9999px; position: relative; z-index: 1; }
                .locations { display: flex; flex-direction: column; justify-content: space-between; flex: 1; }
                .location { display: flex; flex-direction: column; }
                .location-name { font-weight: 500; text-transform: capitalize; color: #1e3a8a; }
                .location-details { font-size: 0.875rem; color: #64748b; }
                .operator-info { margin-top: 2rem; border: 1px solid #2563eb; border-radius: 0.5rem; padding: 0.5rem 1rem; background-color: #f0f9ff; }
                .operator-title { display: flex; align-items: center; gap: 0.5rem; color: #2563eb; font-weight: 600; }
                .operator-name { text-transform: uppercase; }
                .operator-text { font-size: 0.875rem; color: #64748b; margin-top: 0.25rem; }
                .qr-section { display: flex; justify-content: center; margin: 1.5rem 0; }
                .qr-code { padding: 0.5rem; background: white; border-radius: 0.5rem; width: 160px; height: 160px; border: 1px solid #dbeafe; }
                .passenger-info { display: block; width: 100%; }
                .section-title { font-size: 1.125rem; font-weight: 600; margin-bottom: 1.5rem; color: #1e3a8a; }
                .info-item { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1rem; }
                .info-icon { width: 1.25rem; height: 1.25rem; margin-top: 0.125rem; flex-shrink: 0; color: #2563eb; }
                .info-content { flex: 1; min-width: 0; }
                .info-label { font-size: 0.875rem; color: #64748b; }
                .info-value { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1e293b; }
                .terms { margin-top: 1.5rem; padding-top: 1.5rem; }
                .terms-text { font-size: 0.75rem; color: #64748b; margin-top: 0.5rem; }
                .link { color: #2563eb; text-decoration: none; }
                .link:hover { text-decoration: underline; }
                .footer { text-align: center; padding: 1rem 1.5rem; font-size: 0.875rem; color: #64748b; border-top: 1px solid #dbeafe; background-color: #f8fafc; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="brand-logos">
                        <img src="data:image/png;base64,${logoBase64}" alt="IdoTours" class="logo">
                        ${agencyLogoHtml}
                    </div>
                    <div class="booking-id">${t.bookingId} ${booking?._id?.toString()}</div>
                </div>
                <div class="main-content">
                    <div class="left-column">
                        <div class="destination-info">
                            <div class="date">${formattedDepartureDate}</div>
                            <div class="route">
                                <div class="times"><div>${formattedTime}</div></div>
                                <div class="route-line">
                                    <div class="dot"></div>
                                    <div class="inner-line"></div>
                                    <div class="dot"></div>
                                </div>
                                <div class="locations">
                                    <div class="location">
                                        <div class="location-name">${booking?.labels?.from_city}</div>
                                        <div class="location-details">${booking?.destinations?.departure_station_label}</div>
                                    </div>
                                    <div class="location">
                                        <div class="location-name">${booking?.labels?.to_city}</div>
                                        <div class="location-details">${booking?.destinations?.arrival_station_label}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="operator-info">
                                <div class="operator-title">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M19 17h2l.64-2.54c.24-.959.24-1.962 0-2.92l-1.92-7.66A2 2 0 0 0 17.84 2H6.16a2 2 0 0 0-1.88 1.88L2.36 11.54c-.24.959-.24 1.962 0 2.92L3 17h2" />
                                        <path d="M14 17H9" />
                                        <circle cx="6.5" cy="17.5" r="2.5" />
                                        <circle cx="16.5" cy="17.5" r="2.5" />
                                    </svg>
                                    ${t.operatedBy} <span class="operator-name">${booking?.operator?.name}</span>
                                </div>
                                <div class="operator-text">${interpolate(t.operatorJourneyText, { operator: booking?.operator?.name })}</div>
                            </div>
                        </div>
                        <div class="qr-section">
                            <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code">
                        </div>
                        <div class="passenger-info">
                            ${passengerHtml}
                        </div>
                    </div>
                    <div class="right-column">
                        <div class="section-title">${t.additionalInformation}</div>
                        <div class="info-item">
                            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <line x1="6" y1="12" x2="18" y2="12" />
                            </svg>
                            <div class="info-content">
                                <div class="info-label">${t.passengerPrice}</div>
                                <div class="info-value">&euro;${passenger.price?.toFixed(2) || '0.00'}</div>
                            </div>
                        </div>
                        <div class="info-item">
                            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            <div class="info-content">
                                <div class="info-label">${t.viewBooking}</div>
                                <a href="https://www.gobusly.com/account/bookings/${booking?._id}" target="_blank" class="info-value link">${t.clickHere}</a>
                            </div>
                        </div>
                        <div class="info-item">
                            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12" y2="8" />
                            </svg>
                            <div class="info-content">
                                <div class="info-label">${t.faq}</div>
                                <a href="https://www.gobusly.com/help" target="_blank" class="info-value link">gobusly.com/help</a>
                            </div>
                        </div>
                        <div class="terms">
                            <div class="section-title">${t.termsConditions}</div>
                            <div class="terms-text">
                                <p style="margin-bottom: 0.5rem;">${t.termsText1} <a href="https://www.gobusly.com/legal/terms-of-service" target="_blank" class="link">${t.termsOfService}</a> ${t.and} <a href="https://www.gobusly.com/legal/privacy-policy" target="_blank" class="link">${t.privacyPolicy}</a>.</p>
                                <p style="margin-bottom: 0.5rem;">${t.termsText2} <a href="https://www.gobusly.com/legal/terms-and-conditions-of-carriage" target="_blank" class="link">${t.termsOfCarriage}</a> ${t.termsText3}</p>
                                <p>${t.termsText4}</p>
                            </div>
                        </div>
                        <div class="section-title" style="margin-top: 1.5rem;">${t.mapDirections}</div>
                        <div class="info-item">
                            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <div class="info-content">
                                <div class="info-label">${t.departureLocation}</div>
                                <div class="info-value">${booking?.destinations?.departure_station_label}</div>
                            </div>
                        </div>
                        <div class="info-item">
                            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <div class="info-content">
                                <div class="info-label">${t.arrivalLocation}</div>
                                <div class="info-value">${booking?.destinations?.arrival_station_label}</div>
                            </div>
                        </div>
                        <div class="info-item">
                            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <div class="info-content">
                                <div class="info-label">${t.departureTime}</div>
                                <div class="info-value">${formattedTime}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="footer">${interpolate(t.ticketFooter, { year: new Date().getFullYear() })}</div>
            </div>
        </body>
        </html>
        `;

        const options = {
            format: 'A4',
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
            printBackground: true,
            preferCSSPageSize: true
        };

        const file = { content: htmlContent };

        try {
            const pdfBuffer = await htmlToPdf.generatePdf(file, options);
            const fileId = `ticket_passenger_${i + 1}_${Date.now()}`;
            const fileName = `${fileId}.pdf`;
            const inputFile = InputFile.fromBuffer(pdfBuffer, fileName);
            const result = await storage.createFile("6776d4b70037ef9e499f", fileId, inputFile);
            const retrievedFile = await storage.getFileDownload('6776d4b70037ef9e499f', fileId);

            results.push({
                passengerIndex: i + 1,
                passengerName: passenger.full_name,
                retrievedFile: Buffer.from(retrievedFile),
                fileName: `e-ticket-passenger-${i + 1}-${passenger.full_name.replace(/\s+/g, '-')}.pdf`
            });
        } catch (error) {
        }
    }

    return results;
};



const generateSingleETicket = async (booking) => {
    const qrCodeData = `https://www.idotours.com.mk/authorize-booking?id=${booking?._id?.toString()}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData);
    console.log({ qrCodeDataUrl });

    const formattedDepartureDate = moment.utc(booking?.departure_date).format('dddd, DD MMM YYYY');
    const formattedTime = moment.utc(booking?.departure_date).format('HH:mm');
    const agencyLogoHtml = getAgencyLogoHtml(booking);

    const passengersHtml = booking?.passengers?.map((passenger, index) => `
        <div class="info-item">
            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
            <div class="info-content">
                <div class="info-label">Passenger ${index + 1} - Name</div>
                <div class="info-value">${passenger.full_name}</div>
            </div>
        </div>
        ${passenger.phone ? `
        <div class="info-item">
            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <div class="info-content">
                <div class="info-label">Passenger ${index + 1} - Phone</div>
                <div class="info-value">${passenger.phone}</div>
            </div>
        </div>
        ` : ''}
        ${passenger.email ? `
        <div class="info-item">
            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
            </svg>
            <div class="info-content">
                <div class="info-label">Passenger ${index + 1} - Email</div>
                <div class="info-value">${passenger.email}</div>
            </div>
        </div>
        ` : ''}
    `).join('');

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IdoTours E-Ticket</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
            
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                font-family: 'Inter', sans-serif;
            }
            
            body {
                background-color: #ffffff;
                color: #1e293b;
                line-height: 1.5;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                border: 1px solid #dbeafe;
                border-radius: 0.5rem;
                overflow: hidden;
            }
            
            .header {
                padding: 1.5rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #dbeafe;
            }

            .brand-logos {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .logo {
                width: 120px;
                height: 60px;
                object-fit: contain;
            }

            .agency-logo-wrap {
                padding-left: 1rem;
                border-left: 1px solid #dbeafe;
            }

            .agency-logo {
                max-width: 120px;
            }
            
            .booking-id {
                font-size: 0.875rem;
                color: #64748b;
            }
            
            .main-content {
                display: grid;
                grid-template-columns: 1fr 1fr;
                border-bottom: 1px solid #dbeafe;
            }
            
            .left-column, .right-column {
                padding: 1.5rem;
            }
            
            .left-column {
                border-right: 1px dashed #dbeafe;
            }
            
            .destination-info {
                margin-bottom: 2rem;
            }
            
            .date {
                font-weight: 500;
                margin-bottom: 0.5rem;
                color: #1e3a8a;
            }
            
            .route {
                display: flex;
                gap: 1rem;
                height: 9rem;
                position: relative;
            }
            
            .times {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                font-weight: 500;
                height: 100%;
                color: #2563eb;
            }
            
            .inner-line {
                height:100%;
                border-right:2px dashed #2563eb;
            }

            .route-line {
                height:140px;
                justify-content:space-between;
                display: flex;
                flex-direction: column;
                align-items: center;
                position: relative;
                padding: 0.25rem 0;
            }
            
            .route-line::after {
                content: '';
                position: absolute;
                top: 1.25rem;
                bottom: 1.25rem;
                width: 0.125rem;
                background-color: #2563eb;
                border-radius: 9999px;
                z-index: 0;
            }
            
            .dot {
                width: 1.25rem;
                height: 1.25rem;
                background-color: #2563eb;
                border-radius: 9999px;
                position: relative;
                z-index: 1;
            }
            
            .locations {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                flex: 1;
            }
            
            .location {
                display: flex;
                flex-direction: column;
            }
            
            .location-name {
                font-weight: 500;
                text-transform: capitalize;
                color: #1e3a8a;
            }
            
            .location-details {
                font-size: 0.875rem;
                color: #64748b;
            }
            
            .operator-info {
                margin-top: 2rem;
                border: 1px solid #2563eb;
                border-radius: 0.5rem;
                padding: 0.5rem 1rem;
                background-color: #f0f9ff;
            }
            
            .operator-title {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: #2563eb;
                font-weight: 600;
            }
            
            .operator-name {
                text-transform: uppercase;
            }
            
            .operator-text {
                font-size: 0.875rem;
                color: #64748b;
                margin-top: 0.25rem;
            }
            
            .qr-section {
                display: flex;
                justify-content: center;
                margin: 1.5rem 0;
            }
            
            .qr-code {
                padding: 0.5rem;
                background: white;
                border-radius: 0.5rem;
                width: 160px;
                height: 160px;
                border: 1px solid #dbeafe;
            }
            
            .passenger-info {
                display: block;
                width: 100%;
            }
            
            .info-item {
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
            }
            
            .info-icon {
                width: 1.25rem;
                height: 1.25rem;
                margin-top: 0.125rem;
                flex-shrink: 0;
                color: #2563eb;
            }
            
            .info-content {
                flex: 1;
                min-width: 0;
            }
            
            .info-label {
                font-size: 0.875rem;
                color: #64748b;
            }
            
            .info-value {
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: #1e293b;
            }
            
            .section-title {
                font-size: 1.125rem;
                font-weight: 600;
                margin-bottom: 1.5rem;
                color: #1e3a8a;
            }
            
            .terms {
                margin-top: 1.5rem;
                padding-top: 1.5rem;
            }
            
            .terms-text {
                font-size: 0.75rem;
                color: #64748b;
                margin-top: 0.5rem;
            }
            
            .link {
                color: #2563eb;
                text-decoration: none;
            }
            
            .link:hover {
                text-decoration: underline;
            }
            
            .footer {
                text-align: center;
                padding: 1rem 1.5rem;
                font-size: 0.875rem;
                color: #64748b;
                border-top: 1px solid #dbeafe;
                background-color: #f8fafc;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="brand-logos">
                    <img src="data:image/png;base64,${logoBase64}" alt="IdoTours" class="logo">
                    ${agencyLogoHtml}
                </div>
                <div class="booking-id">Booking ID: ${booking?._id?.toString()}</div>
            </div>
            
            <div class="main-content">
                <div class="left-column">
                    <div class="destination-info">
                        <div class="date">${formattedDepartureDate}</div>
                        <div class="route">
                        <div class="times">
                            <div>${formattedTime}</div>
                        </div>
                        <div class="route-line">
                            <div class="dot"></div>
                            <div class="inner-line"></div>
                            <div class="dot"></div>
                        </div>
                        <div class="locations">
                            <div class="location">
                                <div class="location-name">${booking?.labels?.from_city}</div>
                                <div class="location-details">${booking?.destinations?.departure_station_label}</div>
                            </div>
                            <div class="location">
                                <div class="location-name">${booking?.labels?.to_city}</div>
                                <div class="location-details">${booking?.destinations?.arrival_station_label}</div>
                            </div>
                        </div>
                    </div>
                        
                        <div class="operator-info">
                            <div class="operator-title">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M19 17h2l.64-2.54c.24-.959.24-1.962 0-2.92l-1.92-7.66A2 2 0 0 0 17.84 2H6.16a2 2 0 0 0-1.88 1.88L2.36 11.54c-.24.959-.24 1.962 0 2.92L3 17h2" />
                                    <path d="M14 17H9" />
                                    <circle cx="6.5" cy="17.5" r="2.5" />
                                    <circle cx="16.5" cy="17.5" r="2.5" />
                                </svg>
                                Operated by: <span class="operator-name">${booking?.operator?.name}</span>
                            </div>
                            <div class="operator-text">Enjoy a safe and reliable journey with ${booking?.operator?.name}.</div>
                        </div>
                    </div>
                    
                    <div class="qr-section">
                        <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code">
                    </div>
                    
                    <div class="passenger-info">
                        ${passengersHtml}
                    </div>
                </div>
                
                <div class="right-column">
                    <div class="section-title">Additional Information</div>
                    <div class="info-item" style="margin-bottom: 1rem;">
                        <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <line x1="6" y1="12" x2="18" y2="12" />
                        </svg>
                        <div class="info-content">
                            <div class="info-label">Total Price:</div>
                            <div class="info-value">&euro;${booking?.price?.toFixed(2)}</div>
                        </div>
                    </div>
                    
                    <div class="info-item" style="margin-bottom: 1rem;">
                        <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                        <div class="info-content">
                            <div class="info-label">View your booking:</div>
                            <a href="https://www.gobusly.com/account/bookings/${booking?._id}" target="_blank" class="info-value link">Click here!</a>
                        </div>
                    </div>

                    <div class="info-item" style="margin-bottom: 1rem;">
                        <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12" y2="8" />
                        </svg>
                        <div class="info-content">
                            <div class="info-label">FAQ:</div>
                            <a href="https://www.IdoTours.com.mk/help" target="_blank" class="info-value link">idotours.com.mk/help</a>
                        </div>
                    </div>

                    <div class="terms">
                        <div class="section-title">Terms & Conditions</div>
                        <div class="terms-text">
                            <p style="margin-bottom: 0.5rem;">
                                By booking with IdoTours, you agree to our 
                                <a href="https://www.gobusly.com/legal/terms-of-service" target="_blank" class="link">Terms of Service</a>
                                and 
                                <a href="https://www.gobusly.com/legal/privacy-policy" target="_blank" class="link">Privacy Policy</a>.
                            </p>
                            <p style="margin-bottom: 0.5rem;">
                                The 
                                <a href="https://www.gobusly.com/legal/terms-and-conditions-of-carriage" target="_blank" class="link">Terms of Carriage</a>
                                of the carrier apply to travel.
                            </p>
                            <p>IdoTours is an equal-opportunity service for all passengers.</p>
                        </div>
                    </div>

                    <div class="section-title" style="margin-top: 1.5rem;">Map & Directions</div>
                    <div class="info-item" style="margin-bottom: 1rem;">
                        <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                        <div class="info-content">
                            <div class="info-label">Departure Location:</div>
                            <div class="info-value">${booking?.destinations?.departure_station_label}</div>
                        </div>
                    </div>

                    <div class="info-item" style="margin-bottom: 1rem;">
                        <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                        <div class="info-content">
                            <div class="info-label">Arrival Location:</div>
                            <div class="info-value">${booking?.destinations?.arrival_station_label}</div>
                        </div>
                    </div>

                    <div class="info-item" style="margin-bottom: 1rem;">
                        <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M8 8h8v8H8z" />
                        </svg>
                        <div class="info-content">
                            <div class="info-label">Scan for Location on Map:</div>
                            <a href="https://www.google.com/maps/search/?q=${encodeURIComponent(
        booking?.destinations?.arrival_station_label
    )}" target="_blank" class="info-value link">Open in Maps</a>
                        </div>
                    </div>

                    <div class="info-item">
                        <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <div class="info-content">
                            <div class="info-label">Departure Date:</div>
                            <div class="info-value">${formattedTime}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="footer">
                © ${new Date().getFullYear()} IdoTours • Electronic Ticket • No Signature Required
            </div>
        </div>
    </body>
    </html>
    `;

    const options = {
        format: 'A4',
        margin: {
            top: '10mm',
            right: '10mm',
            bottom: '10mm',
            left: '10mm'
        },
        printBackground: true,
        preferCSSPageSize: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    };

    const file = await { content: htmlContent };

    try {
        const pdfBuffer = await htmlToPdf.generatePdf(file, options);

        const fileId = `ticket_${Date.now()}`;
        const fileName = `${fileId}.pdf`;

        const inputFile = InputFile.fromBuffer(pdfBuffer, fileName);

        const result = await storage.createFile(
            "eTicketStorage",  // Bucket ID
            fileId,                   // File ID
            inputFile                 // File data
        );

        console.log({ result });

        const fileUrl = `https://cloud.appwrite.io/v1/storage/buckets/6776d4b70037ef9e499f/files/${result.$id}/view?project=${process.env.appwrite_project_id}&mode=admin`;
        const retrievedFile = await storage.getFileDownload(
            'eTicketStorage', // bucketId
            fileId // fileId
        );
        return {
            retrievedFile,
            fileUrl
        };
    } catch (error) {
        console.log({ error });

        throw error;
    }
};



const generatePassengerManifestPDF = async (manifestData) => {
    const { route_code, route, departure_time, departure_date, starting_station, passengers } = manifestData;

    const passengerRows = passengers.map((p, index) => `
        <tr>
            <td style="border: 1px solid #dbeafe; padding: 8px; text-align: center;">${index + 1}</td>
            <td style="border: 1px solid #dbeafe; padding: 8px;">${p.full_name}</td>
            <td style="border: 1px solid #dbeafe; padding: 8px;">${p.phone || 'N/A'}</td>
            <td style="border: 1px solid #dbeafe; padding: 8px; text-align: center;">${p.age || ''}</td>
            <td style="border: 1px solid #dbeafe; padding: 8px; text-align: center;">[ ]</td>
        </tr>
    `).join('');

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 15px; }
            .header h2 { color: #1e3a8a; }
            .info-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; justify-content: space-between; }
            .info-item { font-size: 14px; min-width: 200px; color: #1e293b; }
            .info-item strong { color: #1e3a8a; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; border: 1px solid #dbeafe; }
            th { background-color: #eff6ff; border: 1px solid #dbeafe; padding: 12px 10px; text-align: left; font-size: 12px; color: #1e3a8a; font-weight: 600; }
            td { border: 1px solid #dbeafe; padding: 10px 8px; font-size: 12px; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 80px; display: flex; justify-content: space-between; }
            .signature-box { border-top: 1px solid #64748b; width: 200px; text-align: center; padding-top: 8px; font-size: 12px; color: #64748b; }
            .operator-info { margin-top: 15px; font-size: 11px; color: #94a3b8; text-align: center; padding-top: 15px; border-top: 1px solid #f1f5f9; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2 style="margin: 0;">BUS PASSENGER MANIFEST</h2>
            <p style="margin: 5px 0 0 0;">Route: <strong>${route_code}</strong> | ${route}</p>
        </div>
        
        <div class="info-grid">
            <div class="info-item"><strong>Departure Date:</strong> ${departure_date}</div>
            <div class="info-item"><strong>Departure Time:</strong> ${departure_time}</div>
            <div class="info-item"><strong>Starting Station:</strong> ${starting_station}</div>
            <div class="info-item"><strong>Total Passengers:</strong> ${passengers.length}</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 30px; text-align: center;">No.</th>
                    <th>Passenger Full Name</th>
                    <th>Contact Phone</th>
                    <th style="width: 40px; text-align: center;">Age</th>
                    <th style="width: 70px; text-align: center;">Check-in</th>
                </tr>
            </thead>
            <tbody>
                ${passengerRows}
            </tbody>
        </table>

        <div class="footer">
            <div class="signature-box">Driver Signature</div>
            <div class="signature-box">Operator Stamp</div>
        </div>

        <div class="operator-info">
            Generated by IdoTours Platform on ${moment().format('YYYY-MM-DD HH:mm')}
        </div>
    </body>
    </html>
    `;

    const options = {
        format: 'A4',
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
        printBackground: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    };

    const file = { content: htmlContent };

    try {
        const pdfBuffer = await htmlToPdf.generatePdf(file, options);
        return pdfBuffer;
    } catch (error) {
        console.error("PDF Generation Error:", error);
        throw error;
    }
};

module.exports = { generateETicket, generateSingleETicket, generatePassengerManifestPDF };
