# Seed spec

```json
{
  "seed": 42,
  "tables": [
    { "name": "teams", "rows": 5, "columns": { "id": "serial", "name": "company" } },
    {
      "name": "users",
      "rows": 30,
      "columns": {
        "id": "uuid",
        "email": "email",
        "name": "fullName",
        "team_id": { "ref": "teams.id" },
        "plan": { "oneOf": ["free", "pro"] },
        "age": { "type": "int", "min": 18, "max": 80 },
        "created_at": { "type": "timestamp", "from": "2024-01-01", "to": "2025-01-01" },
        "active": { "type": "bool", "chance": 0.8 }
      }
    }
  ]
}
```

- A column is a generator name (`"email"`), an object with `type` and options, `{ "oneOf": [...] }` or `{ "ref": "table.column" }`.
- Tables are generated in dependency order, so references always point at rows that exist. A reference loop is an error.
- Options: `int` and `decimal` take `min`, `max` (and `places` for decimal); `bool` takes `chance`; `timestamp` and `date` take `from` and `to`; `constant` takes `value`.
- `--seed N` overrides the seed in the file. Output formats: `sql` (default, `--out file`), `json`, `csv` (needs `--out dir`, one file per table).
- Emails always use `example.com`. Names are drawn from a fixed list, never real people.
