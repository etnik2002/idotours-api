const { server_error, created, error_404, ok } = require("../functions/responses");
const Driver = require("../models/Driver");

module.exports = {
    create: async (req, res) => {
        try {
            const { name, email, password, assigned_routes } = req.body;
            const operator_id = req.params.operator_id;
    
            const formattedRoutes = assigned_routes.map(route => ({
                route: route._id, 
                route_number: route.route_number 
            }));
    
            const driver = new Driver({
                name,
                email,
                password,
                assigned_routes: formattedRoutes,
                operator: operator_id,
            });
    
            await driver.save();
    
            created(res, "Driver created", []);
        } catch (error) {
            server_error(res, "", null);
        }
    },
    
    login: async (req, res) => {
        try {
    
          const driver = await Driver.findOne({ email: req.body.email });
          if (!driver) {
            return res.status(401).json({ message: "Invalid Email" });
          }
    
          const validPassword = await bcrypt.compare(
            req.body.password,
            driver.password
          );
    
          if (!validPassword) {
            return res.status(401).json({ data: null, message: "Invalid  Password" });
          }
    
          const token = driver.generateAuthToken(driver);

          return res.status(200).json({ data: token, message: "logged in successfully" });
        } catch (error) {
            server_error(res, error || error.response.message, null);
        }
    },

    getById: async (req,res) => {
        try {
            const driver = await Driver.findById(req.params.driver_id);
            if(!driver) {
                return error_404(res, "Driver not found", null); 
            }

            ok(res, "Driver data", driver);
        } catch (error) {
            server_error(res, "", null);
        }
    },

    getByOperator: async (req,res) => {
        try {
            const { operator_id } = req.params;
            let { select, page = 1, limit = 10 } = req.query;
          
            page = parseInt(page);
            limit = parseInt(limit);

            const skip = (page - 1) * limit;
        
            const drivers = await Driver.find({ operator: operator_id })
                                         .select(select)
                                         .skip(skip).limit(limit);
            
            if (!drivers || drivers.length === 0) {
              error_404(res, "No drivers found", null);
            }
        
            ok(res, "Drivers data", drivers);
        } catch (error) {
            server_error(res, "", null);
        }
    },



}
