#!/usr/bin/env node
/**
 * FLE-31: Migrate production data from Dev to Main (v2)
 * 1. Migrate auth.users + auth.identities
 * 2. Disable FK constraints on Main
 * 3. Migrate all public tables
 * 4. Re-enable FK constraints
 */

const https = require('https');

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const DEV_REF = 'zqlowjveyqiagnbmfwsb';
const MAIN_REF = 'uowjtrzmszuaiokqxgir';

function apiQuery(ref, sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${ref}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.message) {
            reject(new Error(parsed.message));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function escapeValue(val, colName) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  // String - escape single quotes and backslashes
  const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "''");
  return `'${escaped}'`;
}

async function migrateTable(schema, table, columns) {
  // Get column list if not provided
  if (!columns) {
    const colInfo = await apiQuery(DEV_REF,
      `SELECT column_name FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='${table}' ORDER BY ordinal_position`
    );
    columns = colInfo.map(c => c.column_name);
  }

  const colList = columns.map(c => `"${c}"`).join(', ');

  // Get all rows from Dev
  const rows = await apiQuery(DEV_REF, `SELECT ${colList} FROM ${schema}."${table}"`);

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`  ${schema}.${table}: 0 rows (skipping)`);
    return 0;
  }

  // Batch inserts
  const BATCH_SIZE = 25;
  let totalInserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(row => {
      const vals = columns.map(col => escapeValue(row[col], col));
      return `(${vals.join(', ')})`;
    }).join(',\n');

    const insertSql = `INSERT INTO ${schema}."${table}" (${colList}) VALUES ${values} ON CONFLICT DO NOTHING`;

    try {
      await apiQuery(MAIN_REF, insertSql);
      totalInserted += batch.length;
    } catch (e) {
      // Try individual inserts
      for (const row of batch) {
        const singleVals = columns.map(col => escapeValue(row[col], col));
        const singleSql = `INSERT INTO ${schema}."${table}" (${colList}) VALUES (${singleVals.join(', ')}) ON CONFLICT DO NOTHING`;
        try {
          await apiQuery(MAIN_REF, singleSql);
          totalInserted++;
        } catch (e2) {
          errors++;
          if (errors <= 3) {
            console.error(`    ERR ${schema}.${table}: ${e2.message.substring(0, 150)}`);
          }
        }
      }
    }
    // Progress
    if (rows.length > 100 && i % 100 === 0 && i > 0) {
      console.log(`    ... ${i}/${rows.length} processed`);
    }
  }

  const status = errors > 0 ? ` (${errors} errors)` : '';
  console.log(`  ${schema}.${table}: ${totalInserted}/${rows.length} rows migrated${status}`);
  return totalInserted;
}

// Public tables in FK-safe order (parents first)
const PUBLIC_TABLES = [
  'app_config',
  'fee_config',
  'supported_cities',
  'netbanking_banks',
  'invite_codes',
  // users depends on auth.users (handled separately) and referral_codes
  // referral_codes depends on users — circular dependency
  // We'll insert users first (with referral_code_id NULL), then referral_codes, then update users
  'users',
  'referral_codes',
  'notification_preferences',
  'device_tokens',
  'notification_queue',
  'notifications',
  'audit_logs',
  'idempotency_keys',
  'deleted_users_archive',
  'waitlist_entries',
  'extracted_rental_info',
  'tenancies',
  'bank_accounts',
  'payments',
  'identity_verifications',
  'utility_verifications',
  'cashback_ledger',
  'refunds',
  'processed_webhooks',
  'payment_schedules',
  'referral_redemptions',
  'payment_methods',
  'invite_code_attempts',
  'otp_requests',
];

async function main() {
  console.log('=== FLE-31: Data Migration Dev → Main (v2) ===\n');

  // Step 1: Migrate auth.users
  console.log('--- Step 1: Migrating auth.users ---');
  await migrateTable('auth', 'users');

  // Step 1b: Migrate auth.identities
  console.log('--- Step 1b: Migrating auth.identities ---');
  await migrateTable('auth', 'identities');

  // Step 2: Disable FK constraints
  console.log('\n--- Step 2: Disabling FK constraints ---');
  await apiQuery(MAIN_REF, `
    DO $$ DECLARE r RECORD; BEGIN
      FOR r IN SELECT conname, conrelid::regclass AS tbl
        FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace
      LOOP
        EXECUTE 'ALTER TABLE ' || r.tbl || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
      END LOOP;
    END $$;
  `);
  console.log('  FK constraints dropped.');

  // Step 3: Migrate all public tables
  console.log('\n--- Step 3: Migrating public tables ---');
  let totalRows = 0;
  for (const table of PUBLIC_TABLES) {
    try {
      const count = await migrateTable('public', table);
      totalRows += count;
    } catch (e) {
      console.error(`  FAILED ${table}: ${e.message.substring(0, 200)}`);
    }
  }

  // Step 3b: Migrate private schema tables
  console.log('\n--- Step 3b: Migrating private.edge_function_config ---');
  try {
    await migrateTable('private', 'edge_function_config');
  } catch (e) {
    console.log('  private.edge_function_config: skipped (' + e.message.substring(0, 100) + ')');
  }

  // Step 4: Re-add FK constraints
  console.log('\n--- Step 4: Re-adding FK constraints ---');
  // Get FK definitions from Dev and recreate on Main
  const fkDefs = await apiQuery(DEV_REF, `
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
    ORDER BY cl.relname
  `);

  let fkCount = 0;
  for (const fk of fkDefs) {
    try {
      await apiQuery(MAIN_REF, fk.fk_sql);
      fkCount++;
    } catch (e) {
      console.error(`  FK error: ${e.message.substring(0, 150)}`);
    }
  }
  console.log(`  Re-added ${fkCount}/${fkDefs.length} FK constraints.`);

  // Step 5: Reset sequences
  console.log('\n--- Step 5: Resetting sequences ---');
  try {
    await apiQuery(MAIN_REF, `
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
  } catch (e) {
    console.log('  Sequence reset: ' + e.message.substring(0, 100));
  }

  console.log(`\n=== Migration Complete: ${totalRows} total rows migrated ===`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
