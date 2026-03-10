const { server_error, created } = require("../functions/responses");
const Affiliate = require("../models/Affiliate");
const bcrypt = require("bcryptjs");
const Booking = require("../models/Booking");
const AffiliateViews = require("../models/AffiliateViews");
const { default: mongoose } = require("mongoose");


module.exports = {

  register: async (req, res) => {
    try {
      const salt = bcrypt.genSaltSync(10);
      const hashed_password = bcrypt.hashSync(req.body.password, salt);

      const payload = {
        name: req.body.name,
        email: req.body.email,
        password: hashed_password,
        code: req.body.code,
      }

      const newAffiliate = new Affiliate(payload);
      await newAffiliate.save();
      created(res, "Affiliate profile created", null);
    } catch (error) {
      server_error(res);
    }
  },

  login: async (req, res) => {
    try {

      const user = await Affiliate.findOne({ email: req.body.email });
      if (!user) {
        return res.status(403).json({ message: "invalid email", data: null })
      }
      const validPassword = await bcrypt.compare(
        req.body.password,
        user.password
      );

      if (!validPassword) {
        return res.status(403).json({ message: "invalid password", data: null })
      }

      const token = user.generateAuthToken(user);

      return res.status(200).json({ message: "Login successfull", data: token })
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  getById: async (req, res) => {
    try {
      return res.status(200).json({ message: "User data", data: await Affiliate.findById(req.params.id).select("name email is_active code") })
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  getAll: async (req, res) => {
    try {
      return res.status(200).json({ message: "Affiliates data", data: await Affiliate.find({}).select("name email is_active code").sort({ createdAt: 'desc' }) })
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  activate: async (req, res) => {
    try {
      await Affiliate.findByIdAndUpdate(req.params.id, { $set: { is_active: true } });
      return res.status(201).json({ message: "Activation successfull", data: null })
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  addCode: async (req, res) => {
    try {
      await Affiliate.findByIdAndUpdate(req.params.id, { $set: { code: req.body.code } });
      return res.status(201).json({ message: "Code added successfully", data: null })
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  countViews: async (req, res) => {
    try {
      const affiliate_acc = await Affiliate.findOne({ code: req.body.affiliate_code }).select("code");
      const new_view = new AffiliateViews({ origin: req.body.origin, affiliate: affiliate_acc?._id });
      await new_view.save();
      return res.status(201).json({ message: "View added", data: null })
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  getViewsCount: async (req, res) => {
    try {
      const views = await AffiliateViews.countDocuments({ affiliate: req.params.id });
      return res.status(200).json({ message: "Views", data: views });
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  getBookings: async (req, res) => {
    try {
      const bookings = await Booking.find({ affiliate: req.params.id });
      return res.status(200).json({ message: "Bookings", data: bookings });
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  getByOrigin: async (req, res) => {
    try {
      const views = await AffiliateViews.aggregate([
        {
          $match: {
            affiliate: new mongoose.Types.ObjectId(req.params.id)
          }
        },
        {
          $group: {
            _id: "$origin",
            count: { $sum: 1 },
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      return res.status(200).json({ message: "Views grouped by origin", data: views });
    } catch (error) {
      server_error(res, error || error.response?.message, null);
    }
  },


}