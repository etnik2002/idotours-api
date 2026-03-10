const { ID } = require("node-appwrite");
const { messaging } = require("../appwrite/appwrite.config");
const { server_error, ok, error_404 } = require("../functions/responses");
const Notification = require("../models/Notification");


module.exports = {

    getByOperator: async (req,res) => {
        try {
            const { operator_id } = req.params;
            let { select, page = 1, limit = 10 } = req.query;
          
            page = parseInt(page);
            limit = parseInt(limit);

            const skip = (page - 1) * limit;

            const notifications = await Notification.find({ operator: operator_id }).select(select).skip(skip).limit(limit);

            if(!notifications) {
                error_404(res, "Not found", []);
            }

            ok(res, "notifications data", notifications);
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

    sendNotification: async (req,res) => {
        try {
                const { notification_title, notification_body } = req.query;

                const notification = await messaging.createPush(
                        ID.unique(), // messageId
                        notification_title,      // title
                        notification_body,       // body
                        [],             // topics (optional)
                        [],             // users (optional)
                        [],             // targets (optional)
                        {},             // data (optional)
                        '[ACTION]',     // action (optional)
                        '[ICON]',       // icon (optional)
                        '[SOUND]',      // sound (optional)
                        '[COLOR]',      // color (optional)
                        '[TAG]',        // tag (optional)
                        '[BADGE]',      // badge (optional)
                        false,          // draft (optional)
                        ''              // scheduledAt (optional)
                    );

                    if(!notification) {
                        return res.status(403).json({ message: "Could not send notification to the specific device", data: null });
                    }

                    return res.status(200).json({ message: "Notification sent successfully to the specific device", data: null });
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    }
    

}