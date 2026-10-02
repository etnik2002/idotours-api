const { ok, server_error, created, unauthorized, error_404 } = require("../functions/responses");
const { removePassword } = require("../functions/security");
const Operator = require("../models/Operator");
const bcrypt = require("bcryptjs");
const { users } = require("../appwrite/appwrite.config");
const Message = require("../models/Message");
const { sendRegisteredOperatorEmail } = require("../helpers/email");
const { validateIBAN } = require("../functions/banking.config");
const DashboardUser = require("../models/DashboardUser");
const jwt = require("jsonwebtoken");

const DASHBOARD_MODULES = [
  "dashboard", "capacity", "agencies", "sales_reports", "create_booking",
  "bookings", "tickets", "routes", "stations", "documents", "settings",
];

const bootstrapSuperAdmin = async (email, password) => {
  const bootstrapEmail = (process.env.DASHBOARD_SUPER_ADMIN_EMAIL || "driton@idotours.com.mk").toLowerCase();
  const bootstrapPassword = process.env.DASHBOARD_SUPER_ADMIN_PASSWORD || "Driton007.";
  if (email.toLowerCase() !== bootstrapEmail || password !== bootstrapPassword) return null;

  const operatorId = process.env.DASHBOARD_OPERATOR_ID || process.env.HARDCODED_OPERATOR_ID;
  const operator = operatorId ? await Operator.findById(operatorId) : await Operator.findOne({ role: "operator" }).sort({ createdAt: 1 });
  if (!operator) throw new Error("No operator found for the dashboard super admin");
  if (await DashboardUser.exists({ operator: operator._id, role: "super_admin" })) return null;

  const hashedPassword = await bcrypt.hash(bootstrapPassword, 10);
  return DashboardUser.findOneAndUpdate(
    { email: bootstrapEmail },
    {
      $setOnInsert: {
        name: "Driton",
        email: bootstrapEmail,
        password: hashedPassword,
        operator: operator._id,
        role: "super_admin",
        permissions: DASHBOARD_MODULES,
        isActive: true,
      },
    },
    { new: true, upsert: true, runValidators: true },
  );
};

module.exports = {
  createOperator: async (req, res) => {
    try {
      const { name, email, password, company_metadata, max_child_age } = req.body;
      let bank_response;

      process.env.ENV_TYPE == "DEV" ? { iban_data: { data: { bank_name: "TEST_BANK" } } } : bank_response = await validateIBAN(company_metadata?.bank_details?.iban);
      const iban_data = bank_response?.data;
      console.log({ iban_data });

      const new_metadata = {
        ...company_metadata,
        bank_details: {
          ...company_metadata?.bank_details,
          bank_name: iban_data?.data?.bank?.bank_name || ""
        }
      };

      const salt = bcrypt.genSaltSync(10);

      const hashed_password = bcrypt.hashSync(password, salt);

      const new_operator = new Operator({
        name,
        email,
        password: hashed_password,
        max_child_age,
        company_metadata: new_metadata,
      });

      if (!new_operator) {
        return res.status(403).json({ message: "Error creating operator." });
      }

      const appwrite_operator = await users.createBcryptUser(
        new_operator._id,
        email,
        hashed_password,
        name,
      );

      if (!appwrite_operator) {
        bad_request(res, "Error creating appwrite operator.", null);
      }

      users.updateLabels(
        appwrite_operator.$id,
        ['operator']
      );

      await new_operator.save();

      let language = "english";
      if (company_metadata.country == "macedonia") {
        language = "macedonian";
      } else if (company_metadata.country == "albania") {
        language = "albanian";
      } else if (company_metadata.country == "kosovo") {
        language = "albanian";
      } else {
        language = "english";
      }

      // await sendRegisteredOperatorEmail(email, password, language)

      created(res, "Operator created successfully", new_operator);
    } catch (error) {
      console.log({ error: error.response.data });

      server_error(res, error.message || error.response.message, null);
    }
  },


  login: async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      let dashboardUser = await DashboardUser.findOne({ email });
      if (!dashboardUser) dashboardUser = await bootstrapSuperAdmin(email, req.body.password || "");

      if (dashboardUser) {
        if (!dashboardUser.isActive) return unauthorized(res, "Account is disabled", null);
        const valid = await bcrypt.compare(req.body.password || "", dashboardUser.password);
        if (!valid) return unauthorized(res, "Invalid Password", null);

        const operator = await Operator.findById(dashboardUser.operator).select("_id company_metadata");
        if (!operator) return unauthorized(res, "Operator account not found", null);

        dashboardUser.lastLoginAt = new Date();
        await dashboardUser.save();
        const data = {
          _id: operator._id,
          operatorId: operator._id,
          accountId: dashboardUser._id,
          name: dashboardUser.name,
          email: dashboardUser.email,
          role: "operator",
          dashboardRole: dashboardUser.role,
          permissions: dashboardUser.role === "super_admin" ? DASHBOARD_MODULES : dashboardUser.permissions,
          isSuperAdmin: dashboardUser.role === "super_admin",
          company_metadata: operator.company_metadata,
        };
        const token = jwt.sign({ data }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "7d" });
        return ok(res, "Logged in successfully", token);
      }

      const operator = await Operator.findOne({ email });
      if (!operator) {
        return unauthorized(res, "Invalid Email", null);
      }

      const validPassword = await bcrypt.compare(
        req.body.password,
        operator.password
      );

      if (!validPassword) {
        return unauthorized(res, "Invalid Password", null);
      }

      const token = operator.generateAuthToken(operator);

      ok(res, "Logged in successfully", token);
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  getById: async (req, res) => {
    try {
      let { select } = req.query;
      const operator = await Operator.findById(req.params.id).select(select);
      if (operator.password) {
        removePassword(operator);
      }

      ok(res, "Operator data", operator);
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  getAll: async (req, res) => {
    try {
      let { select, page = 1, limit = 10 } = req.query;

      page = parseInt(page);
      const skip = (page - 1) * limit;

      const operators = await Operator.find({ role: "operator" })
        .select(select)
        .sort({ createdAt: 'desc' })
        .skip(skip)
      // .limit(limit)

      if (!operators || operators.length === 0) {
        return ok(res, "No operators found", []);
      }

      operators.forEach(operator => {
        if (operator.password) {
          removePassword(operator);
        }
      });

      return ok(res, "Operators data", operators);
    } catch (error) {
      return server_error(res, error || error.response.message, null);
    }
  },

  getOperatorLivechatMessages: async (req, res) => {
    try {
      const messages = await Message.find({
        $or: [
          {
            sender: req.params.operator_id,
            receiver: req.query.sender,
          },
          {
            receiver: req.params.operator_id,
            sender: req.query.sender,
          },
        ]
      })
      // .sort({timestamp: 'desc'});
      ok(res, "message data", messages)
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  edit: async (req, res) => {
    try {
      const operator = await Operator.findById(req.params.id);
      if (!operator) {
        return res.status(404).json({ message: "Operator not found", data: null });
      }

      const { name, email, max_child_age, allow_portal_notifications, company_name, company_email, company_phone, company_tax_number, company_registration_number, country, chf_to_mkd_rate } = req.body;
      const update = {};

      if (name !== undefined) update.name = name;
      if (email !== undefined) update.email = email;
      if (max_child_age !== undefined) update.max_child_age = max_child_age;
      if (allow_portal_notifications !== undefined) {
        update["notification_permissions.allow_portal_notifications"] = allow_portal_notifications;
      }
      if (company_name !== undefined) update["company_metadata.name"] = company_name;
      if (company_email !== undefined) update["company_metadata.email"] = company_email;
      if (company_phone !== undefined) update["company_metadata.phone"] = company_phone;
      if (company_tax_number !== undefined) update["company_metadata.tax_number"] = company_tax_number;
      if (company_registration_number !== undefined) {
        update["company_metadata.registration_number"] = company_registration_number;
      }
      if (country !== undefined) update["company_metadata.country"] = country;

      if (chf_to_mkd_rate !== undefined) {
        const rate = Number(chf_to_mkd_rate);
        if (!Number.isFinite(rate) || rate <= 0) {
          return res.status(400).json({ message: "Please provide a valid CHF to MKD rate", data: null });
        }
        update["company_metadata.exchange_rates.chf_to_mkd"] = rate;
      }

      const updatedOperator = await Operator.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true }
      ).select("-password");

      return res.status(201).json({ message: "Updated", data: updatedOperator })
    } catch (error) {
      server_error(res, error || error.response.message, null);
    }
  },

  getDashboardUsers: async (req, res) => {
    try {
      const users = await DashboardUser.find({ operator: req.dashboardUser.operator })
        .select("-password")
        .sort({ role: 1, name: 1 });
      return ok(res, "Dashboard users", users);
    } catch (error) {
      return server_error(res, error.message, null);
    }
  },

  getDashboardSession: async (req, res) => {
    try {
      const account = req.dashboardUser;
      const operator = await Operator.findById(account.operator).select("_id company_metadata");
      if (!operator) return unauthorized(res, "Operator account not found", null);
      return ok(res, "Dashboard session", {
        _id: operator._id,
        operatorId: operator._id,
        accountId: account._id,
        name: account.name,
        email: account.email,
        role: "operator",
        dashboardRole: account.role,
        permissions: account.role === "super_admin" ? DASHBOARD_MODULES : account.permissions,
        isSuperAdmin: account.role === "super_admin",
        company_metadata: operator.company_metadata,
      });
    } catch (error) {
      return server_error(res, error.message, null);
    }
  },

  createDashboardUser: async (req, res) => {
    try {
      const { name, email, password, permissions = [], isActive = true } = req.body;
      if (!name || !email || !password || password.length < 8) {
        return res.status(400).json({ message: "Name, email and a password of at least 8 characters are required", data: null });
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (await DashboardUser.exists({ email: normalizedEmail })) {
        return res.status(409).json({ message: "A user with this email already exists", data: null });
      }
      const user = await DashboardUser.create({
        name: name.trim(),
        email: normalizedEmail,
        password: await bcrypt.hash(password, 10),
        operator: req.dashboardUser.operator,
        role: "user",
        permissions: [...new Set(permissions)].filter((item) => DASHBOARD_MODULES.includes(item)),
        isActive: Boolean(isActive),
      });
      const result = user.toObject();
      delete result.password;
      return created(res, "Dashboard user created", result);
    } catch (error) {
      return server_error(res, error.message, null);
    }
  },

  updateDashboardUser: async (req, res) => {
    try {
      const user = await DashboardUser.findOne({ _id: req.params.userId, operator: req.dashboardUser.operator });
      if (!user) return error_404(res, "Dashboard user not found", null);
      if (user.role === "super_admin" && String(user._id) !== String(req.dashboardUser._id)) {
        return res.status(403).json({ message: "The super admin account cannot be changed", data: null });
      }
      const { name, email, password, permissions, isActive } = req.body;
      if (name !== undefined) user.name = String(name).trim();
      if (email !== undefined) user.email = String(email).trim().toLowerCase();
      if (password) {
        if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters", data: null });
        user.password = await bcrypt.hash(password, 10);
      }
      if (permissions !== undefined && user.role !== "super_admin") {
        user.permissions = [...new Set(permissions)].filter((item) => DASHBOARD_MODULES.includes(item));
      }
      if (isActive !== undefined && user.role !== "super_admin") user.isActive = Boolean(isActive);
      await user.save();
      const result = user.toObject();
      delete result.password;
      return ok(res, "Dashboard user updated", result);
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ message: "A user with this email already exists", data: null });
      return server_error(res, error.message, null);
    }
  },

  deleteDashboardUser: async (req, res) => {
    try {
      const user = await DashboardUser.findOne({ _id: req.params.userId, operator: req.dashboardUser.operator });
      if (!user) return error_404(res, "Dashboard user not found", null);
      if (user.role === "super_admin") return res.status(403).json({ message: "The super admin account cannot be deleted", data: null });
      await user.deleteOne();
      return ok(res, "Dashboard user deleted", null);
    } catch (error) {
      return server_error(res, error.message, null);
    }
  },


  changeAutomaticPayoutSchedule: async (req, res) => {
    try {
      const { operatorId } = req.params;
      const { automatic_scheduled_payouts } = req.body;

      if (typeof automatic_scheduled_payouts !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'automatic_scheduled_payouts must be a boolean value'
        });
      }

      const operator = await Operator.findByIdAndUpdate(
        operatorId,
        {
          $set: {
            'company_metadata.payouts.automatic_scheduled_payouts': automatic_scheduled_payouts
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!operator) {
        return res.status(404).json({
          success: false,
          message: 'Operator not found'
        });
      }

      console.log(`Operator ${operatorId} ${automatic_scheduled_payouts ? 'enabled' : 'disabled'} automatic payouts`);

      res.status(200).json({
        success: true,
        data: operator,
        message: automatic_scheduled_payouts
          ? 'Automatic payouts enabled successfully. Payouts will be processed on the 5th of each month.'
          : 'Automatic payouts disabled successfully. You can now request manual payouts.'
      });

    } catch (error) {
      console.error('Error toggling automatic payouts:', error);

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid operator ID format'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error occurred while updating payout settings',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

};
