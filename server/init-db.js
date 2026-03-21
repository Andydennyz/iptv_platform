const { Pool } = require('pg');
require('dotenv').config();

async function initializeDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Creating tables...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        _id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ Categories table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS channels (
        _id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        number INT,
        categoryid VARCHAR(50),
        logocolor VARCHAR(7),
        islive BOOLEAN DEFAULT FALSE,
        streamurl VARCHAR(500),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_category FOREIGN KEY (categoryid) REFERENCES categories(_id) ON DELETE SET NULL
      );
    `);
    console.log('✓ Channels table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS programs (
        _id VARCHAR(50) PRIMARY KEY,
        channelid VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        genre VARCHAR(50),
        rating VARCHAR(10),
        starttime TIMESTAMPTZ NOT NULL,
        endtime TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_channel FOREIGN KEY (channelid) REFERENCES channels(_id) ON DELETE CASCADE
      );
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_channel_time ON programs(channelid, starttime, endtime);');
    console.log('✓ Programs table created');

    await pool.query(`
      INSERT INTO categories (_id, name, icon) VALUES
        ('cat-news', 'News', 'newspaper'),
        ('cat-sports', 'Sports', 'trophy'),
        ('cat-entertainment', 'Entertainment', 'film'),
        ('cat-general', 'General', 'tv')
      ON CONFLICT (_id) DO NOTHING;
    `);
    console.log('✓ Sample categories inserted');

    console.log('\n✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
