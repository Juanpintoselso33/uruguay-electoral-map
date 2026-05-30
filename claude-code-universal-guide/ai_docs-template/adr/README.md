# Architecture Decision Records (ADRs)

## Overview

This directory contains Architecture Decision Records documenting significant technical decisions made in this project.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences.

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](ADR-001-example.md) | Example ADR | Accepted | YYYY-MM-DD |

## Creating a New ADR

1. Copy `TEMPLATE.md` to `ADR-XXX-title.md`
2. Fill in all sections
3. Set status to "Proposed"
4. Get review from team
5. Update status to "Accepted" when approved

## ADR Lifecycle

```
Proposed → Accepted → Deprecated/Superseded
```

**Statuses**:
- **Proposed**: Under discussion
- **Accepted**: Decision made and active
- **Deprecated**: No longer relevant
- **Superseded**: Replaced by another ADR

## When to Write an ADR

Write an ADR when you:
- Choose a framework or library
- Make a significant architectural change
- Decide on a coding pattern or convention
- Choose between multiple valid approaches
- Make a decision that affects multiple teams

## ADR Template

See [TEMPLATE.md](TEMPLATE.md) for the standard format.

## Best Practices

### Do
- Keep ADRs concise (1-2 pages)
- Include context and constraints
- Document alternatives considered
- Link to related ADRs
- Date your decisions

### Don't
- Write ADRs for trivial decisions
- Change accepted ADRs (write a new one)
- Skip the consequences section
- Forget to update the index

## References

- [MADR - Markdown ADR](https://adr.github.io/madr/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
