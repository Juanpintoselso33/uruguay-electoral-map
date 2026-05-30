# Schema Catalog

> **Source of Truth for ALL database tables**

**Last Updated**: YYYY-MM-DD
**Database**: PostgreSQL XX.X
**Total Tables**: X

---

## Table Index

| Table | Purpose | Row Count |
|-------|---------|-----------|
| [users](#users) | User accounts | ~X,XXX |
| [projects](#projects) | Project entities | ~XXX |
| [documents](#documents) | Document records | ~XX,XXX |

---

## Table Definitions

### users

User accounts and authentication data.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `user_uuid` | UUID | NO | gen_random_uuid() | Primary key |
| `email` | VARCHAR(255) | NO | - | User email (unique) |
| `name` | VARCHAR(255) | YES | - | Display name |
| `created_at` | TIMESTAMP | NO | now() | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | now() | Last update timestamp |

**Indexes**:
- `users_pkey` (PRIMARY KEY) on `user_uuid`
- `users_email_key` (UNIQUE) on `email`

**Constraints**:
- `email` must be unique
- `email` must be valid format (check constraint)

---

### projects

Project entities owned by users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `project_uuid` | UUID | NO | gen_random_uuid() | Primary key |
| `name` | VARCHAR(255) | NO | - | Project name |
| `owner_uuid` | UUID | NO | - | FK to users.user_uuid |
| `status` | VARCHAR(50) | NO | 'active' | Project status |
| `created_at` | TIMESTAMP | NO | now() | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | now() | Last update timestamp |

**Indexes**:
- `projects_pkey` (PRIMARY KEY) on `project_uuid`
- `projects_owner_uuid_idx` on `owner_uuid`

**Foreign Keys**:
- `owner_uuid` → `users.user_uuid`

---

### documents

Document records within projects.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `document_uuid` | UUID | NO | gen_random_uuid() | Primary key |
| `project_uuid` | UUID | NO | - | FK to projects |
| `title` | VARCHAR(500) | NO | - | Document title |
| `file_path` | TEXT | YES | - | Storage path |
| `file_size_bytes` | BIGINT | YES | - | File size |
| `mime_type` | VARCHAR(100) | YES | - | MIME type |
| `created_at` | TIMESTAMP | NO | now() | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | now() | Last update timestamp |

**Indexes**:
- `documents_pkey` (PRIMARY KEY) on `document_uuid`
- `documents_project_uuid_idx` on `project_uuid`

**Foreign Keys**:
- `project_uuid` → `projects.project_uuid`

---

## Field Naming Conventions

### Standard Suffixes
- `_uuid` - UUID primary/foreign keys
- `_at` - Timestamps (created_at, updated_at)
- `_bytes` - Size in bytes
- `_count` - Numeric counts

### Canonical Names

| Concept | Correct Name | NEVER Use |
|---------|--------------|-----------|
| User ID | `user_uuid` | `user_id`, `uid` |
| Project ID | `project_uuid` | `project_id`, `proj_id` |
| Document ID | `document_uuid` | `doc_id`, `document_id` |
| File Path | `file_path` | `path`, `filepath` |
| File Size | `file_size_bytes` | `size`, `filesize` |

---

## Deprecated Tables

These tables should NOT be used in new code:

| Table | Reason | Replacement |
|-------|--------|-------------|
| `old_users` | Migrated | `users` |
| `legacy_docs` | Migrated | `documents` |

---

## Verification Queries

### Check Table Exists
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'users'
);
```

### Get Row Count
```sql
SELECT reltuples::bigint AS estimate
FROM pg_class
WHERE relname = 'users';
```

### Compare Schema
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```
