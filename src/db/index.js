const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS close_deals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id VARCHAR(50) NOT NULL UNIQUE,
        project_name VARCHAR(255),
        customer_id VARCHAR(100) NOT NULL,
        contract_id VARCHAR(100),
        property_id VARCHAR(100) NOT NULL,
        area VARCHAR(100),
        location VARCHAR(255),
        status_survey VARCHAR(50),
        payment_first_status VARCHAR(50),
        payment_second_status VARCHAR(50),
        status_delivery VARCHAR(50) DEFAULT 'PENDING',
        status VARCHAR(50) DEFAULT 'IN_PROGRESS',
        closed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    CREATE TABLE IF NOT EXISTS settlements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      settlement_id VARCHAR(100) UNIQUE NOT NULL,
      sale_id VARCHAR(100),
      property_id VARCHAR(100),
      customer_id VARCHAR(100),
      agent_id VARCHAR(100),
      total_revenue NUMERIC(15, 2),
      commission_rate NUMERIC(5, 4),
      commission_amount NUMERIC(15, 2),
      net_revenue NUMERIC(15, 2),
      settled_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
);
    `);
    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
