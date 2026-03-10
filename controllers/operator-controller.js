const { ok, server_error, created, unauthorized, error_404 } = require("../functions/responses");
const { removePassword } = require("../functions/security");
const Operator = require("../models/Operator");
const bcrypt = require("bcryptjs");
const { users } = require("../appwrite/appwrite.config");
const Message = require("../models/Message");
const { sendRegisteredOperatorEmail } = require("../helpers/email");
const { validateIBAN } = require("../functions/banking.config");

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

      const operator = await Operator.findOne({ email: req.body.email });
      if (!operator) {
        unauthorized(res, "Invalid Email", null);
      }

      const validPassword = await bcrypt.compare(
        req.body.password,
        operator.password
      );

      if (!validPassword) {
        unauthorized(res, "Invalid  Password", null);
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

      const { name, email, max_child_age, allow_portal_notifications, company_name, company_email, company_phone, company_tax_number, company_registration_number, country } = req.body;

      const payload = {
        ...operator,
        name: name || operator.name,
        email: email || operator.email,
        max_child_age: max_child_age || operator.max_child_age,
        "notification_permissions.allow_portal_notifications": allow_portal_notifications || operator.notification_permissions.allow_portal_notifications,
        "company_metadata.name": company_name || operator.company_metadata.name,
        "company_metadata.email": email || operator.company_metadata.email,
        "company_metadata.phone": company_phone || operator.company_metadata.phone,
        "company_metadata.tax_number": company_tax_number || operator.company_metadata.tax_number,
        "company_metadata.registration_number": company_registration_number || operator.company_metadata.registration_number,
        "company_metadata.country": country || operator.company_metadata.country,
      }

      await Operator.findByIdAndUpdate(req.params.id, payload._doc);
      return res.status(201).json({ message: "Updated", data: null })
    } catch (error) {
      server_error(res, error || error.response.message, null);
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