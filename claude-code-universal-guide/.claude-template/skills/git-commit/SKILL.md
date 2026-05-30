---
name: git-commit
description: Smart commit workflow with conventional commit formatting, staging guidance, and commit message templates.
---

# Git Commit Skill

## Overview

Create well-formatted commits following conventional commits standard with proper staging, descriptive messages, and co-author attribution.

## Conventional Commit Format

### Structure
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat** - New feature
- **fix** - Bug fix
- **docs** - Documentation changes
- **refactor** - Code refactoring (no behavior change)
- **test** - Test additions/changes
- **chore** - Build/config changes
- **perf** - Performance improvements
- **style** - Code style (formatting, whitespace)

### Scopes (customize for your project)
- `api`, `ui`, `db`, `auth`, `config`, `ci`

### Examples

**Simple commit**:
```bash
git commit -m "feat(api): add user authentication endpoint"
```

**With body**:
```bash
git commit -m "$(cat <<'EOF'
fix(api): handle timeout errors in payment processing

- Add exponential backoff retry logic (4 attempts)
- Increase timeout from 60s to 300s
- Log retry attempts for monitoring

Fixes #42

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Breaking change**:
```bash
git commit -m "$(cat <<'EOF'
feat(api)!: change authentication to use JWT

BREAKING CHANGE: Session-based auth is removed.
Update all API clients to use Bearer token authentication.

Migration guide: See docs/migration/jwt-auth.md

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Staging Workflow

### Stage Specific Files
```bash
git add src/components/SearchFilter.tsx
git add src/types/search.ts
```

### Stage by Patch (Interactive)
```bash
git add -p src/components/Document.tsx
# Select hunks to stage: y (yes), n (no), s (split)
```

### Review Staged Changes
```bash
git diff --staged
```

### Unstage Files
```bash
git reset HEAD src/components/temp.tsx
```

## Commit Message Templates

### Feature Commit
```
feat(<scope>): <what was added>

- Implementation detail 1
- Implementation detail 2

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Bug Fix Commit
```
fix(<scope>): <what was fixed>

Root cause: <brief explanation>
Fix: <how it was fixed>

Fixes #<issue-number>

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Refactor Commit
```
refactor(<scope>): <what was refactored>

Motivation: <why refactoring was needed>
Changes: <what changed internally>

No behavior changes.

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Best Practices

### Commit Frequency
- Commit often (every logical change)
- Don't commit broken code
- Keep commits atomic (one concern per commit)

### Commit Messages
- Use imperative mood ("add feature" not "added feature")
- Capitalize subject line
- No period at end of subject
- Wrap body at 72 characters
- Separate subject from body with blank line

### What to Commit
- Source code changes
- Test files
- Documentation
- Configuration files

### What NOT to Commit
- Build artifacts
- node_modules/, .venv/
- .env files (sensitive)
- IDE-specific files (.idea/, .vscode/)

## Troubleshooting

### Commit Rejected (Pre-Commit Hook)
**Symptom**: Pre-commit hook fails
**Fix**: Fix linting/type errors, then re-commit

### Commit Message Validation Failed
**Symptom**: Commit-msg hook rejects message
**Fix**: Use proper conventional format: `type(scope): subject`

### Accidental Commit to Main
**Fix**:
```bash
git reset HEAD~1        # Undo commit (keep changes)
git checkout -b feature/my-feature
git commit -m "..."     # Re-commit on feature branch
```

## Reference

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Documentation](https://git-scm.com/doc)
