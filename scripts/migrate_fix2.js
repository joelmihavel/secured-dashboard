#!/usr/bin/env node
/**
 * FLE-31: Fix remaining tables - paginated extraction + tenancies
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
    if (typeof val === 'string' && val.startsWith('{')) {
      return `'${val.replace(/'/g, "''")}'`;
    }
    if (typeof val === 'object') {
      const arr = Object.values(val);
      if (arr.length === 0) return "'{}'";
      const elements = arr.map(v => `"${String(v).replace(/"/g, '\\"')}"`);
      return `'{${elements.join(',')}}'`;
    }
  }

  if (typeof val === 'object') {
    const json = JSON.stringify(val).replace(/'/g, "''");
    return `'${json}'::jsonb`;
  }

  const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "''");
  return `'${escaped}'`;
}

async function migratePaginated(schema, table, opts = {}) {
  const { excludeCols = [], pageSize = 10 } = opts;

  const devTypes = await getColumnTypes(DEV, schema, table);
  const mainTypes = await getColumnTypes(MAIN, schema, table);
  const mainColSet = new Set(Object.keys(mainTypes));

  const cols = Object.keys(devTypes)
    .filter(c => !excludeCols.includes(c))
    .filter(c => mainColSet.has(c));

  const colList = cols.map(c => `"${c}"`).join(', ');

  // Get total count
  const countRes = await apiQuery(DEV, `SELECT count(*) as cnt FROM ${schema}."${table}"`);
  const total = parseInt(countRes[0].cnt);
  console.log(`  Total rows: ${total}`);

  if (total === 0) return 0;

  let inserted = 0, errors = 0;

  for (let offset = 0; offset < total; offset += pageSize) {
    const rows = await apiQuery(DEV,
      `SELECT ${colList} FROM ${schema}."${table}" ORDER BY created_at, id LIMIT ${pageSize} OFFSET ${offset}`
    );

    for (const row of rows) {
      const vals = cols.map(c => escValue(row[c], mainTypes[c])).join(', ');
      try {
        await apiQuery(MAIN, `INSERT INTO ${schema}."${table}" (${colList}) VALUES (${vals}) ON CONFLICT DO NOTHING`);
        inserted++;
      } catch (e) {
        errors++;
        if (errors <= 5) console.error(`    ERR: ${e.message.substring(0, 250)}`);
      }
    }

    if (offset > 0 && offset % 50 === 0) console.log(`    ...${offset}/${total}`);
  }

  const status = errors > 0 ? ` (${errors} errors)` : '';
  console.log(`  ${schema}.${table}: ${inserted}/${total} rows${status}`);
  return inserted;
}

async function main() {
  console.log('=== FLE-31: Fix Remaining Tables ===\n');

  // 1. extracted_rental_info - paginated to avoid 1GB query limit
  console.log('--- extracted_rental_info (paginated) ---');
  await migratePaginated('public', 'extracted_rental_info', { pageSize: 5 });

  // 2. tenancies
  console.log('\n--- tenancies ---');
  await migratePaginated('public', 'tenancies', { pageSize: 10 });

  // Verify all critical tables
  console.log('\n--- Final Verification ---');
  const checks = [
    'auth.users', 'auth.identities',
    'users', 'waitlist_entries', 'extracted_rental_info', 'tenancies',
    'bank_accounts', 'payments', 'identity_verifications',
    'cashback_ledger', 'device_tokens', 'referral_codes',
  ];
  for (const t of checks) {
    const schema = t.includes('.') ? t.split('.')[0] : 'public';
    const table = t.includes('.') ? t.split('.')[1] : t;
    const mainRes = await apiQuery(MAIN, `SELECT count(*) as cnt FROM ${schema}."${table}"`);
    const devRes = await apiQuery(DEV, `SELECT count(*) as cnt FROM ${schema}."${table}"`);
    const match = mainRes[0].cnt === devRes[0].cnt ? '✓' : '✗';
    console.log(`  ${match} ${t}: Main=${mainRes[0].cnt} Dev=${devRes[0].cnt}`);
  }

  console.log('\n=== Done ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
