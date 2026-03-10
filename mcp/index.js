require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { initializeMCP } = require("./server");

const MONGODB_URI = process.env.PROD_DATABASE_URL;

async function main() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.error("Connected to MongoDB");

        await initializeMCP();
    } catch (error) {
        console.error("Failed to start MCP server:", error);
        process.exit(1);
    }
}

main();
