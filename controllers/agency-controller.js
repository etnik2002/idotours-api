const { ok, server_error, created, error_404 } = require("../functions/responses");
const { removePassword } = require("../functions/security");
const Agency = require("../models/Agency");
const bcrypt = require("bcryptjs");
const { users } = require("../appwrite/appwrite.config")

module.exports = {
    createAgency: async(req,res) => {
        try {
            const { name, email, password, company_metadata, contact, address, financial_data } = req.body.agency;
            if (!password || typeof password !== 'string') {
              return res.status(400).json({ message: "Password is required and must be a string." });
          }
            const { operator_id } = req.params;

            const salt = bcrypt.genSaltSync(10);
            
            const hashed_password = bcrypt.hashSync(password, salt);  

            const new_agency = new Agency({
                name,
                email,
                password: hashed_password,
                company_metadata,
                operator: operator_id,
                contact,
                financial_data,
                address,
            });          

            if(!new_agency){
                return res.status(403).json({message: "Error creating agency."});
            }

            
            const appwrite_agency = await users.createBcryptUser(
              new_agency._id, 
              email, 
              password,
              name,
            );
            
            if(!appwrite_agency){
              bad_request(res, "Error creating appwrite agency.", null);
            }
            
            await users.updateLabels(
              appwrite_agency.$id,
              [ 'agency' ]
            );
            
            await users.updatePrefs(
              appwrite_agency.$id,
              {operator: operator_id}
            );


            await new_agency.save();
            created(res, "Agency created", null);
        } catch (error) {
            server_error(res, error || error.response.message, null);
        }
    },

    
    login: async (req, res) => {
        try {
    
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
    
          const token = agency.generateAuthToken(agency);

          return res.status(200).json({ data: token, message: "logged in successfully" });
        } catch (error) {
            server_error(res, error || error.response.message, null);
        }
      },

      getById: async (req,res) => {
        try {
            let { select } = req.query;
            const agency = await Agency.findById(req.params.id).select(select);
            
            if(agency.password) {
              removePassword(agency);
            }

            ok(res, "", agency);
        } catch (error) {
            server_error(res, error || error.response.message, null);
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
      
      
      getByOperator: async (req,res) => {
        try {
          let { select, page = 1, limit = 10 } = req.query;
          const { operator_id } = req.params;
          
          page = parseInt(page);
          limit = parseInt(limit);
          
          const skip = (page - 1) * limit;
      
          const agencies = await Agency.find({ operator: operator_id })
                                       .select(select)
                                       .skip(skip)
                                       .limit(limit);
      
          if (!agencies || agencies.length === 0) {
            return error_404(res, "No agencies found", null);
          }
      
          agencies.forEach(agency => {
            if (agency.password) {
              removePassword(agency);
            }
          });
      
          ok(res, "Agencies data", agencies);
        } catch (error) {
          server_error(res, error || error.response.message, null);
        }
      }


};