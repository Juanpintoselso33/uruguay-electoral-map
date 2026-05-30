# Validation & Evidence

## Overview

This directory stores validation evidence, test results, and operational logs for auditing and debugging.

## Directory Structure

```
validation/
├── README.md           # This file
├── {feature-name}/     # Feature-specific validation
│   ├── run_logs/       # Execution logs
│   ├── evidence/       # Screenshots, outputs
│   └── SUMMARY.md      # Validation summary
└── _archive/           # Archived validations (>30 days)
```

## Validation Report Template

```markdown
# Validation: [Feature/Task Name]

**Date**: YYYY-MM-DD
**Status**: Pass | Fail | Partial
**Author**: [Name]

## Summary
Brief description of what was validated.

## Initial State
- State before changes

## Changes Applied
- Change 1
- Change 2

## Validation Steps
1. Step 1 - Result
2. Step 2 - Result

## Evidence
- [Screenshot 1](evidence/screenshot1.png)
- [Log file](run_logs/execution.log)

## Metrics
| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| Metric 1 | X | Y | Pass/Fail |

## Issues Found
- Issue 1 (resolved)
- Issue 2 (pending)

## Conclusion
Final assessment and next steps.
```

## Guidelines

### Evidence Retention
- Keep active validations in main directory
- Archive after 30 days to `_archive/YYYY-MM/`
- Delete raw logs after 90 days

### Screenshot Discipline
- Max 5 screenshots per validation
- Keep: initial state, key transitions, final state
- Archive or delete extras

### File Size Limits
- Summary files: <200 lines
- Log files: <10MB
- Screenshots: <2MB each

## Best Practices

### Do
- Document initial state before changes
- Include timestamps in logs
- Save error messages and stack traces
- Link to related issues/PRs

### Don't
- Include credentials in logs
- Keep redundant screenshots
- Skip the summary file
- Leave validations incomplete
