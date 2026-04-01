import fetch from 'node-fetch';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error('AIRTABLE_PAT and AIRTABLE_BASE_ID environment variables are required.');
  process.exit(1);
}

async function createTable(tableName, fields) {
  console.log(`Creating table: ${tableName}...`);
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: tableName,
      description: `Table for ${tableName}`,
      fields: fields
    })
  });

  const data = await response.json();
  if (!response.ok) {
    if (data.error && data.error.type === 'TABLE_NAME_ALREADY_EXISTS') {
      console.log(`Table ${tableName} already exists.`);
      return;
    }
    console.error(`Failed to create table ${tableName}:`, JSON.stringify(data, null, 2));
    throw new Error(`Failed to create table ${tableName}`);
  }
  console.log(`Successfully created table: ${tableName}`);
}

const tables = [
  {
    name: 'users',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'name', type: 'singleLineText' },
      { name: 'email', type: 'email' },
      { name: 'emailVerified', type: 'dateTime', options: { dateFormat: { name: 'iso' }, timeFormat: { name: '24hour' }, timeZone: 'utc' } },
      { name: 'image', type: 'singleLineText' },
      { name: 'is_approved', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } }
    ]
  },
  {
    name: 'accounts',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'userId', type: 'singleLineText' },
      { name: 'type', type: 'singleLineText' },
      { name: 'provider', type: 'singleLineText' },
      { name: 'providerAccountId', type: 'singleLineText' },
      { name: 'refresh_token', type: 'multilineText' },
      { name: 'access_token', type: 'multilineText' },
      { name: 'expires_at', type: 'number', options: { precision: 0 } },
      { name: 'token_type', type: 'singleLineText' },
      { name: 'scope', type: 'singleLineText' },
      { name: 'id_token', type: 'multilineText' },
      { name: 'session_state', type: 'singleLineText' }
    ]
  },
  {
    name: 'sessions',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'sessionToken', type: 'singleLineText' },
      { name: 'userId', type: 'singleLineText' },
      { name: 'expires', type: 'dateTime', options: { dateFormat: { name: 'iso' }, timeFormat: { name: '24hour' }, timeZone: 'utc' } }
    ]
  },
  {
    name: 'verification_tokens',
    fields: [
      { name: 'identifier', type: 'singleLineText' },
      { name: 'token', type: 'singleLineText' },
      { name: 'expires', type: 'dateTime', options: { dateFormat: { name: 'iso' }, timeFormat: { name: '24hour' }, timeZone: 'utc' } }
    ]
  },
  {
    name: 'books',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'title', type: 'singleLineText' },
      { name: 'author', type: 'singleLineText' },
      { name: 'cover_image', type: 'singleLineText' },
      { name: 'description', type: 'multilineText' },
      { name: 'published_date', type: 'singleLineText' },
      { name: 'price', type: 'singleLineText' },
      { name: 'category', type: 'singleLineText' },
      { name: 'status', type: 'singleSelect', options: { choices: [{ name: 'READING' }, { name: 'FINISHED' }] } },
      { name: 'progress', type: 'number', options: { precision: 0 } },
      { name: 'rating', type: 'number', options: { precision: 0 } },
      { name: 'notes', type: 'multilineText' },
      { name: 'added_at', type: 'singleLineText' },
      { name: 'user_id', type: 'singleLineText' },
      { name: 'deleted_at', type: 'singleLineText' },
      { name: 'intro', type: 'multilineText' },
      { name: 'toc', type: 'multilineText' },
      { name: 'author_intro', type: 'multilineText' },
      { name: 'inside', type: 'multilineText' },
      { name: 'publisher_review', type: 'multilineText' },
      { name: 'yes24_url', type: 'singleLineText' }
    ]
  },
  {
    name: 'naver_blogs',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'title', type: 'singleLineText' },
      { name: 'author', type: 'singleLineText' },
      { name: 'url', type: 'singleLineText' },
      { name: 'thumbnail', type: 'singleLineText' },
      { name: 'content', type: 'multilineText' },
      { name: 'published_at', type: 'singleLineText' },
      { name: 'user_id', type: 'singleLineText' },
      { name: 'added_at', type: 'singleLineText' }
    ]
  },
  {
    name: 'youtube_videos',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'title', type: 'singleLineText' },
      { name: 'url', type: 'singleLineText' },
      { name: 'thumbnail', type: 'singleLineText' },
      { name: 'duration', type: 'singleLineText' },
      { name: 'published_at', type: 'singleLineText' },
      { name: 'summary', type: 'multilineText' },
      { name: 'description', type: 'multilineText' },
      { name: 'user_id', type: 'singleLineText' },
      { name: 'added_at', type: 'singleLineText' }
    ]
  },
  {
    name: 'youtube_tabs',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'user_id', type: 'singleLineText' },
      { name: 'name', type: 'singleLineText' },
      { name: 'url', type: 'singleLineText' },
      { name: 'position', type: 'number', options: { precision: 0 } },
      { name: 'created_at', type: 'singleLineText' }
    ]
  },
  {
    name: 'blog_tabs',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'user_id', type: 'singleLineText' },
      { name: 'name', type: 'singleLineText' },
      { name: 'url', type: 'singleLineText' },
      { name: 'position', type: 'number', options: { precision: 0 } },
      { name: 'created_at', type: 'singleLineText' }
    ]
  },
  {
    name: 'yes24_tabs',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'user_id', type: 'singleLineText' },
      { name: 'name', type: 'singleLineText' },
      { name: 'url', type: 'singleLineText' },
      { name: 'position', type: 'number', options: { precision: 0 } },
      { name: 'created_at', type: 'singleLineText' }
    ]
  },
  {
    name: 'report_tabs',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'user_id', type: 'singleLineText' },
      { name: 'name', type: 'singleLineText' },
      { name: 'url', type: 'singleLineText' },
      { name: 'position', type: 'number', options: { precision: 0 } },
      { name: 'created_at', type: 'singleLineText' }
    ]
  },
  {
    name: 'gemini_models',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'user_id', type: 'singleLineText' },
      { name: 'name', type: 'singleLineText' },
      { name: 'is_default', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } },
      { name: 'created_at', type: 'singleLineText' }
    ]
  },
  {
    name: 'gemini_prompts',
    fields: [
      { name: 'id', type: 'singleLineText' },
      { name: 'user_id', type: 'singleLineText' },
      { name: 'name', type: 'singleLineText' },
      { name: 'content', type: 'multilineText' },
      { name: 'is_default', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } },
      { name: 'created_at', type: 'singleLineText' }
    ]
  }
];

async function run() {
  for (const table of tables) {
    try {
      await createTable(table.name, table.fields);
    } catch (e) {
      console.error(`Error processing table ${table.name}:`, e.message);
    }
  }
}

run();
