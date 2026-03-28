import pg from 'pg';
import Airtable from 'airtable';
const { Pool } = pg;

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const POSTGRES_URL = process.env.POSTGRES_URL;

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID || !POSTGRES_URL) {
  console.error('AIRTABLE_PAT, AIRTABLE_BASE_ID, and POSTGRES_URL environment variables are required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: POSTGRES_URL,
});

const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateTable(tableName, postgresTableName = tableName) {
  console.log(`Migrating table: ${postgresTableName} -> Airtable: ${tableName}...`);
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM ${postgresTableName}`);
    console.log(`Found ${rows.length} rows in ${postgresTableName}.`);

    for (let i = 0; i < rows.length; i += 10) {
      const batch = rows.slice(i, i + 10).map(row => {
        const fields = {};
        for (let [key, value] of Object.entries(row)) {
          let val = value;

          if (tableName === 'users' && key === 'isApproved') key = 'is_approved';

          if (val instanceof Date) {
            val = val.toISOString();
          }

          if (val === null) continue;

          const numericFields = ['position', 'rating', 'progress', 'expires_at'];
          if (numericFields.includes(key)) {
            fields[key] = Number(val);
          } else if (key === 'is_approved' || key === 'is_default') {
            fields[key] = !!val;
          } else {
            fields[key] = String(val);
          }
        }
        return { fields };
      });

      try {
        await base(tableName).create(batch);
        console.log(`Uploaded ${batch.length} records to ${tableName}...`);
      } catch (e) {
        console.error(`Error creating records in ${tableName}:`, e.message);
      }
      await sleep(200);
    }
  } catch (err) {
    if (err.message.includes('relation') && err.message.includes('does not exist')) {
        console.warn(`Table ${postgresTableName} does not exist in Postgres, skipping.`);
    } else {
        console.error(`Error migrating ${tableName}:`, err.message);
    }
  } finally {
    client.release();
  }
}

async function run() {
  const tableNames = [
    'users',
    'accounts',
    'sessions',
    'books',
    'naver_blogs',
    'youtube_videos',
    'youtube_tabs',
    'blog_tabs',
    'yes24_tabs',
    'report_tabs',
    'gemini_models',
    'gemini_prompts'
  ];

  for (const table of tableNames) {
    await migrateTable(table);
  }

  await pool.end();
  console.log('Migration finished.');
}

run();
