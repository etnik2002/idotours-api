const { storage } = require("./appwrite/appwrite.config");

async function createBucket() {
  const result = await storage.createBucket(
    'eTicketStorage', // bucketId
    'eTicketStorage', // name
    [`read("any")`], // permissions (optional)
  );
}

createBucket()