# SQLite migration notes

- No `ALTER COLUMN`. To change a column: create a new table, copy rows, drop the old table, rename the new one, recreate indexes.
- `DROP COLUMN` works only on 3.35 and later, and not for indexed, keyed or constrained columns.
- Foreign keys are off unless `PRAGMA foreign_keys = ON`. Turn them off during the table rebuild, then run `PRAGMA foreign_key_check`.
- DDL is transactional; wrap the rebuild in a transaction.
- Adding a `NOT NULL` column requires a default.
