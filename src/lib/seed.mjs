import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function seed() {
  const client = await pool.connect();
  try {
    // We need an email for the user. Since I don't have the user's email,
    // I will try to find a user in the 'users' table or use a placeholder.
    const userRes = await client.query('SELECT id FROM users LIMIT 1');
    if (userRes.rows.length === 0) {
      console.log("No users found. Cannot seed tabs.");
      return;
    }
    const userId = userRes.rows[0].id;
    console.log(`Seeding tabs for user: ${userId}`);

    const tabs = [
      { name: '언더스탠딩', url: 'https://m.youtube.com/@understanding./videos' },
      { name: '월가월부', url: 'https://m.youtube.com/@MK_Invest/videos' },
      { name: 'EO', url: 'https://m.youtube.com/@eo_korea/videos' }
    ];

    for (const tab of tabs) {
      const id = Math.random().toString(36).substring(2, 11);
      await client.query(
        'INSERT INTO youtube_tabs (id, user_id, name, url) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [id, userId, tab.name, tab.url]
      );
      console.log(`Added tab: ${tab.name}`);
    }

  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
