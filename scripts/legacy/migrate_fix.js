#!/usr/bin/env node
/**
 * FLE-31: Fix migration for tables that failed in initial run
 * Issues: text[] columns serialized as jsonb, large rows exceeding API limit
 */

const https = require('https');
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const DEV = 'zqlowjveyqiagnbmfwsb';
const MAIN = 'uowjtrzmszuaiokqxgir';

if (!TOKEN) { console.error('Set SUPABASE_ACCESS_TOKEN'); process.exit(1); }

function apiQuery(ref, sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${ref}/database/query`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.message) reject(new Error(parsed.message));
          else resolve(parsed);
        } catch (e) { reject(new Error(`Parse: ${body.substring(0, 500)}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Get column types for a table
async function getColumnTypes(ref, schema, table) {
  const cols = await apiQuery(ref, `
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema='${schema}' AND table_name='${table}'
    ORDER BY ordinal_position
  `);
  const types = {};
  for (const c of cols) types[c.column_name] = { data_type: c.data_type, udt_name: c.udt_name };
  return types;
}

function escValue(val, colType) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);

  // Handle PostgreSQL arrays (text[], _text, etc.)
  if (colType && (colType.udt_name.startsWith('_') || colType.data_type === 'ARRAY')) {
    if (Array.isArray(val)) {
      if (val.length === 0) return "'{}'";
      const elements = val.map(v => {
        if (v === null) return 'NULL';
        const s = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `"${s}"`;
      });
      return `'{${elements.join(',')}}'`;
    }
    // Already a string representation of array
    if (typeof val === 'string' && val.startsWith('{')) {
      return `'${val.replace(/'/g, "''")}'`;
    }
    // JSON array from API
    if (typeof val === 'object') {
      const arr = Array.isArray(val) ? val : Object.values(val);
      if (arr.length === 0) return "'{}'";
      const elements = arr.map(v => `"${String(v).replace(/"/g, '\\"')}"`);
      return `'{${elements.join(',')}}'`;
    }
  }

  // Handle jsonb
  if (typeof val === 'object') {
    const json = JSON.stringify(val).replace(/'/g, "''");
    return `'${json}'::jsonb`;
  }

  // String
  const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "''");
  return `'${escaped}'`;
}

async function migrateTable(schema, table, opts = {}) {
  const { excludeCols = [], batchSize = 10 } = opts;

  const devTypes = await getColumnTypes(DEV, schema, table);
  const mainTypes = await getColumnTypes(MAIN, schema, table);
  const mainColSet = new Set(Object.keys(mainTypes));

  const cols = Object.keys(devTypes)
    .filter(c => !excludeCols.includes(c))
    .filter(c => mainColSet.has(c));

  const colList = cols.map(c => `"${c}"`).join(', ');
  const rows = await apiQuery(DEV, `SELECT ${colList} FROM ${schema}."${table}"`);

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`  ${schema}.${table}: 0 rows`);
    return 0;
  }

  let inserted = 0, errors = 0;
  // Insert one-by-one for reliability with large/complex rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const vals = cols.map(c => {
      // Use Main's column type for proper casting
      return escValue(row[c], mainTypes[c]);
    }).join(', ');

    try {
      await apiQuery(MAIN, `INSERT INTO ${schema}."${table}" (${colList}) VALUES (${vals}) ON CONFLICT DO NOTHING`);
      inserted++;
    } catch (e) {
      errors++;
      if (errors <= 5) console.error(`    ERR [${i}]: ${e.message.substring(0, 250)}`);
    }

    if (rows.length > 50 && i % 50 === 0 && i > 0) console.log(`    ...${i}/${rows.length}`);
  }

  const status = errors > 0 ? ` (${errors} errors)` : '';
  console.log(`  ${schema}.${table}: ${inserted}/${rows.length} rows${status}`);
  return inserted;
}

async function main() {
  console.log('=== FLE-31: Fix Migration for Failed Tables ===\n');

  // 1. waitlist_entries (rejection_reasons text[] mismatch)
  console.log('--- waitlist_entries ---');
  await migrateTable('public', 'waitlist_entries');

  // 2. extracted_rental_info (large rows, needs row-by-row)
  console.log('\n--- extracted_rental_info ---');
  await migrateTable('public', 'extracted_rental_info');

  // 3. tenancies (landlord_names text[] mismatch)
  console.log('\n--- tenancies ---');
  await migrateTable('public', 'tenancies');

  // 4. supported_cities (null state)
  console.log('\n--- supported_cities (fix null state) ---');
  try {
    // Allow null state temporarily
    await apiQuery(MAIN, `ALTER TABLE public.supported_cities ALTER COLUMN state DROP NOT NULL`);
    await migrateTable('public', 'supported_cities');
  } catch (e) {
    console.log('  ' + e.message.substring(0, 150));
  }

  // 5. notification_queue (1 missing)
  console.log('\n--- notification_queue ---');
  await migrateTable('public', 'notification_queue');

  // Verify
  console.log('\n--- Verification ---');
  const checks = [
    'waitlist_entries', 'extracted_rental_info', 'tenancies',
    'supported_cities', 'notification_queue'
  ];
  for (const t of checks) {
    const mainRes = await apiQuery(MAIN, `SELECT count(*) as cnt FROM public."${t}"`);
    const devRes = await apiQuery(DEV, `SELECT count(*) as cnt FROM public."${t}"`);
    const match = mainRes[0].cnt === devRes[0].cnt ? '✓' : '✗';
    console.log(`  ${match} ${t}: Main=${mainRes[0].cnt} Dev=${devRes[0].cnt}`);
  }

  console.log('\n=== Fix migration complete ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
