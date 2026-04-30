const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
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
    `);
    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
