/**
 * vitest globalSetup: creates a saans_test database for stack tests, so vitest
 * never pollutes the dev database (saans). Tears down after all tests finish.
 */
import pg from "pg";

const DEV_URL = "postgres://saans:saans@127.0.0.1:5433/saans";
const TEST_DB = "saans_test";
const TEST_URL = DEV_URL.replace(/\/saans$/, `/${TEST_DB}`);

export async function setup() {
  // Connect to the default DB to create the test DB
  const admin = new pg.Client({ connectionString: DEV_URL });
  await admin.connect();
  try {
    // Drop and recreate to start fresh
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await admin.query(`CREATE DATABASE "${TEST_DB}" TEMPLATE template0`);
  } finally {
    await admin.end();
  }

  // Enable PostGIS in the test DB
  const test = new pg.Client({ connectionString: TEST_URL });
  await test.connect();
  try {
    await test.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
  } finally {
    await test.end();
  }

  // Override for all test workers
  process.env.SAANS_DATABASE_URL = TEST_URL;
}

export async function teardown() {
  // Drop the test DB
  const admin = new pg.Client({ connectionString: DEV_URL });
  await admin.connect();
  try {
    // Force-terminate any lingering connections
    await admin.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()
    `);
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
  } finally {
    await admin.end();
  }
}
