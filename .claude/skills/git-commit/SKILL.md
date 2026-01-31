# Git Commit Skill

## Description
Creates standardized git commits following project conventions for the Uruguay Electoral Map.

## Trigger
```
/commit [--type <type>] [--scope <scope>] [--message <message>]
```

## Input Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| --type | string | No | auto | Commit type (feat, fix, etc.) |
| --scope | string | No | auto | Scope of changes |
| --message | string | No | auto | Commit message |

## Commit Types

| Type | Description | Example |
|------|-------------|---------|
| feat | New feature | Add Canelones department |
| fix | Bug fix | Fix tooltip display on mobile |
| refactor | Code refactoring | Split RegionMap component |
| perf | Performance improvement | Optimize GeoJSON loading |
| docs | Documentation | Update CLAUDE.md |
| style | Code style/formatting | Format with Prettier |
| chore | Maintenance tasks | Update dependencies |
| data | Data file updates | Add electoral data |

## Commit Message Format
```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Examples
```
feat(canelones): add Canelones department data and map

- Added canelones_odn.csv with 312 lists
- Added canelones_odd.csv with 298 lists
- Added optimized canelones_map.json (2.1MB)
- Updated regions.json with map parameters

Closes #15
```

```
refactor(map): split RegionMap into smaller components

- Created ElectoralMap.vue (container)
- Created MapLegend.vue (color scale)
- Created MapTooltip.vue (hover content)
- Created SelectedInfo.vue (selection panel)

BREAKING CHANGE: RegionMap.vue removed, use ElectoralMap.vue
```

## Workflow

### Step 1: Analyze Changes
```javascript
async function analyzeChanges() {
  const status = await git.status();

  const changes = {
    staged: status.staged,
    modified: status.modified,
    untracked: status.not_added,
    deleted: status.deleted
  };

  // Categorize by file type/location
  const categories = categorizeChanges(changes);

  return { changes, categories };
}

function categorizeChanges(changes) {
  const allFiles = [...changes.staged, ...changes.modified];

  return {
    data: allFiles.filter(f => f.match(/public\/.*\.(csv|json)$/)),
    components: allFiles.filter(f => f.match(/src\/components\//)),
    stores: allFiles.filter(f => f.match(/src\/stores\//)),
    config: allFiles.filter(f => f.match(/\.(json|js|ts)$/) && !f.includes('src/')),
    docs: allFiles.filter(f => f.match(/\.(md)$/))
  };
}
```

### Step 2: Determine Commit Type
```javascript
function determineCommitType(categories) {
  // Priority-based type detection
  if (categories.data.length > 0) {
    if (categories.data.some(f => f.includes('_map.json'))) {
      return 'feat'; // New department map
    }
    return 'data';
  }

  if (categories.components.length > 0) {
    const componentContent = readFiles(categories.components);
    if (componentContent.some(c => c.includes('// BREAKING'))) {
      return 'refactor';
    }
    return 'feat';
  }

  if (categories.docs.length > 0 && categories.components.length === 0) {
    return 'docs';
  }

  return 'chore';
}
```

### Step 3: Determine Scope
```javascript
function determineScope(categories) {
  // Check for department-specific changes
  const deptMatch = categories.data
    .map(f => f.match(/public\/([a-z_]+)_(?:odn|odd|map)/))
    .filter(Boolean);

  if (deptMatch.length > 0) {
    return deptMatch[0][1]; // e.g., "canelones"
  }

  // Check for component changes
  if (categories.components.length > 0) {
    if (categories.components.some(f => f.includes('/map/'))) {
      return 'map';
    }
    if (categories.components.some(f => f.includes('/selectors/'))) {
      return 'selectors';
    }
  }

  return null; // No scope
}
```

### Step 4: Generate Message
```javascript
function generateCommitMessage(type, scope, changes) {
  const scopeStr = scope ? `(${scope})` : '';

  // Generate short description based on changes
  let description = '';

  switch (type) {
    case 'feat':
      if (scope && isDepartment(scope)) {
        description = `add ${formatName(scope)} department`;
      } else {
        description = summarizeFeature(changes);
      }
      break;
    case 'refactor':
      description = summarizeRefactoring(changes);
      break;
    case 'data':
      description = `update electoral data for ${scope || 'multiple departments'}`;
      break;
    default:
      description = summarizeChanges(changes);
  }

  return `${type}${scopeStr}: ${description}`;
}
```

### Step 5: Create Commit
```javascript
async function createCommit(message, body = null) {
  // Stage all relevant files
  await git.add('.');

  // Build full commit message
  let fullMessage = message;
  if (body) {
    fullMessage += `\n\n${body}`;
  }

  // Create commit
  await git.commit(fullMessage);

  return git.log({ n: 1 });
}
```

## Output

### Commit Preview
```
Commit Preview
══════════════

Type: feat
Scope: canelones
Message: feat(canelones): add Canelones department

Files to commit:
  A public/canelones_odn.csv
  A public/canelones_odd.csv
  A public/canelones_map.json
  M public/regions.json
  M CLAUDE.md

Proceed with commit? [Y/n]
```

### Commit Result
```
Committed: feat(canelones): add Canelones department

Commit: a1b2c3d4
Author: Developer <dev@example.com>
Date: 2024-01-15 10:30:00

Changed files: 5
Insertions: 15234
Deletions: 2
```

## Special Cases

### Breaking Changes
```javascript
// Detect breaking changes
if (hasBreakingChanges(changes)) {
  message += '\n\nBREAKING CHANGE: ' + describeBreakingChange(changes);
}
```

### Multi-Department Commits
```javascript
// When adding multiple departments
if (departments.length > 1) {
  type = 'feat';
  scope = 'data';
  description = `add ${departments.length} departments: ${departments.join(', ')}`;
}
```

## Integration
- Works with standard git workflow
- Respects .gitignore
- Compatible with pre-commit hooks

## Related Skills
- add-department
- validate-csv
