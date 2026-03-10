const fs = require('fs').promises;

const allowed_features = [
  "wifi",
  "ac/heating",
  "usb charging ports",
  "reclining seats",
  "onboard entertainment",
  "complimentary water",
  "snacks and beverages",
  "restroom facilities",
  "reading lights",
  "gps tracking",
  "luggage storage",
  "wheelchair accessibility",
  "safety belts",
  "cctv security",
  "air purifiers",
  "comfort kits",
  "smart ticketing",
  "live travel information",
  "noise-cancelling headphones",
  "pet-friendly sections"
];

async function fetchLeads() {
  const files = [
    "operators_info/al.json",
    "operators_info/al.json",
    "operators_info/bg.json",
    "operators_info/ks.json",
    "operators_info/montenegro.json",
    "operators_info/nmk.json"
  ];

  try {
    const fileContents = await Promise.all(
      files.map(async (file) => {
        try {
          const data = await fs.readFile(file, 'utf8');
          return JSON.parse(data);
        } catch (err) {
          return null; 
        }
      })
    );

    const data = fileContents.filter(content => content !== null).flat();
    return data;

  } catch (error) {
    return [];
  }
}

module.exports = { allowed_features, fetchLeads };
