# PostgreSQL migration notes

- Run `CREATE INDEX CONCURRENTLY` outside a transaction. It can fail and leave an invalid index: check `pg_index.indisvalid` and drop it before retrying.
- `ALTER TABLE ... ADD COLUMN` with a constant `DEFAULT` is instant on PostgreSQL 11 and later; older versions rewrite the table.
- `SET NOT NULL` scans the table. Add `CHECK (col IS NOT NULL) NOT VALID`, run `VALIDATE CONSTRAINT`, then `SET NOT NULL`; the scan is then skipped.
- Add foreign keys `NOT VALID`, then `VALIDATE CONSTRAINT` in a second step.
- Set `lock_timeout` (for example `SET lock_timeout = '3s'`) before DDL so a blocked migration fails fast instead of queueing traffic behind it.
- Changing a column type often rewrites the table. Add a new column, backfill in batches, switch, drop the old one.
- DDL is transactional: a failed migration rolls back (except `CONCURRENTLY`).
