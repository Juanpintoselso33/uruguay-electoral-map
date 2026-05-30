# Schema Documentation - Start Here

## Overview

This directory contains canonical documentation for your data schemas (database, API, etc.).

## Directory Contents

| File | Purpose |
|------|---------|
| `00_START_HERE.md` | This file - entry point |
| `SCHEMA_CATALOG.md` | Complete table/entity definitions |
| `FIELD_ALIGNMENT_GUIDE.md` | Developer playbook for field naming |

## Quick Reference

### Finding Table Information
1. Open `SCHEMA_CATALOG.md`
2. Search for table name (Cmd/Ctrl+F)
3. Review columns, types, constraints

### Adding New Tables
1. Create migration script
2. Run migration in dev environment
3. Update `SCHEMA_CATALOG.md` with new table
4. Verify column names match exactly

### Changing Existing Tables
1. Create migration script
2. Test migration locally
3. Update `SCHEMA_CATALOG.md`
4. Update any affected code

## Schema Conformance Rules

### MUST DO
- Use exact column names from `SCHEMA_CATALOG.md`
- Include appropriate filters in all queries
- Check NULL constraints before inserting

### NEVER DO
- Use field aliases (e.g., `doc_id` instead of `document_uuid`)
- Query deprecated tables
- Skip schema validation

## Common Patterns

### Correct
```sql
SELECT document_uuid, created_at
FROM documents
WHERE project_uuid = $1;
```

### Incorrect
```sql
-- DON'T use aliases
SELECT doc_id, created  -- Wrong field names!
FROM docs              -- Wrong table name!
WHERE project = $1;    -- Wrong filter name!
```

## Maintenance

This documentation should be updated:
- After every migration
- When field names change
- When new tables are added
- When tables are deprecated

## Related Documentation

- `ai_docs/architecture/` - Infrastructure documentation
- `ai_docs/adr/` - Architecture Decision Records
