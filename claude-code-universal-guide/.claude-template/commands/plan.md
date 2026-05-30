# Plan Command

Create an implementation plan for a feature or task.

## Usage

```
/plan [task-description]
```

**Arguments:**
- `task-description`: Brief description of what needs to be planned

## What It Does

1. Analyzes the task requirements
2. Explores relevant codebase areas
3. Identifies affected files and systems
4. Creates a step-by-step implementation plan
5. Saves plan to `ai_docs/plans/`
6. Optionally creates an ADR for significant decisions

## Plan Output Location

Plans are saved to: `ai_docs/plans/YYYY-MM-DD-task-name.md`

## Plan Template

```markdown
# Implementation Plan: [Task Name]

**Date**: YYYY-MM-DD
**Author**: Claude
**Status**: Draft | Approved | In Progress | Complete

## Summary

Brief description of what this plan covers.

## Background

Context and motivation for this task.

## Goals

- [ ] Goal 1
- [ ] Goal 2
- [ ] Goal 3

## Non-Goals

- What this plan explicitly does NOT cover

## Technical Approach

### Phase 1: [Phase Name]

**Files to modify:**
- `path/to/file1.ts` - Description of changes
- `path/to/file2.ts` - Description of changes

**Steps:**
1. Step 1
2. Step 2
3. Step 3

### Phase 2: [Phase Name]

...

## Dependencies

- External services required
- Other features that must be complete first
- Third-party libraries needed

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk 1 | High | Mitigation strategy |
| Risk 2 | Medium | Mitigation strategy |

## Testing Strategy

- Unit tests for ...
- Integration tests for ...
- E2E tests for ...

## Rollout Plan

1. Deploy to staging
2. Verify functionality
3. Deploy to production
4. Monitor for issues

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Open Questions

- Question that needs answering
- Another question

## References

- Link to related docs
- Link to design mockups
- Link to related issues
```

## When to Create a Plan

Use `/plan` when:
- Implementing a new feature
- Making significant architectural changes
- Refactoring complex systems
- Tasks spanning multiple files/systems
- Work that will take more than 1-2 hours

## Plan Approval Process

1. Claude creates initial plan
2. User reviews and provides feedback
3. Plan is updated based on feedback
4. User approves plan
5. Implementation begins

## Integration with ADRs

For significant architectural decisions within a plan, create an ADR:

```markdown
## Architecture Decisions

This plan includes the following ADRs:
- [ADR-XXX: Decision Title](../adr/ADR-XXX.md)
```

## Example Plans

### Feature Plan
```
/plan Add user authentication with OAuth
```

Output: `ai_docs/plans/2024-01-15-user-authentication.md`

### Refactor Plan
```
/plan Migrate from Redux to Zustand
```

Output: `ai_docs/plans/2024-01-15-redux-to-zustand-migration.md`

### Bug Fix Plan
```
/plan Fix race condition in payment processing
```

Output: `ai_docs/plans/2024-01-15-payment-race-condition-fix.md`

## Best Practices

### Do
- Be specific about files to modify
- Include testing strategy
- Consider rollback scenarios
- Identify dependencies early
- Break large tasks into phases

### Don't
- Skip the research phase
- Ignore existing patterns
- Plan too far ahead (2 weeks max)
- Forget about error handling
- Neglect documentation updates

## Workflow Integration

Plans can be linked to:
- GitHub Issues: Reference `Fixes #123`
- Pull Requests: Reference plan in PR description
- ADRs: Link to related architectural decisions
