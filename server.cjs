const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔌 DB CONNECTION POOL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_CONN_LIMIT || 10),
});

// Test connection on startup
pool
  .query('SELECT 1')
  .then(() => console.log('✓ Database connected'))
  .catch(err => console.error('✗ Database connection failed:', err.message));

// 🏠 ROOT ROUTE
app.get("/", (req, res) => {
  res.json({ message: "IPTV Server running on port 5000" });
});

// 🚀 ROUTE 1 — GET ALL CHANNELS
app.get("/channels", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM channels LIMIT 100");
    res.json(result.rows);
  } catch (error) {
    console.error("GET /channels error:", error);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

// 🚀 ROUTE 2 — GET CHANNELS BY CATEGORY
app.get("/channels/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const result = await pool.query(
      "SELECT * FROM channels WHERE categoryid = $1",
      [category]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("GET /channels/category error:", error);
    res.status(500).json({ error: "Failed to fetch channels by category" });
  }
});

// 🚀 ROUTE 3 — GET CATEGORIES
app.get("/categories", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM categories");
    res.json(result.rows);
  } catch (error) {
    console.error("GET /categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
  console.log(`📡 Try: http://localhost:${PORT}/channels`);
});