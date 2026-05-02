const dayjs = require('dayjs');
const { pool } = require('../db');
const { publishEvent } = require('../kafka');
const axios = require('axios');

// สร้าง close deal record
const createCloseDeal = async (data) => {
  const {
    bookingId, projectName, customerId, contractId,
    propertyId, area, location,
    statusSurvey, paymentFirstStatus, paymentSecondStatus,
  } = data;

  const result = await pool.query(
    `INSERT INTO close_deals
      (booking_id, project_name, customer_id, contract_id, property_id, area, location,
       status_survey, payment_first_status, payment_second_status, status_delivery, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING','IN_PROGRESS')
     ON CONFLICT (booking_id) DO UPDATE SET
       project_name = EXCLUDED.project_name,
       contract_id = EXCLUDED.contract_id,
       status_survey = EXCLUDED.status_survey,
       payment_first_status = EXCLUDED.payment_first_status,
       payment_second_status = EXCLUDED.payment_second_status,
       updated_at = NOW()
     RETURNING *`,
    [
      bookingId, projectName, customerId, contractId,
      propertyId, area, location,
      statusSurvey, paymentFirstStatus, paymentSecondStatus,
    ]
  );
  return result.rows[0];
};

// ดึง close deal ทั้งหมด
const getCloseDeals = async ({ customerId, propertyId, status } = {}) => {
  let query = 'SELECT * FROM close_deals WHERE 1=1';
  const params = [];

  if (customerId) { params.push(customerId); query += ` AND customer_id = $${params.length}`; }
  if (propertyId) { params.push(propertyId); query += ` AND property_id = $${params.length}`; }
  if (status)     { params.push(status);     query += ` AND status = $${params.length}`; }

  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
};

// ดึง close deal by ID หรือ bookingId
const getCloseDealById = async (id) => {
  const result = await pool.query(
    'SELECT * FROM close_deals WHERE id = $1 OR booking_id = $1',
    [id]
  );
  return result.rows[0] || null;
};

// อัปเดต delivery status
const updateDeliveryStatus = async (id, statusDelivery) => {
  const result = await pool.query(
    `UPDATE close_deals SET status_delivery = $1, updated_at = NOW()
     WHERE id = $2 OR booking_id = $2 RETURNING *`,
    [statusDelivery, id]
  );
  return result.rows[0] || null;
};

// ปิด deal — ตรวจสอบเงื่อนไขครบแล้ว close
const closeDeal = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT * FROM close_deals WHERE id = $1 OR booking_id = $1 FOR UPDATE',
      [id]
    );
    const deal = rows[0];
    if (!deal) throw new Error('Close deal record not found');

    // ตรวจสอบเงื่อนไขก่อน close
    const checks = {
      payment_first: deal.payment_first_status === 'CONFIRMED',
      payment_second: deal.payment_second_status === 'CONFIRMED',
      survey: deal.status_survey === 'COMPLETED',
      delivery: deal.status_delivery === 'COMPLETED',
    };

    const allPassed = Object.values(checks).every(Boolean);
    if (!allPassed) {
      const failed = Object.entries(checks)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      throw new Error(`Cannot close deal. Incomplete: ${failed.join(', ')}`);
    }

    const result = await client.query(
      `UPDATE close_deals
       SET status = 'CLOSED', closed_at = NOW(), updated_at = NOW()
       WHERE id = $1 OR booking_id = $1 RETURNING *`,
      [id]
    );
    const closed = result.rows[0];
    await client.query('COMMIT');

    // Publish events
    await publishEvent('sale.closedeal.complete', {
      bookingId: closed.booking_id,
      customerId: closed.customer_id,
      propertyId: closed.property_id,
      contractId: closed.contract_id,
      status: 'CLOSED',
      closedAt: closed.closed_at,
    });

    // แจ้ง post-sales service
    await notifyPostSales(closed);

    // แจ้ง marketing + payment
    await notifyMarketing(closed);

    return closed;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// แจ้ง post-sales service ว่า deal ปิดแล้ว
const notifyPostSales = async (deal) => {
  try {
    await axios.post(`${process.env.POST_SALES_SERVICE_URL}/api/post-sales/handover`, {
      bookingId: deal.booking_id,
      customerId: deal.customer_id,
      propertyId: deal.property_id,
      contractId: deal.contract_id,
    });
    console.log(`🏠 Post-sales notified for booking: ${deal.booking_id}`);
  } catch (err) {
    console.error('❌ Failed to notify post-sales:', err.message);
  }
};

// แจ้ง marketing service
const notifyMarketing = async (deal) => {
  try {
    await axios.post(`${process.env.MARKETING_SERVICE_URL}/api/marketing/deal-closed`, {
      bookingId: deal.booking_id,
      customerId: deal.customer_id,
      propertyId: deal.property_id,
      closedAt: deal.closed_at,
    });
    console.log(`📊 Marketing notified for closed deal: ${deal.booking_id}`);
  } catch (err) {
    console.error('❌ Failed to notify marketing:', err.message);
  }
};

// ดึงข้อมูล payment จาก payment service
const getPaymentInfo = async (bookingId) => {
  try {
    const res = await axios.get(`${process.env.PAYMENT_SERVICE_URL}/api/payment`, {
      params: { bookingId },
    });
    return res.data?.data || null;
  } catch (err) {
    console.error('❌ Failed to get payment info:', err.message);
    return null;
  }
};

// Handle Kafka: sale.booked.complete → สร้าง close deal record
const handleBookingCompleted = async (payload) => {
  const { bookingId, customerId, propertyId } = payload;

  const deal = await createCloseDeal({
    bookingId,
    customerId,
    propertyId,
    projectName: payload.projectName,
    contractId: payload.contractId,
    area: payload.area,
    location: payload.location,
    statusSurvey: 'PENDING',
    paymentFirstStatus: 'PENDING',
    paymentSecondStatus: 'PENDING',
  });

  console.log(`📁 Close deal record created for booking: ${bookingId}`);
  return deal;
};

// Handle Kafka: sale.statussurvey.complete → อัปเดต survey status
const handleSurveyCompleted = async (payload) => {
  const { bookingId, statusSurvey } = payload;
  await pool.query(
    `UPDATE close_deals SET status_survey = $1, updated_at = NOW() WHERE booking_id = $2`,
    [statusSurvey, bookingId]
  );
  console.log(`📋 Survey status updated for booking: ${bookingId} → ${statusSurvey}`);
  await tryAutoClose(bookingId);
};

// Handle Kafka: payment.secondpayment.completed → อัปเดต payment status
const handleSecondPaymentCompleted = async (payload) => {
  const { bookingId, status } = payload;
  await pool.query(
    `UPDATE close_deals
     SET payment_second_status = $1, updated_at = NOW()
     WHERE booking_id = $2`,
    [status, bookingId]
  );
  console.log(`💳 Second payment updated for booking: ${bookingId} → ${status}`);
  await tryAutoClose(bookingId);
};

// Handle Kafka: postsales.handover.completed → อัปเดต delivery
const handleHandoverCompleted = async (payload) => {
  const { bookingId } = payload;
  await pool.query(
    `UPDATE close_deals SET status_delivery = 'COMPLETED', updated_at = NOW() WHERE booking_id = $1`,
    [bookingId]
  );
  console.log(`🚚 Delivery completed for booking: ${bookingId}`);
  await tryAutoClose(bookingId);
};

// ลอง auto-close ถ้าเงื่อนไขครบ
const tryAutoClose = async (bookingId) => {
  const { rows } = await pool.query(
    'SELECT * FROM close_deals WHERE booking_id = $1',
    [bookingId]
  );
  const deal = rows[0];
  if (!deal || deal.status === 'CLOSED') return;

  const ready =
    deal.payment_first_status === 'CONFIRMED' &&
    deal.payment_second_status === 'CONFIRMED' &&
    deal.status_survey === 'COMPLETED' &&
    deal.status_delivery === 'COMPLETED';

  if (ready) {
    console.log(`🎯 Auto-closing deal for booking: ${bookingId}`);
    await closeDeal(bookingId);
  }
};
const handleSettlementCompleted = async (payload) => {
  const {
    settlementId, saleId, propertyId, customerId, agentId,
    totalRevenue, commissionRate, commissionAmount, netRevenue, settledAt,
  } = payload;

  try {
    await pool.query(
      `INSERT INTO settlements
        (settlement_id, sale_id, property_id, customer_id, agent_id,
         total_revenue, commission_rate, commission_amount, net_revenue, settled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (settlement_id) DO UPDATE SET
         total_revenue     = EXCLUDED.total_revenue,
         commission_amount = EXCLUDED.commission_amount,
         net_revenue       = EXCLUDED.net_revenue,
         settled_at        = EXCLUDED.settled_at`,
      [settlementId, saleId, propertyId, customerId, agentId,
       totalRevenue, commissionRate, commissionAmount, netRevenue, settledAt]
    );
    console.log(`💰 Settlement recorded: ${settlementId}`);
  } catch (err) {
    console.error('❌ Failed to record settlement:', err.message);
  }
};
module.exports = {
  createCloseDeal,
  getCloseDeals,
  getCloseDealById,
  updateDeliveryStatus,
  closeDeal,
  handleBookingCompleted,
  handleSurveyCompleted,
  handleSecondPaymentCompleted,
  handleHandoverCompleted,
  handleSettlementCompleted,
};
