const { server_error } = require("../functions/responses");
const {storage} = require("../appwrite/appwrite.config")


module.exports = {

    createFile: async (req,res) => {
        try {
           
        } catch (error) {
            return server_error(res, error.message || error.response?.message || "Internal Server Error", null);
        }
    }

}