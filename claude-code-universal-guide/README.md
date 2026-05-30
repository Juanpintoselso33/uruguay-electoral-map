# Claude Code Universal Setup Guide

> **A comprehensive template to replicate enterprise-grade Claude Code workflows for any repository**

This guide documents patterns, configurations, and best practices extracted from a production monorepo with 79+ Claude Code configuration files, 11 agents, 18 skills, and automated PR review workflows.

---

## What's Included

```
claude-code-universal-guide/
├── README.md                          # This file
├── CLAUDE.md.template                 # Template for your main operating guide
├── .claude-template/                  # Copy to .claude/ in your repo
│   ├── settings.json                  # Global settings
│   ├── settings.local.json.example    # Local permissions (gitignore this)
│   ├── agents/                        # Specialized agent definitions
│   │   ├── architect.md               # System design agent
│   │   ├── db-admin.md                # Database operations agent
│   │   ├── frontend-dev.md            # UI development agent
│   │   └── orchestrator.md            # Multi-agent coordinator
│   ├── commands/                      # Slash commands
│   │   ├── deploy.md                  # /deploy command
│   │   └── plan.md                    # /plan command
│   ├── skills/                        # Reusable capabilities
│   │   ├── git-commit/SKILL.md        # Smart commit workflow
│   │   └── health-check/SKILL.md      # System diagnostics
│   └── shared/                        # Shared constants
│       └── constants.md               # Paths, resources, credentials
├── .github-template/                  # Copy to .github/ in your repo
│   ├── workflows/
│   │   └── claude-pr-review.yml       # Automated PR review
│   ├── claude/
│   │   └── schemas/
│   │       └── claude_pr_review_v1.schema.json
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       └── feature-request.md
├── scripts-template/                  # Copy to scripts/ in your repo
│   └── claude-pr-review.js            # PR review script for GitHub Actions
└── ai_docs-template/                  # Copy to ai_docs/ in your repo
    ├── schema/
    │   ├── 00_START_HERE.md
    │   └── SCHEMA_CATALOG.md          # Database schema template
    ├── architecture/
    │   └── README.md
    ├── adr/
    │   ├── README.md
    │   └── TEMPLATE.md                # ADR template (MADR format)
    ├── runbooks/
    │   └── README.md
    └── validation/
        └── README.md
```

---

## Quick Start (15 minutes)

### Step 1: Copy Templates

```bash
# From your repository root
cp -r path/to/claude-code-universal-guide/.claude-template .claude
cp -r path/to/claude-code-universal-guide/.github-template/* .github/
cp -r path/to/claude-code-universal-guide/scripts-template/* scripts/
cp -r path/to/claude-code-universal-guide/ai_docs-template ai_docs
cp path/to/claude-code-universal-guide/CLAUDE.md.template CLAUDE.md
```

### Step 2: Customize CLAUDE.md

Edit `CLAUDE.md` to include:
- Your project-specific non-negotiables
- Links to your canonical documentation
- Your deployment workflow
- Your tech stack specifics

### Step 3: Configure Settings

```bash
# Rename and edit local settings
mv .claude/settings.local.json.example .claude/settings.local.json
# Add to .gitignore
echo ".claude/settings.local.json" >> .gitignore
```

### Step 4: Set Up GitHub Secrets

For automated PR review, add these secrets to your repository:
- `ANTHROPIC_API_KEY` - Your Anthropic API key

### Step 5: Customize Agents

Edit agents in `.claude/agents/` to match your domain:
- Replace project paths
- Update technology references
- Add domain-specific knowledge

---

## Architecture Overview

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                        CLAUDE.md                             │
│              (Main Operating Guide - Root)                   │
│         Non-negotiables, canonical sources, rules            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│    Agents     │   │     Skills      │   │    Commands     │
│  (Personas)   │   │  (Procedures)   │   │  (Workflows)    │
│               │   │                 │   │                 │
│ - architect   │   │ - git-commit    │   │ - /deploy       │
│ - db-admin    │   │ - health-check  │   │ - /plan         │
│ - frontend    │   │ - deploy        │   │ - /build        │
│ - orchestrator│   │ - pr-review     │   │                 │
└───────────────┘   └─────────────────┘   └─────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │         shared/               │
              │   (Constants & Resources)     │
              │                               │
              │ - constants.md (paths, IDs)   │
              │ - aws-resources.md            │
              │ - neo4j-queries.md            │
              └───────────────────────────────┘
```

### Data Flow

```
User Request
     │
     ▼
┌─────────────┐     ┌──────────────┐
│  CLAUDE.md  │────▶│    Agent     │
│  (context)  │     │  (persona)   │
└─────────────┘     └──────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │    Skill     │
                    │ (procedure)  │
                    └──────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │   Command    │
                    │  (workflow)  │
                    └──────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │   Output     │
                    │  (action)    │
                    └──────────────┘
```

---

## Component Deep Dive

### 1. CLAUDE.md (Operating Guide)

The `CLAUDE.md` file in your repository root is the **primary instruction set** for Claude Code.

**Required Sections**:
- **Non-negotiables**: Rules that must NEVER be violated
- **Canonical Sources**: Links to authoritative documentation
- **Quick Start**: How to run the project locally
- **Schema/Data Rules**: Field naming conventions, table references
- **Deployment Workflow**: Safe deployment procedures

**Example Non-negotiables**:
```markdown
## Non-negotiables

1. **Schema conformance**: All code MUST use exact field names from `ai_docs/schema/CATALOG.md`
2. **No hardcoded secrets**: All credentials from environment variables or secrets manager
3. **Test before deploy**: All deployments require passing tests
4. **Document changes**: Infrastructure changes require doc updates
```

### 2. Agents (Specialized Personas)

Agents are role-based configurations with domain expertise.

**Agent File Structure** (`.claude/agents/agent-name.md`):
```markdown
---
name: agent-name
description: |
  Brief description of the agent's purpose and expertise.

  Examples:
  - "Example task 1"
  - "Example task 2"
model: inherit  # or: sonnet, opus, haiku
color: blue     # optional: visual identifier
---

# Agent Instructions

You are a [role description] with expertise in [domains].

## Core Responsibilities
1. Responsibility 1
2. Responsibility 2

## Workflow
1. Step 1
2. Step 2

## Handoff Contract
### Inputs You Require
- Input 1
- Input 2

### Outputs You Deliver
- Output 1
- Output 2

## Self-Verification Checklist
- [ ] Check 1
- [ ] Check 2
```

### 3. Skills (Reusable Procedures)

Skills are documented procedures with optional executable scripts.

**Skill Directory Structure**:
```
.claude/skills/skill-name/
├── SKILL.md           # Main documentation
├── script.sh          # Optional: executable script
└── README.md          # Optional: additional docs
```

**SKILL.md Structure**:
```markdown
---
name: skill-name
description: Brief description of what this skill does.
---

# Skill Name

## Overview
What this skill does and when to use it.

## Usage
How to invoke and use this skill.

## Examples
Concrete examples with code.

## Troubleshooting
Common issues and fixes.
```

### 4. Commands (Slash Commands)

Commands are user-invocable workflows triggered by `/command-name`.

**Command File Structure** (`.claude/commands/command-name.md`):
```markdown
# Command Name

Brief description of what this command does.

## Usage

```
/command-name [arguments]
```

## What It Does

1. Step 1
2. Step 2
3. Step 3

## Prerequisites

- Prerequisite 1
- Prerequisite 2

## Manual Commands

```bash
# If you need to run manually:
command1
command2
```
```

### 5. Shared Resources

Shared constants and resources used across agents and skills.

**constants.md Example**:
```markdown
# Shared Constants

## Project Paths
- **Base**: `/path/to/project/`
- **Config**: `/path/to/project/config/`

## Infrastructure
- **Database**: `postgres://host:port/db`
- **Cache**: `redis://host:port`

## Credentials Location
- **API Keys**: Environment variables
- **Secrets**: AWS Secrets Manager
```

---

## GitHub Integration

### Automated PR Review

The `claude-pr-review.yml` workflow provides:
- Automatic code review on PR open/update
- On-demand review via `@claude` mention
- JSON schema validation for structured output
- Merge recommendations

**Triggers**:
- `pull_request_target`: opened, synchronize, reopened, ready_for_review
- `issue_comment`: when `@claude` is mentioned
- `workflow_dispatch`: manual trigger with PR number

### PR Template

The PR template enforces:
- Conventional commit format for titles
- Type of change classification
- Testing checklist
- Documentation requirements
- Security considerations

---

## Best Practices

### 1. Keep CLAUDE.md Focused

- Maximum 500-700 lines
- Link to detailed docs, don't duplicate
- Update when patterns change

### 2. Agent Granularity

- One agent per domain/responsibility
- Avoid overlapping capabilities
- Define clear handoff contracts

### 3. Skill Reusability

- Skills should be project-agnostic where possible
- Include bundled scripts for automation
- Document prerequisites clearly

### 4. Evidence-First Operations

- Long-running ops write logs to `ai_docs/validation/*/run_logs/`
- All operations should be resumable
- Document expected vs actual outcomes

### 5. Schema Conformance

- Define canonical field names
- Never allow aliases
- Validate in PR reviews

---

## Customization Guide

### For Web Applications

Add agents:
- `frontend-dev` - React/Vue/Angular components
- `api-dev` - REST/GraphQL endpoints
- `e2e-tester` - Playwright/Cypress testing

Add skills:
- `component-gen` - Generate UI components
- `api-test` - API testing workflows

### For Data Platforms

Add agents:
- `data-engineer` - Pipeline development
- `db-admin` - Database operations
- `analytics` - Query optimization

Add skills:
- `migration` - Schema migrations
- `backfill` - Data backfill procedures

### For Infrastructure

Add agents:
- `infra-dev` - CDK/Terraform/Pulumi
- `sre` - Monitoring, alerting
- `security` - IAM, compliance

Add skills:
- `deploy` - Deployment procedures
- `rollback` - Rollback procedures

---

## Troubleshooting

### Agent Not Found

```
Error: Agent 'agent-name' not found
```

**Fix**: Ensure file exists at `.claude/agents/agent-name.md` with valid YAML frontmatter.

### Skill Not Loading

```
Error: Could not load skill 'skill-name'
```

**Fix**: Check that `SKILL.md` exists in `.claude/skills/skill-name/` directory.

### PR Review Not Triggering

**Fix**:
1. Verify `ANTHROPIC_API_KEY` secret is set
2. Check workflow permissions (contents: read, pull-requests: write)
3. Review workflow logs in Actions tab

### MCP Server Connection Failed

**Fix**:
1. Verify MCP server is running
2. Check `settings.local.json` configuration
3. Restart Claude Code

---

## Migration from Existing Setup

### Step 1: Audit Current Configuration

```bash
# Find existing Claude configs
find . -name "CLAUDE.md" -o -name ".claude" -type d
```

### Step 2: Merge Configurations

- Combine existing CLAUDE.md with template
- Migrate custom agents to new structure
- Update paths in shared/constants.md

### Step 3: Validate

- Test each agent invocation
- Verify skill execution
- Confirm workflow triggers

---

## Resources

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [MADR - Architecture Decision Records](https://adr.github.io/madr/)

---

**Version**: 1.0.0
**Last Updated**: 2026-01-29
**Source**: Extracted from Unify Legal AI Platform (79 files, 11 agents, 18 skills)
