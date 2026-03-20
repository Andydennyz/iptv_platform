-- Create database
CREATE DATABASE IF NOT EXISTS iptv;
USE iptv;

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  _id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create channels table
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
);

-- Create programs table
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
);

-- Insert sample categories
INSERT IGNORE INTO categories (_id, name, icon) VALUES 
  ('cat-news', 'News', 'newspaper'),
  ('cat-sports', 'Sports', 'trophy'),
  ('cat-entertainment', 'Entertainment', 'film');
