const { server_error, ok } = require("../functions/responses");
const Booking = require("../models/Booking");
const User = require("../models/User");
const moment = require("moment-timezone");

module.exports = {
  getDebtsForOperatorsFromSelectedDates: async (req, res) => {
    try {
      const from_date = moment.utc(req.query.fromDate).startOf('day').toDate();
      const to_date = moment.utc(req.query.toDate).endOf('day').toDate();

      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: from_date,
              $lte: to_date,
            },
            'metadata.refund_action.is_refunded': { $ne: true },
          }
        },
        {
          $group: {
            _id: "$operator",
            total_debt: {
              $sum: { $subtract: ["$price", "$service_fee"] }
            }
          }
        },
        {
          $lookup: {
            from: 'operators',
            localField: '_id',
            foreignField: '_id',
            as: 'operator_info'
          }
        },
        {
          $unwind: "$operator_info"
        },
        {
          $project: {
            operator: "$operator_info.company_metadata.name",
            debt: "$total_debt"
          }
        }
      ];

      const debts = await Booking.aggregate(pipeline);

      ok(res, "Debts this month", debts)
    } catch (error) {
      server_error(res, error.message || "An error occurred");
    }
  },


  getDebtsForOperatorsByMonth: async (req, res) => {
    try {
      const { year, month } = req.query;
      if (!month) {
        return server_error(res, "Month is required");
      }

      const start_of_month = moment.utc().year(year).month(month).startOf('month').toDate();
      const end_of_month = moment.utc().year(year).month(month).endOf('month').toDate();

      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: start_of_month,
              $lte: end_of_month,
            },
            'metadata.refund_action.is_refunded': { $ne: true },
          }
        },
        {
          $group: {
            _id: "$operator",
            total_debt: {
              $sum: { $subtract: ["$price", "$service_fee"] }
            }
          }
        },
        {
          $lookup: {
            from: 'operators',
            localField: '_id',
            foreignField: '_id',
            as: 'operator_info'
          }
        },
        {
          $unwind: "$operator_info"
        },
        {
          $project: {
            operator: "$operator_info.company_metadata.name",
            debt: "$total_debt"
          }
        }
      ];

      const debts = await Booking.aggregate(pipeline);

      ok(res, `Debts for ${month}`, debts);
    } catch (error) {
      server_error(res, error.message || "An error occurred");
    }
  },

  getRevenueByMonth: async (req, res) => {
    try {
      const { year, month } = req.query;

      if (!month) {
        return server_error(res, "Month is required");
      }

      const startOfMonth = moment.utc().year(year).month(month).startOf('month').toDate();
      const endOfMonth = moment.utc().year(year).month(month).endOf('month').toDate();

      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: startOfMonth,
              $lte: endOfMonth,
            },
            'metadata.refund_action.is_refunded': { $ne: true },
          }
        },
        {
          $group: {
            _id: null,
            total_revenue: {
              $sum: "$service_fee"
            }
          }
        },
        {
          $project: {
            revenue: { $abs: "$total_revenue" }
          }
        }
      ];

      const [revenueData] = await Booking.aggregate(pipeline);
      const revenue = revenueData ? { amount: revenueData.revenue, label: `Revenue for month ${month} of ${year}` } : { amount: 0, label: `No revenue calculated for month ${month} of ${year}` };

      ok(res, `Revenue for month ${month} of ${year}`, revenue);
    } catch (error) {
      server_error(res, error.message || "An error occurred");
    }
  },


  getRevenueAnalytics: async (req, res) => {
    try {
      const start_of_month = moment.utc().startOf('month').toDate();
      const end_of_month = moment.utc().endOf('month').toDate();

      const start_of_last_month = moment.utc().subtract(1, 'month').startOf('month').toDate();
      const end_of_last_month = moment.utc().subtract(1, 'month').endOf('month').toDate();

      // Pipeline for monthly revenue (existing, only extended)
      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: start_of_month,
              $lte: end_of_month,
            },
            "metadata.refund_action.is_refunded": { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            total_revenue: { $sum: "$service_fee" },
            total_sales: { $sum: "$price" },
            net_revenue: { $sum: "$service_fee" },
          },
        },
      ];

      const this_month_data = await Booking.aggregate(pipeline);

      // Change match for last month
      pipeline[0].$match = {
        createdAt: {
          $gte: start_of_last_month,
          $lte: end_of_last_month,
        },
        "metadata.refund_action.is_refunded": { $ne: true },
      };

      const last_month_data = await Booking.aggregate(pipeline);

      // --- LIFETIME REVENUE PIPELINE (NEW) ---
      const lifetime_pipeline = [
        {
          $match: {
            "metadata.refund_action.is_refunded": { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            lifetime_total_sales: { $sum: "$price" },
            lifetime_net_revenue: { $sum: "$service_fee" }
          }
        }
      ];

      const lifetime_data = await Booking.aggregate(lifetime_pipeline);

      // Extract values
      const this_month_revenue = this_month_data[0]?.total_revenue || 0;
      const last_month_revenue = last_month_data[0]?.total_revenue || 0;

      const this_month_sales = this_month_data[0]?.total_sales || 0;
      const last_month_sales = last_month_data[0]?.total_sales || 0;

      const this_month_net = this_month_data[0]?.net_revenue || 0;
      const last_month_net = last_month_data[0]?.net_revenue || 0;

      const lifetime_total_sales = lifetime_data[0]?.lifetime_total_sales || 0;
      const lifetime_net_revenue = lifetime_data[0]?.lifetime_net_revenue || 0;

      const total_users = await User.countDocuments();

      const data = {
        this_month: {
          revenue_in_eur: Math.abs(this_month_revenue),
          total_sales: Math.abs(this_month_sales),
          net_revenue: Math.abs(this_month_net),
          label: "This month revenue data",
        },
        last_month: {
          revenue_in_eur: Math.abs(last_month_revenue),
          total_sales: Math.abs(last_month_sales),
          net_revenue: Math.abs(last_month_net),
          label: "Last month revenue data",
        },
        lifetime: {
          total_sales: Math.abs(lifetime_total_sales),
          net_revenue: Math.abs(lifetime_net_revenue),
          label: "Lifetime revenue and sales",
        },
        total_customers: total_users
      };

      ok(res, "Billbord Revenue analytics", data);
    } catch (error) {
      server_error(res, error.message || "An error occurred");
    }
  }




};