const { ok } = require("../functions/responses");
const Applicant = require("../models/Applicants");

module.exports = {

    createApplicant: async (req,res) => {
        try {
            const { companyName, contactName, email, phone, website, fleetSize, routes, experience, additionalInfo, country, companyTaxNumber, registrationNumber } = req.body;
        
            if (!companyName || !contactName || !email || !phone || !country || !companyTaxNumber || !registrationNumber) {
              return res.status(400).json({ message: 'All required fields must be provided' });
            }
        
            const newApplicant = new Applicant({
              company_name: companyName,
              contact_name: contactName,
              email: email,
              phone: phone,
              website: website,
              fleet_size: fleetSize,
              routes: routes,
              experience: experience,
              additional_info: additionalInfo,
              country: country,
              tax_number: companyTaxNumber,
              registration_number: registrationNumber
            });
        
            const savedApplicant = await newApplicant.save();
        
            return res.status(201).json({
              message: `Your application has been received and is now being reviewed. Well update you as soon as the process is complete. Thank you for applying!`,
              data: savedApplicant
            });
          } catch (error) {
            return res.status(500).json({ message: 'Server error. Please try again later.' });
          }
    },

    getAll: async (req,res) => {
      try {
        let { select, populate, page = 1, limit = 10 } = req.query;
      
        page = parseInt(page);
        limit = parseInt(limit);

        const skip = (page - 1) * limit;
    
        const applicants = await Applicant.find({})
                          .populate(populate)
                            .sort({ createdAt: 'desc' })
                                .select(select)
                                    .skip(skip)
                                      .limit(limit);
        
        if (!applicants || applicants.length === 0) {
          return res.status(404).json("No applicants found")
        }
    
        ok(res, "Applicants data", applicants);
      } catch (error) {
        return res.status(500).json({ message: 'Server error. Please try again later.' });
      }
    }

}