require("dotenv").config();
const { server_error } = require("../functions/responses");
const jwt = require("jsonwebtoken")

module.exports = {
  verifySuperAdmin: async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || req.headers["Authorization"];
      if (!authHeader) {
        return res.status(401).json({ message: "No auth token provided", data: null });
      }

      const token = authHeader.split(' ')[1];

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user_id = req.body.user_id || req.query.user_id;
      if (decoded.user.$id !== user_id) {
        return res.status(401).json({ message: "Invalid or expired token", data: null })
      }

      req.user = decoded.user;

      next();

    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  }
}