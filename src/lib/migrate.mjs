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
        position INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Created youtube_tabs table.");

    // Create gemini_models table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gemini_models (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Created gemini_models table.");

    // Create gemini_prompts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gemini_prompts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Created gemini_prompts table.");

    // Create blog_tabs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS blog_tabs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Created blog_tabs table.");

    // Create yes24_tabs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS yes24_tabs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Created yes24_tabs table.");

    // Create report_tabs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS report_tabs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Created report_tabs table.");

    // Create naver_blogs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS naver_blogs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT,
        url TEXT NOT NULL,
        thumbnail TEXT,
        content TEXT,
        published_at TEXT,
        user_id TEXT NOT NULL,
        added_at TEXT NOT NULL
      )
    `);
    console.log("Created naver_blogs table.");

    // Migration for position column if table already exists
    try {
      await client.query(`ALTER TABLE youtube_tabs ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0`);
      console.log("Ensured position column in youtube_tabs table.");
    } catch (e) {
      console.error("Failed to add position column:", e.message);
    }

    // Migration for author column if table already exists
    try {
      await client.query(`ALTER TABLE naver_blogs ADD COLUMN IF NOT EXISTS author TEXT`);
      console.log("Ensured author column in naver_blogs table.");
    } catch (e) {
      console.error("Failed to add author column to naver_blogs:", e.message);
    }

    // 2. Add new columns to books table
    const columns = [
      { name: 'intro', type: 'TEXT' },
      { name: 'toc', type: 'TEXT' },
      { name: 'author_intro', type: 'TEXT' },
      { name: 'inside', type: 'TEXT' },
      { name: 'publisher_review', type: 'TEXT' },
      { name: 'yes24_url', type: 'TEXT' }
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

      // Specifically ensure alsmini03@gmail.com is approved
      await client.query(`UPDATE users SET is_approved = TRUE WHERE email = 'alsmini03@gmail.com'`);
      console.log(`Ensured alsmini03@gmail.com is approved.`);
    } catch (e) {
      console.error("Failed to update users table:", e.message);
    }


    // 5. Create Performance Indexes
    try {
      console.log("Creating performance indexes...");
      await client.query(`CREATE INDEX IF NOT EXISTS idx_books_user_id_text ON books ((user_id::text))`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_books_added_at ON books (added_at DESC)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_books_deleted_at ON books (deleted_at)`);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_naver_blogs_user_id_text ON naver_blogs ((user_id::text))`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_naver_blogs_added_at ON naver_blogs (added_at DESC)`);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_youtube_videos_user_id_text ON youtube_videos ((user_id::text))`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_youtube_videos_added_at ON youtube_videos (added_at DESC)`);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_blog_tabs_user_id_text ON blog_tabs ((user_id::text))`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_youtube_tabs_user_id_text ON youtube_tabs ((user_id::text))`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_report_tabs_user_id_text ON report_tabs ((user_id::text))`);
      console.log("Performance indexes created successfully.");
    } catch (e) {
      console.error("Failed to create indexes:", e.message);
    }

    // 6. Delete default YouTube tabs as per user request
    try {
      const defaultUrls = [
        'https://m.youtube.com/@understanding./videos',
        'https://m.youtube.com/@MK_Invest/videos',
        'https://m.youtube.com/@eo_korea/videos'
      ];
      const deleteRes = await client.query(`DELETE FROM youtube_tabs WHERE url = ANY($1)`, [defaultUrls]);
      console.log(`Deleted ${deleteRes.rowCount} default YouTube tabs.`);
    } catch (e) {
      console.error("Failed to delete default tabs:", e.message);
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
