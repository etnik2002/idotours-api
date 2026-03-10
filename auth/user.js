require("dotenv").config();
const { server_error } = require("../functions/responses");
const jwt = require("jsonwebtoken")

module.exports=  {
    createAuthToken: async (req,res) => {
        try {
            const token = jwt.sign({ user: req.body.user }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1d', 
            });

            return res.status(200).json({ message: "Auth token", data: token})
        } catch (error) {
           server_error(res, error.message, null); 
        }
    },
}