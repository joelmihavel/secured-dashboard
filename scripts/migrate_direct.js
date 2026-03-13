#!/usr/bin/env node
/**
 * FLE-31: Direct PostgreSQL migration for remaining tables
 * Uses pg module with direct connections (bypasses API size limits)
 */

const { Pool } = require('pg');

// Use pooler URLs (IPv4) since direct connections are IPv6-only
// Connection strings read from environment to avoid hardcoded credentials.
// Usage: DEV_DB_URL=... MAIN_DB_URL=... node scripts/migrate_direct.js
const DEV_URL = process.env.DEV_DB_URL || '';
const MAIN_URL = process.env.MAIN_DB_URL || '';
if (!DEV_URL || !MAIN_URL) {
  console.error('Set DEV_DB_URL and MAIN_DB_URL environment variables');
  console.error('Example: DEV_DB_URL="postgresql://postgres.zqlowjveyqiagnbmfwsb:PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"');
  process.exit(1);
}

const devPool = new Pool({ connectionString: DEV_URL, ssl: { rejectUnauthorized: false } });
const mainPool = new Pool({ connectionString: MAIN_URL, ssl: { rejectUnauthorized: false } });

async function copyTable(schema, table) {
  const devClient = await devPool.connect();
  const mainClient = await mainPool.connect();

  try {
    // Get column list from Dev
    const colRes = await devClient.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema=$1 AND table_name=$2
      ORDER BY ordinal_position
    `, [schema, table]);

    // Get Main column list
    const mainColRes = await mainClient.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema=$1 AND table_name=$2
      ORDER BY ordinal_position
    `, [schema, table]);
    const mainCols = new Set(mainColRes.rows.map(r => r.column_name));

    const cols = colRes.rows.map(r => r.column_name).filter(c => mainCols.has(c));
    const colList = cols.map(c => `"${c}"`).join(', ');

    // Count rows
    const countRes = await devClient.query(`SELECT count(*) as cnt FROM ${schema}."${table}"`);
    const total = parseInt(countRes.rows[0].cnt);

    if (total === 0) {
      console.log(`  ${schema}.${table}: 0 rows (skip)`);
      return 0;
    }

    // Read all rows from Dev
    const dataRes = await devClient.query(`SELECT ${colList} FROM ${schema}."${table}"`);
    const rows = dataRes.rows;

    let inserted = 0, errors = 0;

    for (const row of rows) {
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const values = cols.map(c => row[c]);

      try {
        await mainClient.query(
          `INSERT INTO ${schema}."${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
        inserted++;
      } catch (e) {
        errors++;
        if (errors <= 3) console.error(`    ERR: ${e.message.substring(0, 200)}`);
      }
    }

    const status = errors > 0 ? ` (${errors} errors)` : '';
    console.log(`  ${schema}.${table}: ${inserted}/${total} rows${status}`);
    return inserted;
  } finally {
    devClient.release();
    mainClient.release();
  }
}

async function main() {
  console.log('=== FLE-31: Direct DB Migration for Remaining Tables ===\n');

  try {
    // Test connections
    console.log('Testing connections...');
    const devTest = await devPool.query('SELECT current_database()');
    console.log('  Dev: connected (' + devTest.rows[0].current_database + ')');
    const mainTest = await mainPool.query('SELECT current_database()');
    console.log('  Main: connected (' + mainTest.rows[0].current_database + ')');

    // 1. extracted_rental_info (had API size limit issues)
    console.log('\n--- extracted_rental_info ---');
    await copyTable('public', 'extracted_rental_info');

    // 2. tenancies (had FK dependency on extracted_rental_info)
    console.log('\n--- tenancies ---');
    await copyTable('public', 'tenancies');

    // 3. Re-add FK constraints
    console.log('\n--- Re-adding FK constraints ---');
    const mainClient = await mainPool.connect();
    try {
      const devClient = await devPool.connect();
      try {
        const fkRes = await devClient.query(`
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
          AND (cl.relname IN ('extracted_rental_info', 'tenancies'))
          GROUP BY con.conname, nsp.nspname, cl.relname, fnsp.nspname, fcl.relname, con.confdeltype
        `);

        let fkOk = 0;
        for (const fk of fkRes.rows) {
          try {
            await mainClient.query(fk.fk_sql);
            fkOk++;
          } catch (e) {
            if (e.message.includes('already exists')) { fkOk++; }
            else console.error(`  FK err: ${e.message.substring(0, 150)}`);
          }
        }
        console.log(`  Re-added ${fkOk}/${fkRes.rows.length} FK constraints.`);
      } finally {
        devClient.release();
      }
    } finally {
      mainClient.release();
    }

    // 4. Verification
    console.log('\n--- Final Verification ---');
    const checks = [
      'auth.users', 'auth.identities',
      'users', 'waitlist_entries', 'extracted_rental_info', 'tenancies',
      'bank_accounts', 'payments', 'identity_verifications', 'utility_verifications',
      'cashback_ledger', 'device_tokens', 'referral_codes', 'payment_methods',
      'notification_preferences', 'invite_codes', 'otp_requests',
    ];
    for (const t of checks) {
      const schema = t.includes('.') ? t.split('.')[0] : 'public';
      const table = t.includes('.') ? t.split('.')[1] : t;
      const mainRes = await mainPool.query(`SELECT count(*) as cnt FROM ${schema}."${table}"`);
      const devRes = await devPool.query(`SELECT count(*) as cnt FROM ${schema}."${table}"`);
      const mc = mainRes.rows[0].cnt;
      const dc = devRes.rows[0].cnt;
      const match = mc === dc ? '✓' : (parseInt(mc) >= parseInt(dc) ? '~' : '✗');
      console.log(`  ${match} ${t}: Main=${mc} Dev=${dc}`);
    }

  } finally {
    await devPool.end();
    await mainPool.end();
  }

  console.log('\n=== Done ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
