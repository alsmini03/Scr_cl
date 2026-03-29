import Airtable from 'airtable';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error('AIRTABLE_PAT and AIRTABLE_BASE_ID environment variables are required.');
  process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanupDuplicates(tableName, idField = 'id') {
  console.log(`Cleaning up duplicates in table: ${tableName} based on field: ${idField}...`);
  try {
    const records = await base(tableName).select().all();
    console.log(`Fetched ${records.length} records from ${tableName}.`);

    const groups = {};
    records.forEach(record => {
      const idVal = record.get(idField);
      if (!idVal) return;
      if (!groups[idVal]) groups[idVal] = [];
      groups[idVal].push(record.id);
    });

    const toDelete = [];
    for (const idVal in groups) {
      if (groups[idVal].length > 1) {
        // Keep the first one, delete the rest
        toDelete.push(...groups[idVal].slice(1));
      }
    }

    if (toDelete.length === 0) {
      console.log(`No duplicates found in ${tableName}.`);
      return;
    }

    console.log(`Found ${toDelete.length} duplicate records to delete in ${tableName}.`);

    for (let i = 0; i < toDelete.length; i += 10) {
      const batch = toDelete.slice(i, i + 10);
      await base(tableName).destroy(batch);
      console.log(`Deleted ${batch.length} records...`);
      await sleep(210); // Rate limit
    }
  } catch (err) {
    console.error(`Error cleaning up ${tableName}:`, err.message);
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
    await cleanupDuplicates(table);
  }

  // Special case for verification_tokens (if needed)
  // await cleanupDuplicates('verification_tokens', 'token');

  console.log('Cleanup finished.');
}

run();
