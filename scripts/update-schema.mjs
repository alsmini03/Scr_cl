import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required.');
  process.exit(1);
}

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to Neon DB.');

    await client.query(`
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT,
            institution TEXT,
            date TEXT,
            url TEXT,
            thumbnail TEXT,
            content TEXT,
            summary TEXT,
            user_id TEXT NOT NULL,
            added_at TEXT NOT NULL
        )
    `);
    console.log('Reports table created successfully.');
  } catch (err) {
    console.error('Error creating reports table:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
