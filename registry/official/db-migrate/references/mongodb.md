# MongoDB migration notes

- There is no schema to migrate, but documents change shape. Write code that reads both the old and new shape, then backfill, then remove the old path.
- Backfill in batches with a filter and a stable sort; never `updateMany({})` on a big collection.
- Index builds are online from 4.2, but still cost IO. Build during quiet hours and watch `currentOp`.
- Keep a `schemaVersion` field on documents you reshape so a backfill can resume.
- Drop collections only after a rename and a release of grace.
