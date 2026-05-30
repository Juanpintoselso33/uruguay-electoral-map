# Architecture Documentation

## Overview

This directory contains canonical documentation for your infrastructure and system architecture.

## Directory Contents

| File | Purpose |
|------|---------|
| `README.md` | This file - entry point |
| `RESOURCE_INVENTORY.md` | Complete infrastructure inventory |
| `data-flow.md` | Data flow diagrams |
| `security.md` | Security architecture |

## Quick Reference

### Infrastructure Overview

<!-- CUSTOMIZE: Add your infrastructure diagram -->

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   API       │────▶│  Database   │
│  (Browser)  │     │  (Server)   │     │ (PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │   Cache     │
                    │   (Redis)   │
                    └─────────────┘
```

### Key Resources

<!-- CUSTOMIZE: List your key infrastructure resources -->

| Resource | Type | Environment |
|----------|------|-------------|
| API Server | EC2 / ECS / Lambda | Production |
| Database | RDS PostgreSQL | Production |
| Cache | ElastiCache Redis | Production |
| Storage | S3 | Production |

## Resource Inventory

See `RESOURCE_INVENTORY.md` for complete list of:
- Compute resources (servers, containers, functions)
- Storage resources (databases, file storage)
- Networking (VPCs, load balancers)
- Security (IAM roles, security groups)

## Maintenance

This documentation should be updated:
- After every infrastructure deployment
- When new resources are added
- When resources are decommissioned
- After architecture changes

## Related Documentation

- `ai_docs/schema/` - Database schema
- `ai_docs/adr/` - Architecture Decision Records
- `ai_docs/runbooks/` - Operational procedures
