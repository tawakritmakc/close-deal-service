const express = require('express');
const router = express.Router();
const controller = require('../controllers/close-deal.controller');

// GET /api/close-deals
router.get('/', controller.getCloseDeals);

// GET /api/close-deals/:id
router.get('/:id', controller.getCloseDealById);

// POST /api/close-deals
router.post('/', controller.createCloseDeal);

// PATCH /api/close-deals/:id/delivery
router.patch('/:id/delivery', controller.updateDeliveryStatus);

// POST /api/close-deals/:id/close  ← manual trigger
router.post('/:id/close', controller.closeDeal);

module.exports = router;
