const express = require('express');
const pool = require('../config/db');
const router = express.Router();

// GET /api/categories
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT _id, name, icon FROM categories');
    res.json(rows);
  } catch (error) {
    console.error('categories error', error);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

// GET /api/channels
router.get('/channels', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT _id, name, description, number, categoryId, logoColor, isLive, streamUrl FROM channels ORDER BY number'
    );
    res.json(rows);
  } catch (error) {
    console.error('channels error', error);
    res.status(500).json({ error: 'Failed to load channels' });
  }
});

// GET /api/programs?windowStart=...&windowEnd=...
router.get('/programs', async (req, res) => {
  const { windowStart, windowEnd } = req.query;
  if (!windowStart || !windowEnd) {
    return res.status(400).json({ error: 'windowStart and windowEnd are required' });
  }

  try {
    const [channels] = await pool.query(
      'SELECT _id, name, description, number, categoryId, logoColor, isLive, streamUrl FROM channels ORDER BY number'
    );

    const [programs] = await pool.query(
      'SELECT _id, channelId, title, description, genre, rating, startTime, endTime FROM programs WHERE startTime <= ? AND endTime >= ? ORDER BY startTime',
      [windowEnd, windowStart]
    );

    const epg = channels.map((channel) => ({
      channel,
      programs: programs.filter((program) => program.channelId === channel._id),
    }));

    res.json(epg);
  } catch (error) {
    console.error('programs error', error);
    res.status(500).json({ error: 'Failed to load programs' });
  }
});

// POST /api/programs/seed (optional helper)
router.post('/programs/seed', async (req, res) => {
  try {
    const channelData = [
      ['ch1', 'News Live', '24/7 news channel', 101, 'cat-news', '#1F77B4', 1, 'https://test-hls.example/1.m3u8'],
      ['ch2', 'Sports Hub', 'Live sports and highlights', 102, 'cat-sports', '#2CA02C', 1, 'https://test-hls.example/2.m3u8'],
      ['ch3', 'Movie Zone', 'Blockbuster movies', 103, 'cat-entertainment', '#D62728', 0, 'https://test-hls.example/3.m3u8'],
    ];

    const programData = [
      ['p1', 'ch1', 'Morning News', 'News headlines', 'News', 'G', '2026-03-20 00:00:00', '2026-03-20 01:00:00'],
      ['p2', 'ch1', 'Midday Update', 'Midday news', 'News', 'G', '2026-03-20 01:00:00', '2026-03-20 02:00:00'],
      ['p3', 'ch2', 'Live Football', 'Weekend match', 'Sports', 'PG', '2026-03-20 00:30:00', '2026-03-20 02:30:00'],
    ];

    await pool.query(
      'INSERT IGNORE INTO channels (_id,name,description,number,categoryId,logoColor,isLive,streamUrl) VALUES ?',[channelData]
    );
    await pool.query(
      'INSERT IGNORE INTO programs (_id,channelId,title,description,genre,rating,startTime,endTime) VALUES ?',[programData]
    );

    res.json({ seeded: true });
  } catch (error) {
    console.error('seed error', error);
    res.status(500).json({ error: 'Failed to seed data' });
  }
});

module.exports = router;
