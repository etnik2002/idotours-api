const { stripe, receiveAllStripeEvents, wise } = require("../controllers/webhooks-controller");
const express = require('express');
const router = require("express").Router();

router.post('/', express.json({ type: 'application/json' }), stripe);

router.get('/receive/events', receiveAllStripeEvents)

router.post('/receive/events/wise', express.json({ type: 'application/json' }), wise)

module.exports = router;

// whsec_067b06d7cc3ac48539f0f05634cc45b1bd8f455c1142a749551cc075155e5177