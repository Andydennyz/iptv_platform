const mysql = require('mysql2/promise');
require('dotenv').config();

async function initializeDatabase() {
  let connection;

  try {
    // Connect without specifying a database first
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    console.log('Creating database and tables...');

    // Create database
    await connection.query('CREATE DATABASE IF NOT EXISTS iptv');
    console.log('✓ Database created');

    // Use database
    await connection.query('USE iptv');

    // Create categories table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        _id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Categories table created');

    // Create channels table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS channels (
        _id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        number INT,
        categoryId VARCHAR(50),
        logoColor VARCHAR(7),
        isLive BOOLEAN DEFAULT 0,
        streamUrl VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoryId) REFERENCES categories(_id)
      )
    `);
    console.log('✓ Channels table created');

    // Create programs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS programs (
        _id VARCHAR(50) PRIMARY KEY,
        channelId VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        genre VARCHAR(50),
        rating VARCHAR(10),
        startTime DATETIME NOT NULL,
        endTime DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channelId) REFERENCES channels(_id),
        INDEX idx_channel_time (channelId, startTime, endTime)
      )
    `);
    console.log('✓ Programs table created');

    // Insert sample categories
    await connection.query(`
      INSERT IGNORE INTO categories (_id, name, icon) VALUES 
        ('cat-news', 'News', 'newspaper'),
        ('cat-sports', 'Sports', 'trophy'),
        ('cat-entertainment', 'Entertainment', 'film'),
        ('cat-general', 'General', 'tv')
    `);
    console.log('✓ Sample categories inserted');

    console.log('\n✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

initializeDatabase();
