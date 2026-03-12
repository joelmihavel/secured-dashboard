#!/usr/bin/env node
/**
 * FLE-31: Migrate production data from Dev (v2-backend-dev) to Main
 * Uses Supabase Management API to copy data table by table
 */

const https = require('https');

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const DEV_REF = 'zqlowjveyqiagnbmfwsb';
const MAIN_REF = 'uowjtrzmszuaiokqxgir';

// Tables in FK-safe insertion order (parents first, children after)
const TABLES_IN_ORDER = [
  // No FK dependencies
  'app_config',
  'fee_config',
  'supported_cities',
  'netbanking_banks',
  'invite_codes',
  'referral_codes',
  // Depends on referral_codes
  'users',
  // Depends on users
  'notification_preferences',
  'device_tokens',
  'notification_queue',
  'audit_logs',
  'idempotency_keys',
  'deleted_users_archive',
  // Depends on invite_codes
  'waitlist_entries',
  // Depends on users
  'extracted_rental_info',
  // Depends on users, extracted_rental_info
  'tenancies',
  // Depends on users
  'bank_accounts',
  // Depends on tenancies, bank_accounts
  'payments',
  // Depends on users, tenancies
  'identity_verifications',
  'utility_verifications',
  // Depends on payments
  'cashback_ledger',
  'refunds',
  'processed_webhooks',
  // Depends on users
  'notifications',
  // Depends on tenancies
  'payment_schedules',
  // Depends on referral_codes
  'referral_redemptions',
  // Depends on users
  'payment_methods',
  'invite_code_attempts',
];

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
          if (parsed.error || parsed.message) {
            reject(new Error(JSON.stringify(parsed)));
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

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    // JSON/JSONB
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  // String - escape single quotes
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function migrateTable(table) {
  // Get all rows from Dev
  const rows = await apiQuery(DEV_REF, `SELECT * FROM public."${table}"`);

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`  ${table}: 0 rows (skipping)`);
    return 0;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');

  // Batch inserts in chunks of 50 rows
  const BATCH_SIZE = 50;
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(row => {
      const vals = columns.map(col => escapeValue(row[col]));
      return `(${vals.join(', ')})`;
    }).join(',\n');

    const insertSql = `INSERT INTO public."${table}" (${colList}) VALUES ${values} ON CONFLICT DO NOTHING`;

    try {
      await apiQuery(MAIN_REF, insertSql);
      totalInserted += batch.length;
    } catch (e) {
      console.error(`  ERROR inserting batch into ${table}: ${e.message.substring(0, 300)}`);
      // Try individual inserts for this batch
      for (const row of batch) {
        const singleVals = columns.map(col => escapeValue(row[col]));
        const singleSql = `INSERT INTO public."${table}" (${colList}) VALUES (${singleVals.join(', ')}) ON CONFLICT DO NOTHING`;
        try {
          await apiQuery(MAIN_REF, singleSql);
          totalInserted++;
        } catch (e2) {
          console.error(`    SKIP row in ${table}: ${e2.message.substring(0, 200)}`);
        }
      }
    }
  }

  console.log(`  ${table}: ${totalInserted}/${rows.length} rows migrated`);
  return totalInserted;
}

async function main() {
  console.log('=== FLE-31: Data Migration Dev → Main ===\n');

  // Disable triggers during migration
  console.log('Disabling triggers...');
  await apiQuery(MAIN_REF, `SET session_replication_role = 'replica'`);

  let totalRows = 0;
  let failedTables = [];

  for (const table of TABLES_IN_ORDER) {
    try {
      const count = await migrateTable(table);
      totalRows += count;
    } catch (e) {
      console.error(`  FAILED ${table}: ${e.message.substring(0, 300)}`);
      failedTables.push(table);
    }
  }

  // Re-enable triggers
  console.log('\nRe-enabling triggers...');
  await apiQuery(MAIN_REF, `SET session_replication_role = 'origin'`);

  // Reset sequences
  console.log('Resetting sequences...');
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

  console.log(`\n=== Migration Complete ===`);
  console.log(`Total rows migrated: ${totalRows}`);
  if (failedTables.length > 0) {
    console.log(`Failed tables: ${failedTables.join(', ')}`);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
