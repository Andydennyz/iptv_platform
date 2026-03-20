const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔌 DB CONNECTION POOL
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "iptv",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection on startup
pool.getConnection()
  .then(() => console.log("✓ Database connected"))
  .catch(err => console.error("✗ Database connection failed:", err.message));

// 🏠 ROOT ROUTE
app.get("/", (req, res) => {
  res.json({ message: "IPTV Server running on port 5000" });
});

// 🚀 ROUTE 1 — GET ALL CHANNELS
app.get("/channels", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query("SELECT * FROM channels LIMIT 100");
    connection.release();
    res.json(results);
  } catch (error) {
    console.error("GET /channels error:", error);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

// 🚀 ROUTE 2 — GET CHANNELS BY CATEGORY
app.get("/channels/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT * FROM channels WHERE categoryId = ?",
      [category]
    );
    connection.release();
    res.json(results);
  } catch (error) {
    console.error("GET /channels/category error:", error);
    res.status(500).json({ error: "Failed to fetch channels by category" });
  }
});

// 🚀 ROUTE 3 — GET CATEGORIES
app.get("/categories", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query("SELECT * FROM categories");
    connection.release();
    res.json(results);
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