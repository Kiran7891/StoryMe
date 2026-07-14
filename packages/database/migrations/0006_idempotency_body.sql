-- Store the full response for Idempotency-Key replay (claim-first pattern):
-- a row with NULL response_body is an in-flight claim; a populated row replays.
BEGIN;
ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS response_body jsonb;
COMMIT;
