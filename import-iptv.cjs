const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// M3U Parser
function parseM3U(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  const channels = [];
  let currentChannel = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF')) {
      // Extract tvg-name and group-title from the EXTINF line
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const displayNameMatch = line.match(/,(.*)$/);

      currentChannel = {
        name: tvgNameMatch ? tvgNameMatch[1] : 'Unknown',
        category: groupMatch ? groupMatch[1] : 'General',
        displayName: displayNameMatch ? displayNameMatch[1].trim() : 'Unknown',
      };
    } else if (currentChannel && line && !line.startsWith('#')) {
      // This is the stream URL
      // Clean up the URL (remove extra whitespace, line breaks, etc.)
      const cleanUrl = line.split('|')[0].trim();
      
      if (cleanUrl && (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))) {
        currentChannel.streamUrl = cleanUrl;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }
  }

  return channels;
}

// Database import function
async function importChannels() {
  const dbUrl = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
  const dbFromParts = process.env.DB_HOST
    ? `postgres://${encodeURIComponent(process.env.DB_USER || '')}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || ''}`
    : undefined;

  const pool = new Pool({
    connectionString: dbUrl || dbFromParts,
    ssl: (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production')
      ? { rejectUnauthorized: false }
      : false,
    max: Number(process.env.DB_CONN_LIMIT || 10),
  });

  try {
    console.log('📂 Reading M3U playlist...');
    const playlistPath = path.join(__dirname, 'playlist.m3u');
    
    if (!fs.existsSync(playlistPath)) {
      throw new Error(`Playlist file not found: ${playlistPath}`);
    }

    const channels = parseM3U(playlistPath);
    console.log(`✓ Found ${channels.length} channels`);

    // Get unique categories
    const categories = [...new Set(channels.map(ch => ch.category))];
    console.log(`\n📋 Creating categories: ${categories.join(', ')}`);

    // Insert categories
    for (const category of categories) {
      const categoryId = `cat-${category.toLowerCase().replace(/\s+/g, '-')}`;
      await pool.query(
        'INSERT INTO categories (_id, name, icon) VALUES ($1, $2, $3) ON CONFLICT (_id) DO NOTHING',
        [categoryId, category, null]
      );
    }
    console.log(`✓ Categories created/verified`);

    // Insert channels
    console.log(`\n🍿 Importing ${channels.length} channels...`);
    let insertedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      const channelId = `ch-${i + 1}`;
      const categoryId = `cat-${channel.category.toLowerCase().replace(/\s+/g, '-')}`;

      try {
        await pool.query(
          'INSERT INTO channels (_id, name, description, number, categoryId, logoColor, isLive, streamUrl) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (_id) DO NOTHING',
          [
            channelId,
            channel.name,
            channel.displayName, // Use displayName as description
            i + 1, // Channel number
            categoryId,
            '#2CA02C', // Default color
            1, // isLive
            channel.streamUrl
          ]
        );
        insertedCount++;

        // Progress indicator
        if ((i + 1) % 50 === 0) {
          console.log(`  → ${i + 1}/${channels.length} channels imported`);
        }
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          skippedCount++;
        } else {
          console.error(`  ⚠ Error importing channel "${channel.name}":`, error.message);
        }
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   • Inserted: ${insertedCount} channels`);
    console.log(`   • Skipped: ${skippedCount} (duplicates)`);

    // Show summary
    const result = await pool.query('SELECT COUNT(*) as total FROM channels');
    console.log(`\n📊 Database now contains ${result.rows[0].total} total channels`);

    const cats = await pool.query('SELECT COUNT(*) as total FROM categories');
    console.log(`   and ${cats.rows[0].total} categories`);

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run import
importChannels();
