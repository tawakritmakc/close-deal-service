require('dotenv').config();
const express = require('express');
const { initDB } = require('./db');
const { connectKafka, subscribeToTopics } = require('./kafka');
const {
  handleBookingCompleted,
  handleSurveyCompleted,
  handleSecondPaymentCompleted,
  handleHandoverCompleted,
  handleSettlementCompleted,
} = require('./services/close-deal.service');
const closeDealRoutes = require('./routes/close-deal.routes');

const app = express();
app.use(express.json());

// Routes
app.use('/api/close-deals', closeDealRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'close-deal-service' }));

// Kafka event handler
const kafkaHandler = async (topic, payload) => {
  switch (topic) {
    case 'sale.booked.complete':
      await handleBookingCompleted(payload);
      break;
    case 'sale.statussurvey.complete':
      await handleSurveyCompleted(payload);
      break;
    case 'payment.secondpayment.completed':
      await handleSecondPaymentCompleted(payload);
      break;
    case 'postsales.handover.completed':
      await handleHandoverCompleted(payload);
      break;
    case 'payment.settlement.completed':
      await handleSettlementCompleted(payload);
      break;
    default:
      console.warn(`⚠️ Unhandled topic: ${topic}`);
  }
};

const start = async () => {
  try {
    await initDB();

    await connectKafka();
    await subscribeToTopics(
      [
        'sale.booked.complete',
        'sale.statussurvey.complete',
        'payment.secondpayment.completed',
        'postsales.handover.completed',
        'payment.settlement.completed',
      ],
      kafkaHandler
    );

    const PORT = process.env.PORT || 3005;
    app.listen(PORT, () => {
      console.log(`🚀 Close Deal Service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start service:', err);
    process.exit(1);
  }
};

start();
