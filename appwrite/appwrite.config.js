require("dotenv").config();
const sdk = require("node-appwrite");

const {
    appwrite_project_id, appwrite_api_key
} = process.env;


const client = new sdk.Client()

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(appwrite_project_id)
    .setKey(appwrite_api_key)


// const databases = new sdk.Databases(client)
const messaging = new sdk.Messaging(client);
const users = new sdk.Users(client);
const storage = new sdk.Storage(client);

module.exports = {
    messaging,
    users,
    storage,
    appwrite_project_id,
    appwrite_api_key
}