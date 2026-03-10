require("dotenv").config();
const { ok, server_error, created, bad_request, unauthorized, error_404 } = require("../functions/responses");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { users } = require("../appwrite/appwrite.config")
const { removePassword, getRandomInt } = require("../functions/security");
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const { ID } = require("node-appwrite");
const { sendOtp } = require("../helpers/email");
const { default: axios } = require("axios");
const Booking = require("../models/Booking");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const htmlToPdf = require('html-pdf-node');

module.exports = {
  createUser: async (req, res) => {
    try {
      const { name, email, password } = req.body;

      const salt = bcrypt.genSaltSync(10);

      const hashed_password = bcrypt.hashSync(password, salt);

      const customer = await stripe.customers.create({
        name: name,
        email: email,
      });

      const new_user = new User({
        name,
        email,
        password: hashed_password,
        stripe_customer_id: customer.id,
      });

      if (!new_user) {
        bad_request(res, "Error creating user.", null);
      }

      const appwrite_user = await users.createBcryptUser(
        new_user._id,
        email,
        hashed_password,
        name,
      );

      await users.updatePrefs(new_user._id, {
        stripe_customer_id: customer.id,
      })

      if (!appwrite_user) {
        bad_request(res, "Error creating appwrite user.", null);
      }

      await new_user.save();
      created(res, "User created", appwrite_user);
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  createDbUser: async (req, res) => {
    try {
      const { name, email, phone } = req.body;
      const userExists = await User.findOne({ email }).select("email");
      if (userExists) {
        return res.status(403).json({ message: "User exists", data: null, created: false })
      }

      const customer = await stripe.customers.create({
        name: name,
        email: email,
      });

      let password = new Date().getMilliseconds() + email + "EtnMuil";

      const new_user = new User({
        name,
        email,
        phone,
        stripe_customer_id: customer.id,
        password: password,
        profile_picture: req.body.profile_picture || null,
      });

      if (!new_user) {
        bad_request(res, "Error creating user.", null);
      }

      await new_user.save();
      created(res, "User created", new_user._id);
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  createAppwriteUser: async (req, res) => {
    try {
      const { name, email, password, mongodbCollectionId } = req.body.registerUserDto;
      const new_user = await users.createBcryptUser(
        mongodbCollectionId || ID.unique(),
        email,
        password,
        name,
      );

      if (!new_user) {
        bad_request(res, "Error creating user.", null);
      }

      return res.status(201).json({ message: "User created", data: null });
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  cookieLogin: async (req, res) => {
    try {
      const user = await User.findOne({ email: req.body.email }).select("password");
      if (!user) {
        unauthorized(res, "Invalid  email", null)
      }

      const validPassword = await bcrypt.compare(
        req.body.password,
        user.password
      );

      if (!validPassword) {
        unauthorized(res, "Invalid  Password", null)
      }

      const token = user.generateAuthToken(user);

      ok(res, "logged in successfully", token)
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  login: async (req, res) => {
    try {

      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        unauthorized(res, "Invalid  email", null)
      }
      const validPassword = await bcrypt.compare(
        req.body.password,
        user.password
      );

      if (!validPassword) {
        unauthorized(res, "Invalid  Password", null)
      }

      const token = user.generateAuthToken(user);

      ok(res, "logged in successfully", token)
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },



  getById: async (req, res) => {
    try {
      const { select } = req.query;

      let userId = req.params.id;
      let query;

      if (mongoose.Types.ObjectId.isValid(userId)) {
        userId = new mongoose.Types.ObjectId(userId);
        query = { _id: userId };
      } else {
        query = { appwrite_id: userId };
      }

      const user = await User.findOne(query).select(select);

      if (user?.password) {
        removePassword(user);
      }

      ok(res, "", user);
    } catch (error) {
      const errorMessage = error.response?.message || error.message || "Unknown error";
      server_error(res, errorMessage, null); f
    }
  },

  getByEmail: async (req, res) => {
    try {
      const session = JSON.parse(req.query.session);

      const user = await User.findOne({ email: req.query.email }).select("-password");

      const data = {
        ...user?._doc,
        image: session?.image
      }
      ok(res, "", data);
    } catch (error) {
      const errorMessage = error.response?.message || error.message || "Unknown error";
      server_error(res, errorMessage, null);
    }
  },

  updateNotifications: async (req, res) => {
    try {
      const { id } = req.params;
      const { notifications } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return bad_request(res, "Invalid user ID", null);
      }

      const validNotificationTypes = [
        'booking_confirmations',
        'departure_reminders',
        'promotions',
        'account_updates',
        'sms'
      ];

      if (!notifications || typeof notifications !== 'object') {
        return bad_request(res, "Notifications object is required", null);
      }

      const providedKeys = Object.keys(notifications);
      const invalidKeys = providedKeys.filter(key => !validNotificationTypes.includes(key));

      if (invalidKeys.length > 0) {
        return bad_request(res, `Invalid notification types: ${invalidKeys.join(', ')}`, null);
      }

      const invalidValues = providedKeys.filter(key => typeof notifications[key] !== 'boolean');

      if (invalidValues.length > 0) {
        return bad_request(res, "All notification values must be boolean (true/false)", null);
      }

      const user = await User.findById(id);

      if (!user) {
        return error_404(res, "User not found", null);
      }

      const updateObject = {};
      for (const key of providedKeys) {
        updateObject[`notifications.${key}`] = notifications[key];
      }

      const updatedUser = await User.findByIdAndUpdate(
        id,
        { $set: updateObject },
        { new: true, runValidators: true }
      ).select('-password');

      if (!updatedUser) {
        return server_error(res, "Failed to update notification preferences", null);
      }

      ok(res, "Notification preferences updated successfully", {
        user_id: updatedUser._id,
        notifications: updatedUser.notifications
      });

    } catch (error) {
      server_error(res, error.message || "Error updating notification preferences", null);
    }
  },

  getAll: async (req, res) => {
    try {
      const { select, page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;
      const users = await User.find({})
        .select(select)
        .select('-password')
        .sort({ createdAt: 'desc' })
        .skip(skip)
        .limit(Number(limit));


      if (!users || users.length === 0) {
        return error_404(res, "", null);
      }

      return ok(res, "All user data", users);
    } catch (error) {
      return server_error(res, error.message || error.response?.message || "Internal Server Error", null);
    }
  },

  getUserSessions: async (req, res) => {
    try {
      const sessions = await users.listSessions(req.params.user_id);
      return res.status(200).json({ message: "User sessions", data: sessions })
    } catch (error) {
      return server_error(res, error.message || error.response?.message || "Internal Server Error", null);
    }
  },

  deleteUserSession: async (req, res) => {
    try {
      const result = await users.deleteSession(
        req.params.user_id, // userId
        req.params.session_id // sessionId
      );

      return res.status(200).json({ message: "Session deleted", data: null })
    } catch (error) {
      return server_error(res, error.message || error.response?.message || "Internal Server Error", null);
    }
  },

  deleteUser: async (req, res) => {
    const { user_id } = req.params;
    try {
      const [deletedMongoUser, deletedAppwriteUser] = await Promise.all([
        User.findByIdAndDelete(user_id),
        users.delete(user_id),
      ]);

      if (!deletedMongoUser || !deletedAppwriteUser) {
        return res.status(403).json({
          message: "Failed to delete user. Please try again.",
          data: null
        });
      }

      return res.status(200).json({
        message: "User account deleted successfully.",
        data: null
      });

    } catch (error) {
      return res.status(500).json({
        message: error.message || "Internal Server Error",
        data: null
      });
    }
  },

  editName: async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      user.name = req.body.name;
      await user.save()
      ok(res, "Name updated");
    } catch (error) {
      server_error(res, error.message);
    }
  },

  editPhone: async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      user.phone = req.body.phone;
      await user.save()
      ok(res, "Phone updated");
    } catch (error) {
      server_error(res, error.message);
    }
  },


  sendOtp: async (req, res) => {
    try {
      console.log({ bodyt: req.body });

      const otp = getRandomInt();
      const valid_until = new Date();
      valid_until.setMinutes(valid_until.getMinutes() + 10);

      const updated = await User.findOneAndUpdate(
        { email: req.query.email || req.body.email },
        { $set: { 'otp.code': otp, 'otp.valid_until': valid_until } }
      );
      console.log({ updated });


      if (!updated) {
        const email = req.query.email || req.body.email;
        const name = email.split("@")[0] || "";

        const customer = await stripe.customers.create({
          name: name,
          email: email,
        });

        let password = new Date().getMilliseconds() + email + otp + new Date().getMilliseconds() + otp;
        const new_user = new User({
          name,
          email,
          password: password,
          stripe_customer_id: customer.id,
          otp: { code: otp, valid_until }
        });

        await new_user.save();
      }

      console.log({ updated })
      sendOtp(otp, req.query.email || req.body.email)

      ok(res, "", otp);
    } catch (error) {
      server_error(res, error.message);
    }
  },

  verifyOtp: async (req, res) => {
    try {
      const email = req.query.email || req.body.email;
      const otp = req.query.otp || req.body.otp;
      const user = await User.findOne({ email }).select('-password');

      if (parseInt(otp) !== parseInt(user.otp.code)) {
        return res.status(401).json({ message: "Wrong OTP", data: null });
      }

      // const response = await axios.post(`${process.env.API_URL_V2}/user/create/db`, { name: email.split('@')[0], email: email, phone: "" });

      res.cookie("custom_auth", user);
      ok(res, "Vaild OTP", user);
    } catch (error) {
      server_error(res, error.message);
    }
  },

  exportUserData: async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId).lean();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const bookings = await Booking.find({ user: userId }).lean();

      const bookingRows = bookings.map(booking => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${booking._id}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(booking.departure_date).toLocaleDateString()}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${booking.labels?.from_city || 'N/A'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${booking.labels?.to_city || 'N/A'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">€${booking.price}</td>
            </tr>
        `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
                .header { text-align: center; margin-bottom: 40px; }
                .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                .subtitle { font-size: 14px; color: #666; }
                .section { margin-bottom: 30px; }
                .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #ff4545; padding-bottom: 5px; }
                .info-table { width: 100%; border-collapse: collapse; }
                .info-table td { padding: 8px; border-bottom: 1px solid #ddd; }
                .info-table td:first-child { font-weight: bold; width: 150px; }
                .booking-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .booking-table th { background-color: #ff4545; color: white; padding: 10px; text-align: left; }
                .booking-table td { padding: 8px; border-bottom: 1px solid #ddd; }
                .no-bookings { text-align: center; padding: 20px; color: #666; font-style: italic; }
                .notification-item { padding: 4px 0; }
                .notification-status { font-weight: normal; color: #666; }
                .enabled { color: #28a745; }
                .disabled { color: #dc3545; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">GoBusly User Data Export</div>
                <div class="subtitle">Generated on ${new Date().toLocaleDateString()}</div>
            </div>

            <div class="section">
                <div class="section-title">Personal Information</div>
                <table class="info-table">
                    <tr><td>User ID</td><td>${user?._id}</td></tr>
                    <tr><td>Email</td><td>${user?.email || 'N/A'}</td></tr>
                    <tr><td>Name</td><td>${user?.name || 'N/A'}</td></tr>
                    <tr><td>Phone</td><td>${user?.phone || 'N/A'}</td></tr>
                    <tr><td>Account Created</td><td>${new Date(user?.createdAt).toLocaleDateString()}</td></tr>
                    <tr><td>Last Updated</td><td>${new Date(user?.updatedAt).toLocaleDateString()}</td></tr>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Account Details</div>
                <table class="info-table">
                    <tr><td>FCM Token</td><td>${user?.fcm_token || 'N/A'}</td></tr>
                    <tr><td>Stripe Customer ID</td><td>${user?.stripe_customer_id || 'N/A'}</td></tr>
                    <tr><td>Payment Methods</td><td>${user?.stripe_payment_method_ids?.length || 0} saved payment method(s)</td></tr>
                </table>
            </div>

            <div class="section">
                <div class="section-title">OTP Information</div>
                <table class="info-table">
                    <tr><td>Current OTP Code</td><td>${user.otp?.code || 'None'}</td></tr>
                    <tr><td>OTP Valid Until</td><td>${user.otp?.valid_until ? new Date(user?.otp?.valid_until).toLocaleString() : 'N/A'}</td></tr>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Notification Preferences</div>
                <table class="info-table">
                    <tr>
                        <td>Booking Confirmations</td>
                        <td>
                            <span class="notification-status ${user.notifications?.booking_confirmations !== false ? 'enabled' : 'disabled'}">
                                ${user.notifications?.booking_confirmations !== false ? 'Enabled' : 'Disabled'}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td>Departure Reminders</td>
                        <td>
                            <span class="notification-status ${user.notifications?.departure_reminders !== false ? 'enabled' : 'disabled'}">
                                ${user.notifications?.departure_reminders !== false ? 'Enabled' : 'Disabled'}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td>Promotions</td>
                        <td>
                            <span class="notification-status ${user.notifications?.promotions !== false ? 'enabled' : 'disabled'}">
                                ${user.notifications?.promotions !== false ? 'Enabled' : 'Disabled'}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td>Account Updates</td>
                        <td>
                            <span class="notification-status ${user.notifications?.account_updates !== false ? 'enabled' : 'disabled'}">
                                ${user.notifications?.account_updates !== false ? 'Enabled' : 'Disabled'}
                            </span>
                        </td>
                    </tr>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Booking History</div>
                ${bookings.length > 0 ? `
                <table class="booking-table">
                    <thead>
                        <tr>
                            <th>Booking ID</th>
                            <th>Date</th>
                            <th>From</th>
                            <th>To</th>
                            <th>Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookingRows}
                    </tbody>
                </table>
                ` : '<div class="no-bookings">No bookings found</div>'}
            </div>
        </body>
        </html>
        `;

      const options = {
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        printBackground: true,
        preferCSSPageSize: true
      };

      const file = { content: htmlContent };
      const pdfBuffer = await htmlToPdf.generatePdf(file, options);

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `gobusly_user_data_${userId}_${timestamp}.pdf`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);

      return res.send(pdfBuffer);

    } catch (error) {
      return res.status(500).json({
        error: 'Failed to generate data export',
        message: error.message
      });
    }
  },
};
