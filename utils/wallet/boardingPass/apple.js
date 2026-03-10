const { PKPass } = require('passkit-generator');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Download and save an image from URL
const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => { });
      reject(err);
    });
  });
};

// Create placeholder icons from a public image
const createPassIcons = async (templatePath) => {
  try {
    // Using a simple, public bus/ticket icon from a CDN
    const iconUrl = 'https://cdn-icons-png.flaticon.com/128/3097/3097180.png';

    const iconPath = path.join(templatePath, 'icon.png');
    const icon2xPath = path.join(templatePath, 'icon@2x.png');
    const icon3xPath = path.join(templatePath, 'icon@3x.png');

    // Check if icons already exist
    // if (fs.existsSync(iconPath) && fs.existsSync(icon2xPath)) {
    //   console.log('✓ Icons already exist');
    //   return;
    // }

    console.log('Downloading icon from CDN...');
    await downloadImage(iconUrl, iconPath);

    // Copy the same icon for @2x and @3x (not ideal, but works as placeholder)
    fs.copyFileSync(iconPath, icon2xPath);
    fs.copyFileSync(iconPath, icon3xPath);

    console.log('✓ Icons created successfully');
  } catch (error) {
    console.error('Failed to create icons:', error);
    throw new Error('Could not create required pass icons');
  }
};

const loadCertificates = async (certificatesPath) => {
  try {
    console.log('Loading certificates from:', certificatesPath);

    const wwdrPath = path.join(certificatesPath, 'WWDR.cer');
    const signerCertPath = path.join(certificatesPath, 'signerCert.pem');
    const signerKeyPath = path.join(certificatesPath, 'passkey.pem');

    if (!fs.existsSync(wwdrPath)) throw new Error('WWDR.cer not found');
    if (!fs.existsSync(signerCertPath)) throw new Error('signerCert.pem not found');
    if (!fs.existsSync(signerKeyPath)) throw new Error('passkey.pem not found');

    let wwdrContent = fs.readFileSync(wwdrPath);
    const signerCert = fs.readFileSync(signerCertPath);
    const signerKey = fs.readFileSync(signerKeyPath);

    console.log('Certificate sizes:', {
      wwdr: wwdrContent.length,
      signerCert: signerCert.length,
      signerKey: signerKey.length
    });

    const wwdrString = wwdrContent.toString('utf8');
    if (!wwdrString.includes('-----BEGIN CERTIFICATE-----')) {
      console.log('Converting WWDR from DER to PEM format');
      const base64Cert = wwdrContent.toString('base64');
      const pemLines = base64Cert.match(/.{1,64}/g) || [];
      wwdrContent = Buffer.from(
        '-----BEGIN CERTIFICATE-----\n' +
        pemLines.join('\n') +
        '\n-----END CERTIFICATE-----\n'
      );
    }

    const certs = {
      wwdr: wwdrContent,
      signerCert: signerCert,
      signerKey: signerKey,
      ...(process.env.APPLE_CERT_PASSPHRASE && {
        signerKeyPassphrase: process.env.APPLE_CERT_PASSPHRASE
      })
    };

    console.log('✓ Certificates loaded successfully');
    return certs;

  } catch (error) {
    console.error('❌ Certificate loading failed:', error);
    throw new Error(`Certificate loading failed: ${error.message}`);
  }
};

const createApplePass = async (ticket) => {
  try {
    const templatePath = path.join(__dirname, '../../../templates/boardingPass.pass');
    console.log('Template path:', templatePath);

    if (!fs.existsSync(templatePath)) {
      fs.mkdirSync(templatePath, { recursive: true });
      console.log('Created template directory');
    }

    // Create required icons
    await createPassIcons(templatePath);

    const certificatesPath = path.join(__dirname, '../credentials/apple');
    const certificates = await loadCertificates(certificatesPath);
    console.log('✓ Certificates loaded');

    const departureDate = new Date(ticket.departure_date);
    const formattedDate = departureDate.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const formattedTime = departureDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    let passengerName = 'Guest';
    if (ticket.passengers) {
      if (Array.isArray(ticket.passengers) && ticket.passengers.length > 0) {
        passengerName = ticket.passengers[0].full_name || ticket.passengers[0].name || 'Guest';
      } else if (ticket.passengers.full_name) {
        passengerName = ticket.passengers.full_name;
      }
    }

    console.log('Creating pass with data:', {
      passenger: passengerName,
      from: ticket.labels?.from_city || ticket.from_city,
      to: ticket.labels?.to_city || ticket.to_city,
      date: formattedDate,
      time: formattedTime
    });

    const pass = await PKPass.from({
      model: templatePath,
      certificates
    }, {
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER || 'pass.gobusly.wallet',
      teamIdentifier: process.env.APPLE_TEAM_ID || '2C6N68U24F',
      organizationName: 'GoBusly',
      description: 'GoBusly Bus Ticket',
      serialNumber: ticket._id.toString(),
      backgroundColor: 'rgb(107, 156, 196)',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(255, 255, 255)',
    });

    pass.type = 'boardingPass';
    pass.transitType = 'PKTransitTypeBus';

    const originCity = ticket.labels?.from_city || ticket.from_city || 'Unknown';
    const destinationCity = ticket.labels?.to_city || ticket.to_city || 'Unknown';

    pass.primaryFields.push(
      {
        key: 'origin',
        label: 'FROM',
        value: originCity
      },
      {
        key: 'destination',
        label: 'TO',
        value: destinationCity
      }
    );

    pass.secondaryFields.push(
      {
        key: 'passenger',
        label: 'PASSENGER',
        value: passengerName
      },
      {
        key: 'seat',
        label: 'SEAT',
        value: ticket.seat_number || 'N/A'
      }
    );

    pass.auxiliaryFields.push(
      {
        key: 'date',
        label: 'DATE',
        value: formattedDate
      },
      {
        key: 'time',
        label: 'DEPARTURE',
        value: formattedTime
      },
      {
        key: 'operator',
        label: 'OPERATOR',
        value: ticket.operator?.name || 'GoBusly'
      }
    );

    pass.backFields.push(
      {
        key: 'ticketId',
        label: 'Ticket ID',
        value: ticket._id.toString()
      },
      {
        key: 'price',
        label: 'Total Price',
        value: `€${ticket.price ? ticket.price.toFixed(2) : '0.00'}`
      },
      {
        key: 'bookingRef',
        label: 'Booking Reference',
        value: ticket.booking_reference || ticket._id.toString().slice(-8)
      },
      {
        key: 'route',
        label: 'Route Details',
        value: `${originCity} → ${destinationCity}`
      },
      {
        key: 'terms',
        label: 'Terms & Conditions',
        value: 'This ticket is valid for one journey only. Please arrive 15 minutes before departure.'
      },
      {
        key: 'contact',
        label: 'Customer Support',
        value: 'For assistance, contact us at support@gobusly.com'
      }
    );

    if (ticket.qrCode) {
      pass.barcodes = [
        {
          format: 'PKBarcodeFormatQR',
          message: ticket.qrCode,
          messageEncoding: 'utf-8',
          altText: `Ticket: ${ticket._id.toString()}`
        }
      ];
    }

    pass.relevantDate = departureDate.toISOString();
    pass.expirationDate = new Date(departureDate.getTime() + (24 * 60 * 60 * 1000)).toISOString();

    console.log('Generating pass buffer...');
    const buffer = pass.getAsBuffer();

    console.log('✓ Pass buffer generated:', {
      size: buffer.length,
      firstBytes: buffer.slice(0, 4).toString('hex')
    });

    if (!buffer || buffer.length < 1000) {
      throw new Error(`Pass buffer is too small (${buffer.length} bytes) - likely generation failed`);
    }

    return buffer;

  } catch (error) {
    console.error('❌ createApplePass error:', error);
    throw new Error(`Failed to create Apple pass: ${error.message}`);
  }
};

module.exports = { createApplePass };