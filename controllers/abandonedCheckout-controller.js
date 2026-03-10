const AbandonedCheckout = require("../models/AbandonedCheckout");

const createAbandonedCheckout = async (req, res) => {
  try {
    const {
      checkoutId,
      selectedTicket,
      outboundTicket,
      returnTicket,
      passengers,
      selectedFlex,
      flexPrice,
      totalCost,
      userEmail,
      timestamp,
      sessionId
    } = req.body;

    if (!checkoutId || !userEmail || !passengers || passengers.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields: checkoutId, userEmail, or passengers' 
      });
    }

    const existingCheckout = await AbandonedCheckout.findOne({ checkoutId });
    
    if (existingCheckout) {
      existingCheckout.selectedTicket = selectedTicket;
      existingCheckout.outboundTicket = outboundTicket;
      existingCheckout.returnTicket = returnTicket;
      existingCheckout.passengers = passengers;
      existingCheckout.selectedFlex = selectedFlex;
      existingCheckout.flexPrice = flexPrice;
      existingCheckout.totalCost = totalCost;
      existingCheckout.userEmail = userEmail;
      existingCheckout.timestamp = timestamp;
      existingCheckout.sessionId = sessionId;
      
      await existingCheckout.save();
      
      return res.status(200).json({ 
        message: 'Abandoned checkout updated successfully',
        checkoutId: existingCheckout.checkoutId
      });
    }

    const abandonedCheckout = new AbandonedCheckout({
      checkoutId,
      selectedTicket,
      outboundTicket,
      returnTicket,
      passengers,
      selectedFlex,
      flexPrice,
      totalCost,
      userEmail,
      timestamp,
      sessionId
    });

    await abandonedCheckout.save();

    return res.status(201).json({ 
      checkoutId: abandonedCheckout.checkoutId
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getAbandonedCheckout = async (req, res) => {
  try {
    const { checkoutId } = req.params;

    const abandonedCheckout = await AbandonedCheckout.findOne({ 
      checkoutId,
    //   resumed: false 
    });

    if (!abandonedCheckout) {
      return res.status(404).json({ error: 'Abandoned checkout not found or already resumed' });
    }

    abandonedCheckout.resumed = true;
    abandonedCheckout.resumedAt = new Date();
    await abandonedCheckout.save();

    return res.status(200).json({
      checkoutId: abandonedCheckout.checkoutId,
      selectedTicket: abandonedCheckout.selectedTicket,
      outboundTicket: abandonedCheckout.outboundTicket,
      returnTicket: abandonedCheckout.returnTicket,
      passengers: abandonedCheckout.passengers,
      selectedFlex: abandonedCheckout.selectedFlex,
      flexPrice: abandonedCheckout.flexPrice,
      totalCost: abandonedCheckout.totalCost,
      timestamp: abandonedCheckout.timestamp
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteAbandonedCheckout = async (req, res) => {
  try {
    // const { checkoutId } = req.params;

    // const result = await AbandonedCheckout.deleteOne({ checkoutId });

    // if (result.deletedCount === 0) {
    //   return res.status(404).json({ error: 'Abandoned checkout not found' });
    // }

    return res.status(200).json({ message: 'Abandoned checkout deleted successfully' });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllAbandonedCheckouts = async (req, res) => {
  try {
    const { page = 1, limit = 50, emailSent = false } = req.query;
    
    const query = {
      resumed: false,
      emailSent: emailSent === 'true'
    };

    if (emailSent === 'false') {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      query.timestamp = {
        $gte: oneDayAgo,
        $lte: oneHourAgo
      };
    }

    const abandonedCheckouts = await AbandonedCheckout.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AbandonedCheckout.countDocuments(query);

    return res.status(200).json({
      abandonedCheckouts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateEmailSentStatus = async (req, res) => {
  try {
    const { checkoutId } = req.params;

    const abandonedCheckout = await AbandonedCheckout.findOne({ checkoutId });

    if (!abandonedCheckout) {
      return res.status(404).json({ error: 'Abandoned checkout not found' });
    }

    abandonedCheckout.emailSent = true;
    abandonedCheckout.emailSentAt = new Date();
    await abandonedCheckout.save();

    return res.status(200).json({ message: 'Email sent status updated successfully' });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createAbandonedCheckout,
  getAbandonedCheckout,
  deleteAbandonedCheckout,
  getAllAbandonedCheckouts,
  updateEmailSentStatus
};