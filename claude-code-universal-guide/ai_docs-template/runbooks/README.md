# Operational Runbooks

## Overview

This directory contains runbooks for common operational procedures.

## Runbook Index

| Runbook | Purpose | When to Use |
|---------|---------|-------------|
| [deployment.md](deployment.md) | Production deployment | Deploying changes |
| [rollback.md](rollback.md) | Emergency rollback | When deployment fails |
| [database-access.md](database-access.md) | Database access | Querying production DB |
| [incident-response.md](incident-response.md) | Incident handling | Production issues |

## Runbook Template

Each runbook should include:

```markdown
# [Runbook Title]

## Overview
Brief description of the procedure.

## Prerequisites
- What you need before starting
- Required access/permissions

## Procedure
1. Step 1
2. Step 2
3. Step 3

## Verification
How to verify the procedure succeeded.

## Rollback
How to undo if something goes wrong.

## Troubleshooting
Common issues and solutions.
```

## Creating New Runbooks

1. Identify a repeatable operational procedure
2. Copy the template above
3. Document each step clearly
4. Test the runbook
5. Get peer review
6. Add to the index

## Best Practices

### Do
- Include exact commands (copy-pasteable)
- Document verification steps
- Include rollback procedures
- Keep runbooks up to date
- Test runbooks periodically

### Don't
- Include credentials in runbooks
- Skip verification steps
- Assume prior knowledge
- Leave outdated runbooks

## Emergency Contacts

<!-- CUSTOMIZE: Add your escalation contacts -->

| Role | Contact |
|------|---------|
| On-Call Engineer | @oncall |
| Team Lead | @lead |
| Security | @security |
