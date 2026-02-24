import { readFileSync } from 'fs';
import { join } from 'path';
import pool from './connection';

export async function runMigrations(): Promise<void> {
  const migrationPath = join(__dirname, 'migrations', '001_initial_schema.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  try {
    await pool.query(sql);
    console.log('Migrations applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}

// Run directly if called as script
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
