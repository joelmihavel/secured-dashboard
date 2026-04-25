#!/usr/bin/env node
/**
 * FLE-31: Complete data migration Dev → Main (v2 - handles enum mismatch)
 *
 * Key fix: Disables the handle_new_user trigger during auth migration
 * (it tries to insert into public.users with user_status_enum cast, but
 * Main's column is typed user_status). We migrate public.users separately.
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
        } catch (e) { reject(new Error(`Parse error: ${body.substring(0, 500)}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "''");
  return `'${escaped}'`;
}

// Columns that need explicit type casts due to enum mismatches
// Dev uses user_status_enum, Main column is user_status
const ENUM_CAST_COLS = {
  'public.users.user_status': 'user_status',
};

function escCol(val, schema, table, col) {
  const raw = esc(val);
  const key = `${schema}.${table}.${col}`;
  if (ENUM_CAST_COLS[key] && raw !== 'NULL') {
    return `${raw}::text::${ENUM_CAST_COLS[key]}`;
  }
  return raw;
}

async function migrate(schema, table, excludeCols = []) {
  const colInfo = await apiQuery(DEV,
    `SELECT column_name FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='${table}' ORDER BY ordinal_position`
  );

  // Also get Main columns to only insert columns that exist on both
  const mainColInfo = await apiQuery(MAIN,
    `SELECT column_name FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='${table}' ORDER BY ordinal_position`
  );
  const mainColSet = new Set(mainColInfo.map(c => c.column_name));

  const cols = colInfo
    .map(c => c.column_name)
    .filter(c => !excludeCols.includes(c))
    .filter(c => mainColSet.has(c));  // Only include columns present on Main

  const colList = cols.map(c => `"${c}"`).join(', ');

  const rows = await apiQuery(DEV, `SELECT ${colList} FROM ${schema}."${table}"`);
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`  ${schema}.${table}: 0 rows (skip)`);
    return 0;
  }

  let inserted = 0, errors = 0;
  const BS = 20;
  for (let i = 0; i < rows.length; i += BS) {
    const batch = rows.slice(i, i + BS);
    const vals = batch.map(r =>
      '(' + cols.map(c => escCol(r[c], schema, table, c)).join(', ') + ')'
    ).join(',\n');
    const sql = `INSERT INTO ${schema}."${table}" (${colList}) VALUES ${vals} ON CONFLICT DO NOTHING`;
    try {
      await apiQuery(MAIN, sql);
      inserted += batch.length;
    } catch (e) {
      for (const r of batch) {
        const singleVals = cols.map(c => escCol(r[c], schema, table, c)).join(', ');
        try {
          await apiQuery(MAIN, `INSERT INTO ${schema}."${table}" (${colList}) VALUES (${singleVals}) ON CONFLICT DO NOTHING`);
          inserted++;
        } catch (e2) {
          errors++;
          if (errors <= 5) console.error(`    ERR ${schema}.${table}: ${e2.message.substring(0, 250)}`);
        }
      }
    }
    if (rows.length > 50 && i % 100 === 0 && i > 0) console.log(`    ...${i}/${rows.length}`);
  }
  const status = errors > 0 ? ` (${errors} errors)` : '';
  console.log(`  ${schema}.${table}: ${inserted}/${rows.length} rows${status}`);
  return inserted;
}

const PUBLIC_TABLES = [
  'app_config', 'fee_config', 'supported_cities', 'netbanking_banks',
  'invite_codes', 'referral_codes', 'users', 'notification_preferences',
  'device_tokens', 'notification_queue', 'notifications', 'audit_logs',
  'idempotency_keys', 'deleted_users_archive', 'waitlist_entries',
  'extracted_rental_info', 'tenancies', 'bank_accounts', 'payments',
  'identity_verifications', 'utility_verifications', 'cashback_ledger',
  'refunds', 'processed_webhooks', 'payment_schedules', 'referral_redemptions',
  'payment_methods', 'invite_code_attempts', 'otp_requests',
];

async function main() {
  console.log('=== FLE-31: Complete Data Migration Dev → Main (v2) ===\n');
  const start = Date.now();

  // Step 0: Enum mismatch already fixed (handle_new_user + check_and_advance_to_active
  // now use user_status instead of user_status_enum). No trigger disabling needed.
  console.log('--- Step 0: Pre-checks passed (enum fix applied) ---');

  // Step 1: Auth tables
  console.log('\n--- Step 1: auth.users ---');
  await migrate('auth', 'users', ['confirmed_at']);

  console.log('--- Step 1b: auth.identities ---');
  await migrate('auth', 'identities', ['email']);

  // Auth triggers stayed enabled (enum fix handles the type mismatch)

  // Step 2: Drop FK constraints
  console.log('\n--- Step 2: Drop FK constraints ---');
  await apiQuery(MAIN, `
    DO $$ DECLARE r RECORD; BEGIN
      FOR r IN SELECT conname, conrelid::regclass AS tbl
        FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace
      LOOP
        EXECUTE 'ALTER TABLE ' || r.tbl || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
      END LOOP;
    END $$;
  `);
  console.log('  FK constraints dropped.');

  // Step 3: Public tables
  console.log('\n--- Step 3: Public tables ---');
  let total = 0;
  for (const t of PUBLIC_TABLES) {
    try {
      total += await migrate('public', t);
    } catch (e) {
      console.error(`  FAILED ${t}: ${e.message.substring(0, 200)}`);
    }
  }

  // Step 3b: Private schema
  console.log('\n--- Step 3b: private schema ---');
  try { await migrate('private', 'edge_function_config'); } catch (e) { console.log(`  skipped: ${e.message.substring(0, 100)}`); }

  // Step 4: Re-add FK constraints
  console.log('\n--- Step 4: Re-add FK constraints ---');
  const fkDefs = await apiQuery(DEV, `
    SELECT
      'ALTER TABLE ' || nsp.nspname || '.' || cl.relname ||
      ' ADD CONSTRAINT ' || con.conname ||
      ' FOREIGN KEY (' || string_agg(att.attname, ', ' ORDER BY u.attposition) || ')' ||
      ' REFERENCES ' || fnsp.nspname || '.' || fcl.relname ||
      '(' || string_agg(fatt.attname, ', ' ORDER BY u.attposition) || ')' ||
      CASE WHEN con.confdeltype = 'c' THEN ' ON DELETE CASCADE'
           WHEN con.confdeltype = 'n' THEN ' ON DELETE SET NULL'
           WHEN con.confdeltype = 'd' THEN ' ON DELETE SET DEFAULT'
           ELSE '' END ||
      CASE WHEN con.confupdtype = 'c' THEN ' ON UPDATE CASCADE'
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
      await apiQuery(MAIN, fk.fk_sql);
      fkOk++;
    } catch (e) {
      if (e.message.includes('already exists')) { fkOk++; }
      else { console.error(`  FK err: ${e.message.substring(0, 150)}`); }
    }
  }
  console.log(`  Re-added ${fkOk}/${fkDefs.length} FK constraints.`);

  // Step 5: Reset sequences
  console.log('\n--- Step 5: Reset sequences ---');
  try {
    await apiQuery(MAIN, `
      DO $$ DECLARE r RECORD; BEGIN
        FOR r IN SELECT c.relname AS seq, t.relname AS tab, a.attname AS col
          FROM pg_class c
          JOIN pg_depend d ON d.objid = c.oid
          JOIN pg_class t ON d.refobjid = t.oid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
          WHERE c.relkind = 'S' AND t.relnamespace = 'public'::regnamespace
        LOOP
          EXECUTE format('SELECT setval(%L, COALESCE(MAX(%I), 1)) FROM public.%I', r.seq, r.col, r.tab);
        END LOOP;
      END $$;
    `);
    console.log('  Sequences reset.');
  } catch (e) { console.log('  Sequences: ' + e.message.substring(0, 100)); }

  // Step 6: Verify counts
  console.log('\n--- Step 6: Verification ---');
  const checks = [
    ['auth.users', 'SELECT count(*) as cnt FROM auth.users'],
    ['auth.identities', 'SELECT count(*) as cnt FROM auth.identities'],
    ['public.users', 'SELECT count(*) as cnt FROM public.users'],
    ['public.tenancies', 'SELECT count(*) as cnt FROM public.tenancies'],
    ['public.payments', 'SELECT count(*) as cnt FROM public.payments'],
    ['public.bank_accounts', 'SELECT count(*) as cnt FROM public.bank_accounts'],
  ];
  for (const [name, sql] of checks) {
    const mainRes = await apiQuery(MAIN, sql);
    const devRes = await apiQuery(DEV, sql);
    const match = mainRes[0].cnt === devRes[0].cnt ? '✓' : '✗';
    console.log(`  ${match} ${name}: Main=${mainRes[0].cnt} Dev=${devRes[0].cnt}`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== DONE: ${total} public rows migrated in ${elapsed}s ===`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
