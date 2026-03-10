const jwt = require("jsonwebtoken");
const { unauthorized, server_error } = require("../functions/responses");

module.exports = {

    verifyActiveAgent: async (req,res,next) => {
        try {
            const authHeader = req.headers.authorization || req.headers['Authorization']; 
            if (!authHeader) {
                unauthorized(res, "No auth header provided", null);
            }

            const token = authHeader.split(' ')[1];
            if (!token) {
                unauthorized(res, "No token provided", null);
            }

            const agent = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            if(!agent.data.is_active) {
                unauthorized(res, "Your account is deactivated. Please contact your operator.", null);
            }

            next();
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

}