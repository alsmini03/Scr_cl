import pg from 'pg';
import fs from 'fs';
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

    const sql = fs.readFileSync('schema.sql', 'utf8');
    await client.query(sql);
    console.log('Schema initialized successfully.');
  } catch (err) {
    console.error('Error initializing schema:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
