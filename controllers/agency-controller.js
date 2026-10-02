const { ok, server_error, created, error_404, bad_request, unauthorized } = require("../functions/responses");
const { removePassword, getRandomInt } = require("../functions/security");
const Agency = require("../models/Agency");
const Booking = require("../models/Booking");
const AgencyDailyReport = require("../models/AgencyDailyReport");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { users } = require("../appwrite/appwrite.config");
const { sendOtp } = require("../helpers/email");
const moment = require("moment-timezone");

const getAgencyPercentage = (agency) => {
  const percentage = Number(agency?.financial_data?.percentage);
  if (!Number.isFinite(percentage)) return 0;
  return Math.min(Math.max(percentage, 0), 100);
};

const calculateAgencyFinancialData = async (agency) => {
  if (!agency?._id) return agency;

  const percentage = getAgencyPercentage(agency);
  const [paidTotals = {}, unpaidTotals = {}] = await Promise.all([
    Booking.aggregate([
      {
        $match: {
          agency: agency._id,
          is_paid: { $in: [true, "true"] },
        },
      },
      {
        $group: {
          _id: null,
          total_sales: { $sum: "$price" },
        },
      },
    ]).then(([result]) => result || {}),
    Booking.aggregate([
      {
        $match: {
          agency: agency._id,
          is_paid: { $in: [true, "true"] },
          is_agency_debt_paid: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          total_sales: { $sum: "$price" },
        },
      },
    ]).then(([result]) => result || {}),
  ]);

  const totalSales = paidTotals.total_sales || 0;
  const unpaidSales = unpaidTotals.total_sales || 0;
  const profit = (totalSales * percentage) / 100;
  const debt = unpaidSales - (unpaidSales * percentage) / 100;

  agency.financial_data = {
    ...(agency.financial_data?.toObject?.() || agency.financial_data || {}),
    total_sales: totalSales,
    profit,
    debt,
  };

  await agency.save();
  return agency;
};

module.exports = {
  createAgency: async (req, res) => {
    try {
      const { name, email, password, company_metadata, contact, address, financial_data } = req.body.agency;
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ message: "Password is required and must be a string." });
      }

      const salt = bcrypt.genSaltSync(10);
      const hashed_password = bcrypt.hashSync(password, salt);

      const new_agency = new Agency({
        name,
        email,
        password: hashed_password,
        company_metadata,
        contact,
        financial_data,
        address,
      });

      if (!new_agency) {
        return res.status(403).json({ message: "Error creating agency." });
      }

      const appwrite_agency = await users.createBcryptUser(
        new_agency._id,
        email,
        hashed_password,
        name,
      );

      if (!appwrite_agency) {
        return bad_request(res, "Error creating appwrite agency.", null);
      }

      await users.updateLabels(
        appwrite_agency.$id,
        ['agency']
      );

      await new_agency.save();
      created(res, "Agency created", null);
    } catch (error) {
      server_error(res, error.message || error, null);
    }
  },

  login: async (req, res) => {
    try {
      console.log({ body: req.body });

      const agency = await Agency.findOne({ email: req.body.email });
      if (!agency) {
        return res.status(401).json({ message: "Invalid Email" });
      }

      const validPassword = await bcrypt.compare(
        req.body.password,
        agency.password
      );

      if (!validPassword) {
        return res.status(401).json({ data: null, message: "Invalid  Password" });
      }

      await calculateAgencyFinancialData(agency);
      const token = agency.generateAuthToken(agency);

      return res.status(200).json({ data: token, message: "logged in successfully" });
    } catch (error) {
      server_error(res, error.message || error, null);
    }
  },

  getById: async (req, res) => {
    try {
      let { select } = req.query;
      const agency = await Agency.findById(req.params.id).select(select);
      if (!agency) {
        return error_404(res, "Agency not found", null);
      }

      await calculateAgencyFinancialData(agency);

      if (agency.password) {
        removePassword(agency);
      }

      ok(res, "", agency);
    } catch (error) {
      server_error(res, error.message || error, null);
    }
  },

  getAll: async (req, res) => {
    try {
      let { select, page = 1, limit = 10 } = req.query;

      page = parseInt(page);
      limit = parseInt(limit);

      const skip = (page - 1) * limit;

      const agencies = await Agency.find()
        .select(select)
        .skip(skip)
        .limit(limit);

      if (!agencies || agencies.length === 0) {
        return error_404(res, "No agencies found", null);
      }

      await Promise.all(agencies.map(calculateAgencyFinancialData));

      agencies.forEach(agency => {
        if (agency.password) {
          removePassword(agency);
        }
      });

      ok(res, "Agencies data", agencies);
    } catch (error) {
      server_error(res, error.message || "Internal server error", null);
    }
  },

  editAgency: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...(req.body.agency || {}) };

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return bad_request(res, "Invalid agency id", null);
      }

      const existingAgency = await Agency.findById(id);
      if (!existingAgency) {
        return error_404(res, "Agency not found", null);
      }

      if (updateData.email && updateData.email !== existingAgency.email) {
        const duplicateAgency = await Agency.findOne({
          _id: { $ne: id },
          email: updateData.email,
        }).select("_id");
        if (duplicateAgency) {
          return bad_request(res, "An agency with this email already exists", null);
        }
      }

      if (updateData.company_metadata?.vat) {
        updateData.company_metadata.tax_number = updateData.company_metadata.vat;
        delete updateData.company_metadata.vat;
      }

      const plainPassword = updateData.password;

      if (updateData.password) {
        const salt = bcrypt.genSaltSync(10);
        updateData.password = bcrypt.hashSync(updateData.password, salt);
      } else {
        delete updateData.password;
      }

      const updatedAgency = await Agency.findByIdAndUpdate(id, { $set: updateData }, { new: true });

      if (plainPassword) {
        await users.updatePassword(id, plainPassword);
      }
      if (updateData.name || updateData.email) {
        if (updateData.name) await users.updateName(id, updateData.name);
        if (updateData.email) await users.updateEmail(id, updateData.email);
      }

      removePassword(updatedAgency);
      ok(res, "Agency updated successfully", updatedAgency);
    } catch (error) {
      server_error(res, error.message || error, null);
    }
  },

  deleteAgency: async (req, res) => {
    try {
      const { id } = req.params;
      const deletedAgency = await Agency.findByIdAndDelete(id);
      if (!deletedAgency) {
        return error_404(res, "Agency not found", null);
      }

      await users.delete(id);
      ok(res, "Agency deleted successfully", null);
    } catch (error) {
      server_error(res, error.message || error, null);
    }
  },

  sendOtp: async (req, res) => {
    try {
      const email = req.query.email || req.body.email;
      const agency = await Agency.findOne({ email });
      if (!agency) {
        return error_404(res, "Agency with this email not found", null);
      }

      const otp = getRandomInt();
      const valid_until = new Date();
      valid_until.setMinutes(valid_until.getMinutes() + 10);

      agency.otp = { code: otp, valid_until };
      await agency.save();

      sendOtp(otp, email);
      ok(res, "OTP sent successfully", null);
    } catch (error) {
      server_error(res, error.message || error, null);
    }
  },

  verifyOtp: async (req, res) => {
    try {
      const email = req.query.email || req.body.email;
      const otp = req.query.otp || req.body.otp;

      const agency = await Agency.findOne({ email });
      if (!agency) {
        return error_404(res, "Agency not found", null);
      }

      if (!agency.otp || parseInt(otp) !== parseInt(agency.otp.code)) {
        return unauthorized(res, "Invalid OTP", null);
      }

      if (new Date() > agency.otp.valid_until) {
        return unauthorized(res, "OTP expired", null);
      }

      ok(res, "OTP verified successfully", null);
    } catch (error) {
      server_error(res, error.message || error, null);
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { email, otp, new_password } = req.body;
      const agency = await Agency.findOne({ email });

      if (!agency || !agency.otp || parseInt(otp) !== parseInt(agency.otp.code)) {
        return unauthorized(res, "Invalid verification details", null);
      }

      if (new Date() > agency.otp.valid_until) {
        return unauthorized(res, "Verification expired", null);
      }

      const salt = bcrypt.genSaltSync(10);
      const hashed_password = bcrypt.hashSync(new_password, salt);

      agency.password = hashed_password;
      agency.otp = undefined;
      await agency.save();

      await users.updatePassword(agency._id, hashed_password);
      ok(res, "Password reset successfully", null);
    } catch (error) {
      server_error(res, error.message || error, null);
    }
  },

  payAgencyMonthlyDebt: async (req, res) => {
    try {
      const { id } = req.params;
      const { year, month } = req.body;

      if (!year || !month) {
        return bad_request(res, "Year and month are required", null);
      }

      const agency = await Agency.findById(id).select("financial_data.percentage financial_data.debt");
      if (!agency) {
        return error_404(res, "Agency not found", null);
      }

      const percentage = getAgencyPercentage(agency);
      const startOfMonth = moment.utc().year(year).month(month - 1).startOf('month').toDate();
      const endOfMonth = moment.utc().year(year).month(month - 1).endOf('month').toDate();

      const unpaidBookings = await Booking.find({
        agency: id,
        is_paid: { $in: [true, "true"] },
        is_agency_debt_paid: { $ne: true },
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      }).select("price");

      if (unpaidBookings.length === 0) {
        return bad_request(res, "No unpaid debts found for this month.", null);
      }

      const totalSalesForMonth = unpaidBookings.reduce((acc, booking) => acc + (booking.price || 0), 0);
      const commission = (totalSalesForMonth * percentage) / 100;
      const debtToMarkAsPaid = totalSalesForMonth - commission;

      await Booking.updateMany(
        {
          _id: { $in: unpaidBookings.map(b => b._id) }
        },
        { $set: { is_agency_debt_paid: true } }
      );

      agency.financial_data.debt = Math.max(0, (agency.financial_data.debt || 0) - debtToMarkAsPaid);
      await agency.save();

      ok(res, "Agency debt for specified month marked as paid and deducted from total debt", {
        deducted_amount: debtToMarkAsPaid,
        remaining_total_debt: agency.financial_data.debt
      });
    } catch (error) {
      server_error(res, error.message || error, null);
    }
  },

  getMonthlySalesReport: async (req, res) => {
    try {
      const { id } = req.params;

      const agency = await Agency.findById(id).select("financial_data.percentage");
      if (!agency) {
        return error_404(res, "Agency not found", null);
      }

      const percentage = getAgencyPercentage(agency);

      const report = await Booking.aggregate([
        {
          $match: {
            agency: new mongoose.Types.ObjectId(id),
            is_paid: { $in: [true, "true"] }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            total_sales: { $sum: "$price" },
            booking_count: { $sum: 1 },
            is_settled: { $min: { $cond: [{ $eq: ["$is_agency_debt_paid", true] }, 1, 0] } }
          }
        },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            total_sales: 1,
            booking_count: 1,
            is_settled: { $cond: [{ $eq: ["$is_settled", 1] }, true, false] },
            profit: {
              $divide: [
                { $multiply: ["$total_sales", percentage] },
                100
              ]
            },
            debt: {
              $cond: [
                { $eq: ["$is_settled", 1] },
                0,
                {
                  $subtract: [
                    "$total_sales",
                    {
                      $divide: [
                        { $multiply: ["$total_sales", percentage] },
                        100
                      ]
                    }
                  ]
                }
              ]
            }
          }
        },
        {
          $sort: { year: -1, month: -1 }
        }
      ]);

      ok(res, "Monthly sales report", report);
    } catch (error) {
      server_error(res, error.message || error, null);
    }
  },

  closeAgencyDayReport: async (req, res) => {
    try {
      const { id } = req.params;
      const timezone = req.body?.timezone || "Europe/Skopje";

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return bad_request(res, "Invalid agency id", null);
      }

      const agency = await Agency.findById(id).select(
        "name email company_metadata financial_data",
      );
      if (!agency) {
        return error_404(res, "Agency not found", null);
      }

      const now = moment.tz(timezone);
      const reportDate = now.format("YYYY-MM-DD");
      const previousShift = await AgencyDailyReport.findOne({ agency: id })
        .sort({ end_at: -1 })
        .select("end_at");
      const startAt = previousShift?.end_at
        ? previousShift.end_at
        : now.clone().startOf("day").toDate();
      const endAt = now.toDate();

      const bookings = await Booking.find({
        agency: id,
        is_paid: { $in: [true, "true"] },
        createdAt: { $gt: startAt, $lte: endAt },
      })
        .sort({ createdAt: 1 })
        .select(
          "external_id route ticket labels departure_date passengers price metadata createdAt",
        );

      const totalsMap = new Map();
      const bookingSnapshots = bookings.map((booking) => {
        const currency = booking.metadata?.price_currency || "EUR";
        const passengerCount = booking.passengers?.length || 0;
        const price = Number(booking.price || 0);
        const current = totalsMap.get(currency) || {
          currency,
          total: 0,
          booking_count: 0,
          passenger_count: 0,
        };

        current.total += price;
        current.booking_count += 1;
        current.passenger_count += passengerCount;
        totalsMap.set(currency, current);

        return {
          booking: booking._id,
          external_id: booking.external_id,
          route: booking.route,
          ticket: booking.ticket,
          from_city: booking.labels?.from_city,
          to_city: booking.labels?.to_city,
          departure_date: booking.departure_date,
          sold_at: booking.createdAt,
          passenger_count: passengerCount,
          price,
          currency,
          passengers: (booking.passengers || []).map((passenger) => ({
            full_name: passenger.full_name,
            phone: passenger.phone,
            email: passenger.email,
            price: passenger.price,
          })),
        };
      });

      const report = await AgencyDailyReport.findOneAndUpdate(
        { agency: id, report_date: reportDate },
        {
          $set: {
            agency: id,
            report_date: reportDate,
            timezone,
            start_at: startAt,
            end_at: endAt,
            booking_count: bookings.length,
            passenger_count: bookingSnapshots.reduce(
              (sum, booking) => sum + (booking.passenger_count || 0),
              0,
            ),
            totals_by_currency: Array.from(totalsMap.values()),
            bookings: bookingSnapshots,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      ok(res, "Agency day closed", {
        report,
        agency: {
          _id: agency._id,
          name: agency.name,
          email: agency.email,
          company_metadata: agency.company_metadata,
        },
      });
    } catch (error) {
      server_error(res, error.message || error, null);
    }
  },
};
