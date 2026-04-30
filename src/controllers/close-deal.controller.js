const closeDealService = require('../services/close-deal.service');

// GET /api/close-deals
const getCloseDeals = async (req, res) => {
  try {
    const { customerId, propertyId, status } = req.query;
    const data = await closeDealService.getCloseDeals({ customerId, propertyId, status });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/close-deals/:id
const getCloseDealById = async (req, res) => {
  try {
    const data = await closeDealService.getCloseDealById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Close deal not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/close-deals
const createCloseDeal = async (req, res) => {
  try {
    const data = await closeDealService.createCloseDeal(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/close-deals/:id/delivery
const updateDeliveryStatus = async (req, res) => {
  try {
    const { statusDelivery } = req.body;
    if (!statusDelivery)
      return res.status(400).json({ success: false, message: 'statusDelivery is required' });
    const data = await closeDealService.updateDeliveryStatus(req.params.id, statusDelivery);
    if (!data) return res.status(404).json({ success: false, message: 'Close deal not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/close-deals/:id/close  ← manual close
const closeDeal = async (req, res) => {
  try {
    const data = await closeDealService.closeDeal(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    // ถ้า error จากเงื่อนไขไม่ครบ ส่ง 400
    const status = err.message.includes('Cannot close') ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

module.exports = {
  getCloseDeals,
  getCloseDealById,
  createCloseDeal,
  updateDeliveryStatus,
  closeDeal,
};
