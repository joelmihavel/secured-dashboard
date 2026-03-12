#!/usr/bin/env node
const https = require('https');
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const DEV = 'zqlowjveyqiagnbmfwsb';
const MAIN = 'uowjtrzmszuaiokqxgir';

function api(ref, sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${ref}/database/query`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(b);
          if (p.message) reject(new Error(p.message));
          else resolve(p);
        } catch (e) { reject(new Error(b.substring(0, 300))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function migrate(schema, table, excludeCols = []) {
  const colInfo = await api(DEV,
    `SELECT column_name FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='${table}' ORDER BY ordinal_position`
  );
  const cols = colInfo.map(c => c.column_name).filter(c => !excludeCols.includes(c));
  const colList = cols.map(c => `"${c}"`).join(', ');

  const rows = await api(DEV, `SELECT ${colList} FROM ${schema}."${table}"`);
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`  ${schema}.${table}: 0 rows`);
    return 0;
  }

  let inserted = 0, errors = 0;
  const BS = 20;
  for (let i = 0; i < rows.length; i += BS) {
    const batch = rows.slice(i, i + BS);
    const vals = batch.map(r => '(' + cols.map(c => esc(r[c])).join(', ') + ')').join(',\n');
    try {
      await api(MAIN, `INSERT INTO ${schema}."${table}" (${colList}) VALUES ${vals} ON CONFLICT DO NOTHING`);
      inserted += batch.length;
    } catch (e) {
      for (const r of batch) {
        try {
          await api(MAIN, `INSERT INTO ${schema}."${table}" (${colList}) VALUES (${cols.map(c => esc(r[c])).join(', ')}) ON CONFLICT DO NOTHING`);
          inserted++;
        } catch (e2) {
          errors++;
          if (errors <= 5) console.error(`    ERR: ${e2.message.substring(0, 200)}`);
        }
      }
    }
    if (rows.length > 50 && i % 100 === 0 && i > 0) console.log(`    ...${i}/${rows.length}`);
  }
  console.log(`  ${schema}.${table}: ${inserted}/${rows.length} rows${errors ? ` (${errors} errors)` : ''}`);
  return inserted;
}

async function main() {
  console.log('=== Step 1: Migrate auth tables ===\n');

  // auth.users (exclude generated column confirmed_at)
  await migrate('auth', 'users', ['confirmed_at']);

  // auth.identities (exclude generated column email)
  await migrate('auth', 'identities', ['email']);

  // auth.sessions
  try { await migrate('auth', 'sessions'); } catch (e) { console.log(`  auth.sessions: ${e.message.substring(0, 80)}`); }

  // auth.refresh_tokens
  try { await migrate('auth', 'refresh_tokens'); } catch (e) { console.log(`  auth.refresh_tokens: ${e.message.substring(0, 80)}`); }

  console.log('\n=== Step 2: Drop FK constraints on public schema ===\n');
  await api(MAIN, `
    DO $$ DECLARE r RECORD; BEGIN
      FOR r IN SELECT conname, conrelid::regclass AS tbl
        FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace
      LOOP
        EXECUTE 'ALTER TABLE ' || r.tbl || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
      END LOOP;
    END $$;
  `);
  console.log('  FK constraints dropped.');

  console.log('\n=== Step 3: Migrate public tables ===\n');
  const tables = [
    'app_config', 'fee_config', 'supported_cities', 'netbanking_banks',
    'invite_codes', 'referral_codes', 'users', 'notification_preferences',
    'device_tokens', 'notification_queue', 'notifications', 'audit_logs',
    'idempotency_keys', 'deleted_users_archive', 'waitlist_entries',
    'extracted_rental_info', 'tenancies', 'bank_accounts', 'payments',
    'identity_verifications', 'utility_verifications', 'cashback_ledger',
    'refunds', 'processed_webhooks', 'payment_schedules', 'referral_redemptions',
    'payment_methods', 'invite_code_attempts', 'otp_requests',
  ];

  let total = 0;
  for (const t of tables) {
    try {
      total += await migrate('public', t);
    } catch (e) {
      console.error(`  FAILED ${t}: ${e.message.substring(0, 200)}`);
    }
  }

  // private schema
  console.log('\n=== Step 3b: Migrate private schema ===\n');
  try { await migrate('private', 'edge_function_config'); } catch (e) { console.log(`  skipped: ${e.message.substring(0, 80)}`); }

  console.log('\n=== Step 4: Re-add FK constraints ===\n');
  const fkDefs = await api(DEV, `
    SELECT
      'ALTER TABLE ' || nsp.nspname || '.' || cl.relname ||
      ' ADD CONSTRAINT ' || con.conname ||
      ' FOREIGN KEY (' || string_agg(att.attname, ', ' ORDER BY u.attposition) || ')' ||
      ' REFERENCES ' || fnsp.nspname || '.' || fcl.relname ||
      '(' || string_agg(fatt.attname, ', ' ORDER BY u.attposition) || ')' ||
      CASE WHEN con.confdeltype = 'c' THEN ' ON DELETE CASCADE'
           WHEN con.confdeltype = 'n' THEN ' ON DELETE SET NULL'
           WHEN con.confdeltype = 'd' THEN ' ON DELETE SET DEFAULT'
           ELSE '' END AS fk_sql
    FROM pg_constraint con
    JOIN pg_namespace nsp ON nsp.oid = con.connamespace
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_class fcl ON fcl.oid = con.confrelid
    JOIN pg_namespace fnsp ON fnsp.oid = fcl.relnamespace
    CROSS JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS u(attnum, fattnum, attposition)
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum
    JOIN pg_attribute fatt ON fatt.attrelid = con.confrelid AND fatt.attnum = u.fattnum
    WHERE con.contype = 'f' AND nsp.nspname = 'public'
    GROUP BY con.conname, nsp.nspname, cl.relname, fnsp.nspname, fcl.relname, con.confdeltype, con.confupdtype
  `);

  let fkOk = 0;
  for (const fk of fkDefs) {
    try {
      await api(MAIN, fk.fk_sql);
      fkOk++;
    } catch (e) {
      console.error(`  FK err: ${e.message.substring(0, 150)}`);
    }
  }
  console.log(`  Re-added ${fkOk}/${fkDefs.length} FK constraints.`);

  console.log(`\n=== DONE: ${total} public rows migrated ===`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
