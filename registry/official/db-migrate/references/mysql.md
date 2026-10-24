# MySQL migration notes

- Ask for `ALGORITHM=INPLACE, LOCK=NONE` (or `INSTANT` on 8.0+) so MySQL errors instead of silently locking.
- DDL commits implicitly: a failed migration does not roll back. Write each step so it can be re-run.
- Large tables: use an online schema change tool (gh-ost, pt-online-schema-change) when `LOCK=NONE` is not possible.
- Changing a column type or charset usually rebuilds the table.
- `utf8mb4` is the character set to use; `utf8` is a 3-byte subset.
- Index prefix lengths matter for long `VARCHAR` columns.
