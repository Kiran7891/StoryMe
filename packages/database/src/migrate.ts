/**
 * Minimal, dependency-light SQL migration runner. Applies every *.sql file in
 * ../migrations in lexical order exactly once, tracked in schema_migrations.
 * Forward-only; each file must be idempotent-safe within its own transaction.
 *
 * Usage: DATABASE_URL=postgres://... tsx src/migrate.ts
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    const applied = new Set(
      (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name),
    );

    for (const file of files) {
      if (applied.has(file)) {
        console.warn(`• skip   ${file} (already applied)`);
        continue;
      }
      const contents = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      console.warn(`▶ apply  ${file}`);
      await sql.unsafe(contents);
      await sql`INSERT INTO schema_migrations (name) VALUES (${file})`;
    }
    console.warn('✓ migrations up to date');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
