/**
 * Idempotent development seed. Creates a couple of demo users, a character, and a
 * couple of public comics with social interactions so the feed has content locally.
 * Safe to run repeatedly. NEVER run against production.
 *
 * Usage: DATABASE_URL=postgres://... tsx src/seed.ts
 */
import postgres from 'postgres';

/** Assert an INSERT ... RETURNING produced a row (it always does on success). */
function req<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (!row) throw new Error(`expected a row from ${label}`);
  return row;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed production');

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const alice = req(await sql`
      INSERT INTO users (email, display_name, handle, role)
      VALUES ('alice@example.com', 'Alice', 'alice', 'user')
      ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id`, 'alice');
    const bob = req(await sql`
      INSERT INTO users (email, display_name, handle, role)
      VALUES ('bob@example.com', 'Bob', 'bob', 'user')
      ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id`, 'bob');
    const admin = req(await sql`
      INSERT INTO users (email, display_name, handle, role)
      VALUES ('admin@storyme.app', 'Admin', 'admin', 'admin')
      ON CONFLICT (email) DO UPDATE SET role = 'admin'
      RETURNING id`, 'admin');

    await sql`INSERT INTO billing_accounts (user_id, plan)
      VALUES (${alice.id}, 'plus'), (${bob.id}, 'free')
      ON CONFLICT (user_id) DO NOTHING`;

    await sql`INSERT INTO credit_ledger (user_id, delta, reason, ref_id)
      VALUES (${alice.id}, 50, 'seed_grant', 'seed-alice'),
             (${bob.id}, 5, 'seed_grant', 'seed-bob')
      ON CONFLICT (reason, ref_id) WHERE ref_id IS NOT NULL DO NOTHING`;

    const hero = req(await sql`
      INSERT INTO characters (user_id, name, kind)
      VALUES (${alice.id}, 'Captain Alice', 'person')
      RETURNING id`, 'hero');

    const book = req(await sql`
      INSERT INTO comics (user_id, character_id, title, prompt, style, format, status, moderation, is_public, share_slug, published_at, panel_count)
      VALUES (${alice.id}, ${hero.id}, 'Alice and the Candy Planet',
              'Alice explores a planet made of candy and saves the gummy bears.',
              'manga', 'book', 'complete', 'approved', true, 'candy-planet', now(), 6)
      ON CONFLICT (share_slug) DO UPDATE SET title = EXCLUDED.title
      RETURNING id`, 'book');
    const reel = req(await sql`
      INSERT INTO comics (user_id, character_id, title, prompt, style, format, status, moderation, is_public, share_slug, published_at, panel_count)
      VALUES (${alice.id}, ${hero.id}, 'Superhero Alice (Reel)',
              'Alice becomes a superhero and stops a runaway train.',
              'superhero', 'reel', 'complete', 'approved', true, 'superhero-alice', now(), 5)
      ON CONFLICT (share_slug) DO UPDATE SET title = EXCLUDED.title
      RETURNING id`, 'reel');

    await sql`INSERT INTO comic_stats (comic_id) VALUES (${book.id}), (${reel.id})
      ON CONFLICT (comic_id) DO NOTHING`;

    // Bob follows Alice, likes and comments
    await sql`INSERT INTO follows (follower_id, followee_id)
      VALUES (${bob.id}, ${alice.id}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO likes (user_id, comic_id)
      VALUES (${bob.id}, ${book.id}), (${bob.id}, ${reel.id}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO comments (comic_id, user_id, body)
      SELECT ${book.id}, ${bob.id}, 'This is amazing! 😍'
      WHERE NOT EXISTS (
        SELECT 1 FROM comments WHERE comic_id = ${book.id} AND user_id = ${bob.id}
      )`;

    console.warn(`✓ seeded users: alice=${alice.id} bob=${bob.id} admin=${admin.id}`);
    console.warn(`✓ seeded comics: book=${book.id} reel=${reel.id}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
