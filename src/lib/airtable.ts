import Airtable from 'airtable';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('Airtable credentials (AIRTABLE_PAT, AIRTABLE_BASE_ID) are missing from environment variables.');
  }
}

const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID || '');

export default base;

/**
 * Escapes values for Airtable filter formulas
 * Handles single quotes correctly
 */
export function escapeFormula(value: string | number | boolean): string {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return String(value).replace(/'/g, "\\'");
}

/**
 * Airtable API Rate Limiter
 * Limits to 5 requests per second
 */
let lastRequestTime = 0;
const MIN_INTERVAL = 210;

export async function rateLimitedFetch<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const waitTime = Math.max(0, MIN_INTERVAL - (now - lastRequestTime));
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  const result = await fn();
  lastRequestTime = Date.now();
  return result;
}

export function mapAirtableRecord(record: any) {
  return {
    ...record.fields,
    airtable_id: record.id
  };
}

/**
 * Common Airtable Operations
 */

export async function findRecord(tableName: string, filterByFormula: string) {
  return rateLimitedFetch(async () => {
    const records = await base(tableName).select({
      filterByFormula,
      maxRecords: 1
    }).firstPage();
    return records.length > 0 ? mapAirtableRecord(records[0]) : null;
  });
}

export async function findRecords(tableName: string, options: any = {}) {
  return rateLimitedFetch(async () => {
    const records = await base(tableName).select(options).all();
    return records.map(mapAirtableRecord);
  });
}

export async function createRecord(tableName: string, fields: any) {
  return rateLimitedFetch(async () => {
    const record = await base(tableName).create(fields);
    return mapAirtableRecord(record);
  });
}

export async function updateRecord(tableName: string, id: string, fields: any) {
  let airtableId = id;
  if (!id.startsWith('rec')) {
    const record = await findRecord(tableName, `{id} = '${escapeFormula(id)}'`);
    if (!record) throw new Error(`Record with id ${id} not found in ${tableName}`);
    airtableId = record.airtable_id;
  }

  return rateLimitedFetch(async () => {
    const record = await base(tableName).update(airtableId, fields);
    return mapAirtableRecord(record);
  });
}

export async function deleteRecord(tableName: string, id: string) {
  let airtableId = id;
  if (!id.startsWith('rec')) {
    const record = await findRecord(tableName, `{id} = '${escapeFormula(id)}'`);
    if (!record) return;
    airtableId = record.airtable_id;
  }

  return rateLimitedFetch(async () => {
    await base(tableName).destroy(airtableId);
  });
}

export async function batchDeleteRecords(tableName: string, ids: string[]) {
  if (ids.length === 0) return;

  const airtableIds: string[] = [];
  for (const id of ids) {
    if (id.startsWith('rec')) {
      airtableIds.push(id);
    } else {
      const record = await findRecord(tableName, `{id} = '${escapeFormula(id)}'`);
      if (record) airtableIds.push(record.airtable_id);
    }
  }

  for (let i = 0; i < airtableIds.length; i += 10) {
    const batch = airtableIds.slice(i, i + 10);
    await rateLimitedFetch(async () => {
      await base(tableName).destroy(batch);
    });
  }
}

export async function batchUpdateRecords(tableName: string, records: { id: string, fields: any }[]) {
  if (records.length === 0) return;

  const updates: { id: string, fields: any }[] = [];
  for (const item of records) {
    let airtableId = item.id;
    if (!item.id.startsWith('rec')) {
      const record = await findRecord(tableName, `{id} = '${escapeFormula(item.id)}'`);
      if (record) airtableId = record.airtable_id;
      else continue;
    }
    updates.push({ id: airtableId, fields: item.fields });
  }

  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    await rateLimitedFetch(async () => {
      await base(tableName).update(batch);
    });
  }
}
