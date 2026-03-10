require("dotenv").config();
const { server_error, unauthorized } = require("../functions/responses");
const jwt = require("jsonwebtoken");
const Operator = require("../models/Operator");

const generateTokens = (user) => {
  const accessToken = jwt.sign({ data: user }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ data: user }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

module.exports = {
    verifyOperator: async (req, res, next) => {
        try {
            const auth_header = req.headers.authorization || req.headers["Authorization"];
            if(!auth_header) {
                return unauthorized(res, "No auth header found", null);
            }     

            const token = auth_header.split(" ")[1];
            if(!token) {
                return unauthorized(res, "No token provided", null);
            }

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
                if (err) return unauthorized(res, "Invalid or expired token", null);
                
                if (user.data.role !== 'operator') {
                    return unauthorized(res, "Not authorized. User should be an operator in order to continue.", null);
                }
                req.operator = user.data;
                next();
            });
        } catch (error) {
            server_error(res, error.message || error.response?.message, null);
        }
    },

    verifyByID: async (req, res, next) => {
        try {
            const auth_header = req.headers.authorization || req.headers["Authorization"];
            if(!auth_header) {
                return unauthorized(res, "No auth header found", null);
            }     

            const token = auth_header.split(" ")[1];
            if(!token) {
                return unauthorized(res, "No token provided", null);
            }

            const { operator_id } = req.query;
            const operator = await Operator.findById(operator_id).select("_id");

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
                if (err) return unauthorized(res, "Invalid or expired token", null);
                
                if (user.data._id != operator._id) {
                    return unauthorized(res, "Not authorized. Operators ids should match.", null);
                }
                req.operator = operator;
                next();
            });
        } catch (error) {
            server_error(res, error.message || error.response?.message, null);
        }
    },

    refreshToken: async (req, res) => {
        const { refreshToken } = req.body;
        if (!refreshToken) return unauthorized(res, "Refresh Token is required", null);

        try {
            const user = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.data);

            res.json({ accessToken, refreshToken: newRefreshToken });
        } catch (error) {
            return unauthorized(res, "Invalid refresh token", null);
        }
    },

    validateOperatorForCreations: async (req,res,next) => {
        try {
            // this middleware will validate if there is a creator id and bearer token provided and validate if the operator is confirmed by us to operate into our system
            const auth_header = req.headers.authorization || req.headers["Authorization"];
            if(!auth_header) {
                return unauthorized(res, "No auth header found", null);
            }     

            const token = auth_header.split(" ")[1];
            if(!token) {
                return unauthorized(res, "No token provided", null);
            }
            
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
                if (err) return unauthorized(res, "Invalid or expired token", null);
                
                if (!user.data.confirmation.is_confirmed) {
                    return unauthorized(res, "Not authorized. Only confirmed operators by Me Bus can register agencies.", null);
                }
                next();
            });
        } catch (error) {
            server_error(res, error?.message)
        }
    }

};