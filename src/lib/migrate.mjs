import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Starting migration...");

    // 1. Create youtube_tabs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS youtube_tabs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Created youtube_tabs table.");

    // 2. Add new columns to books table
    const columns = [
      { name: 'intro', type: 'TEXT' },
      { name: 'toc', type: 'TEXT' },
      { name: 'author_intro', type: 'TEXT' },
      { name: 'inside', type: 'TEXT' },
      { name: 'publisher_review', type: 'TEXT' }
    ];

    for (const col of columns) {
      try {
        await client.query(`ALTER TABLE books ADD COLUMN ${col.name} ${col.type}`);
        console.log(`Added column ${col.name} to books table.`);
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`Column ${col.name} already exists.`);
        } else {
          throw e;
        }
      }
    }

    // 3. Ensure is_approved column exists in users table and approve existing users
    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE`);
      console.log("Ensured is_approved column in users table.");

      const updateRes = await client.query(`UPDATE users SET is_approved = TRUE WHERE is_approved IS FALSE`);
      console.log(`Approved ${updateRes.rowCount} existing users.`);
    } catch (e) {
      console.error("Failed to update users table:", e.message);
    }

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
