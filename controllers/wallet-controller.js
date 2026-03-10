const path = require("path");
const fs = require("fs");
const { server_error } = require("../functions/responses");
const Booking = require("../models/Booking");
const Ticket = require("../models/Ticket");
const { createApplePass } = require("../utils/wallet/boardingPass/apple");
const { createGooglePass } = require("../utils/wallet/boardingPass/google");
const { generateQRCode } = require("../utils/wallet/qrCode");
const { InputFile } = require("node-appwrite/file");
const { storage } = require('../appwrite/appwrite.config');

module.exports = {
    generateApplePass: async (req, res) => {
        try {
            const booking = await Booking.findById(req.params.bookingId)
                .populate('ticket')
                .populate('operator')

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
            }

            const qrCode = await generateQRCode(`https://www.gobusly.com/account/bookings/${booking._id}`);
            console.log({ qrCode });

            const bookingWithQR = {
                ...booking.toObject(),
                qrCode: qrCode
            };

            const pass = await createApplePass(bookingWithQR);
            console.log({ pass });

            res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
            res.setHeader('Content-Disposition', 'attachment; filename=gobusly-boarding-pass.pkpass');
            res.setHeader('Content-Length', pass.length);

            await Booking.findByIdAndUpdate(req.params.bookingId, { 'metadata.wallet_pass_added': true });

            res.send(pass);

        } catch (error) {
            console.log({ error });
            server_error(res, error.message, null);
        }
    },

    generateGooglePass: async (req, res) => {
        try {
            const booking = await Booking.findById(req.params.bookingId).populate('ticket operator');
            if (!booking) {
                return res.status(404).json({ success: false, message: 'booking not found' });
            }

            const qrCode = await generateQRCode(`https://www.gobusly.com/account/bookings/${booking._id}`);
            const saveUrl = await createGooglePass(booking, qrCode);

            await Booking.findByIdAndUpdate(req.params.bookingId, { 'metadata.wallet_pass_added': true });

            res.status(200).json({ success: true, saveUrl });
        } catch (error) {
            server_error(res, error.message, null);
        }
    },

    generateApplePassForMobile: async (req, res) => {
        try {
            const booking = await Booking.findById(req.params.bookingId)
                .populate('ticket')
                .populate('operator')

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
            }

            console.log('Booking found:', {
                id: booking._id,
                from: booking.labels?.from_city || booking.from_city,
                to: booking.labels?.to_city || booking.to_city,
                date: booking.departure_date
            });

            const qrCode = await generateQRCode(`https://www.gobusly.com/account/bookings/${booking._id}`);
            console.log('QR Code generated, length:', qrCode?.length);

            const bookingWithQR = {
                ...booking.toObject(),
                qrCode: qrCode
            };

            // Generate the pass buffer
            console.log('Starting pass generation...');
            const passBuffer = await createApplePass(bookingWithQR);

            // CRITICAL: Validate the pass buffer
            console.log('Pass buffer generated:', {
                size: passBuffer.length,
                type: passBuffer.constructor.name,
                isBuffer: Buffer.isBuffer(passBuffer),
                firstBytes: passBuffer.slice(0, 4).toString('hex')
            });

            // Check if it's a valid ZIP file (pkpass files are ZIP archives)
            if (passBuffer.slice(0, 4).toString('hex') !== '504b0304') {
                throw new Error('Generated pass is not a valid ZIP/pkpass file. First bytes: ' + passBuffer.slice(0, 4).toString('hex'));
            }

            // Check minimum size (a valid pass should be at least 10KB)
            if (passBuffer.length < 10000) {
                console.warn('⚠️ Warning: Pass file is unusually small:', passBuffer.length, 'bytes');
                console.warn('This might indicate missing icons or certificates');
            }

            const fileId = `pass_${booking._id}`;
            const fileName = `${fileId}.pkpass`;

            const inputFile = InputFile.fromBuffer(
                passBuffer,
                fileName
            );

            // Upload to Appwrite
            console.log('Uploading to Appwrite...');
            const result = await storage.createFile(
                "6776d4b70037ef9e499f",
                fileId,
                inputFile
            );

            console.log('File uploaded successfully:', {
                fileId: result.$id,
                name: result.name,
                size: result.sizeOriginal,
                mimeType: result.mimeType
            });

            const downloadUrl = `https://api-v2.gobusly.com/wallet/download/${fileName}`;

            await Booking.findByIdAndUpdate(req.params.bookingId, {
                'metadata.wallet_pass_added': true
            });

            res.json({
                success: true,
                downloadUrl: downloadUrl,
                fileId: result.$id,
                passData: passBuffer.toString('base64'),
                mimeType: result.mimeType,
                fileSize: result.sizeOriginal,
                message: 'Apple Pass generated successfully'
            });

        } catch (error) {
            console.error('❌ Apple Pass generation failed:', error);
            console.error('Stack trace:', error.stack);
            server_error(res, error.message, error);
        }
    },

    downloadPass: async (req, res) => {
        try {
            const fileId = req.params.fileName.replace('.pkpass', '');

            console.log('Download request for:', fileId);


            // Get the file from Appwrite storage
            const retrievedFile = await storage.getFileDownload(
                '6776d4b70037ef9e499f', // bucketId
                fileId // fileId
            );

            console.log({ retrievedFile });


            console.log('File retrieved, size:', retrievedFile.byteLength);

            // CRITICAL: These headers are required for iOS to recognize the file
            res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
            res.setHeader('Content-Disposition', `attachment; filename="${fileId}.pkpass"`);
            res.setHeader('Content-Length', retrievedFile.byteLength);
            res.setHeader('Last-Modified', new Date().toUTCString());

            // CORS headers (important for web access)
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

            console.log('Serving pass file:', fileId);

            // Send the binary data
            res.send(Buffer.from(retrievedFile));
        } catch (error) {
            console.log('Download error:', error);
            if (error.code === 404) {
                return res.status(404).json({
                    success: false,
                    message: 'Pass file not found in cloud storage'
                });
            }
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to download pass'
            });
        }
    },

    savePassToCloud: async (passBuffer, bookingId) => {
        try {
            const fileId = `pass_${bookingId}_${Date.now()}`;
            const fileName = `${fileId}.pkpass`;

            const inputFile = InputFile.fromBuffer(passBuffer, fileName);

            const result = await storage.createFile(
                "6776d4b70037ef9e499f",  // Bucket ID
                fileId,                   // File ID
                inputFile                 // File data
            );

            const fileUrl = `https://cloud.appwrite.io/v1/storage/buckets/6776d4b70037ef9e499f/files/${result.$id}/view?project=${process.env.appwrite_project_id}&mode=admin`;

            return {
                fileId: result.$id,
                fileUrl: fileUrl,
                result: result
            };
        } catch (error) {
            throw error;
        }
    }
}