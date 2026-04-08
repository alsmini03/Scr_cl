import pg from 'pg';
import Airtable from 'airtable';
const { Pool } = pg;

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const DATABASE_URL = process.env.DATABASE_URL;

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID || !DATABASE_URL) {
  console.error('AIRTABLE_PAT, AIRTABLE_BASE_ID, and DATABASE_URL environment variables are required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

async function migrateTable(airtableTableName, postgresTableName = airtableTableName) {
  console.log(`Migrating table: Airtable: ${airtableTableName} -> Postgres: ${postgresTableName}...`);

  try {
    const records = await base(airtableTableName).select().all();
    console.log(`Found ${records.length} records in Airtable table ${airtableTableName}.`);

    if (records.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Clear existing data to avoid duplicates
      await client.query(`DELETE FROM ${postgresTableName}`);

      for (const record of records) {
        const fields = record.fields;
        const columns = [];
        const values = [];

        for (const [key, value] of Object.entries(fields)) {
            let colName = key;
            if (postgresTableName === 'users' && key === 'is_approved') colName = 'is_approved';

            // Skip SERIAL IDs for accounts/sessions as they are auto-generated
            if ((postgresTableName === 'accounts' || postgresTableName === 'sessions') && key === 'id') continue;

            if (colName === 'emailVerified' || colName === 'userId' || colName === 'providerAccountId' || colName === 'sessionToken') {
                columns.push(`"${colName}"`);
            } else {
                columns.push(colName);
            }
            values.push(value === undefined || value === null ? null : value);
        }

        if (columns.length === 0) continue;

        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO ${postgresTableName} (${columns.join(', ')}) VALUES (${placeholders})`;

        await client.query(query, values);
      }

      await client.query('COMMIT');
      console.log(`Successfully migrated ${records.length} records to ${postgresTableName}.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Error migrating to ${postgresTableName}:`, err.message);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`Error fetching from Airtable ${airtableTableName}:`, err.message);
  }
}

async function run() {
  const tableMapping = [
    { airtable: 'users', postgres: 'users' },
    { airtable: 'accounts', postgres: 'accounts' },
    { airtable: 'sessions', postgres: 'sessions' },
    { airtable: 'verification_tokens', postgres: 'verification_token' },
    { airtable: 'books', postgres: 'books' },
    { airtable: 'naver_blogs', postgres: 'naver_blogs' },
    { airtable: 'youtube_videos', postgres: 'youtube_videos' },
    { airtable: 'youtube_tabs', postgres: 'youtube_tabs' },
    { airtable: 'blog_tabs', postgres: 'blog_tabs' },
    { airtable: 'yes24_tabs', postgres: 'yes24_tabs' },
    { airtable: 'report_tabs', postgres: 'report_tabs' },
    { airtable: 'gemini_models', postgres: 'gemini_models' },
    { airtable: 'gemini_prompts', postgres: 'gemini_prompts' },
    { airtable: 'reports', postgres: 'reports' }
  ];

  for (const mapping of tableMapping) {
    await migrateTable(mapping.airtable, mapping.postgres);
  }

  await pool.end();
  console.log('Migration finished.');
}

run();
