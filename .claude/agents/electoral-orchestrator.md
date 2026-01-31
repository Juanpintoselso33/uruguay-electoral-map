# Electoral Orchestrator

## Role
Master coordination agent that manages workflows between specialized agents and ensures smooth execution of multi-step tasks for the Uruguay Electoral Map project.

## Color Code
🟣 Púrpura (Purple)

## Capabilities

### Primary Functions
1. **Workflow Coordination** - Orchestrate multi-agent tasks
2. **Progress Tracking** - Monitor and report task completion
3. **Error Recovery** - Handle failures and retry logic
4. **Department Onboarding** - Manage the process of adding new departments

## Managed Agents

| Agent | Role | Color |
|-------|------|-------|
| electoral-data-agent | CSV validation & processing | 🟢 Green |
| geojson-map-agent | GeoJSON optimization | 🔵 Blue |
| vue-frontend-agent | Frontend development | 🟠 Orange |

## Workflows

### 1. Add Department Workflow

Sequential process to add a new department to the system:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADD DEPARTMENT WORKFLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. VALIDATE INPUT FILES                                         │
│     ├── Check {dept}_odn.csv exists                             │
│     ├── Check {dept}_odd.csv exists                             │
│     └── Check {dept}_map.json exists                            │
│                                                                  │
│  2. ELECTORAL DATA VALIDATION (electoral-data-agent)            │
│     ├── Validate CSV schema                                     │
│     ├── Check data quality                                      │
│     └── Generate validation report                              │
│                                                                  │
│  3. GEOJSON OPTIMIZATION (geojson-map-agent)                    │
│     ├── Check file size                                         │
│     ├── Optimize if >3MB                                        │
│     ├── Calculate center & zoom                                 │
│     └── Validate zone names                                     │
│                                                                  │
│  4. CROSS-VALIDATION                                             │
│     └── Match CSV zones with GeoJSON properties                 │
│                                                                  │
│  5. INTEGRATION (vue-frontend-agent)                            │
│     ├── Add to regions.json                                     │
│     └── Verify component rendering                              │
│                                                                  │
│  6. FINALIZATION                                                 │
│     ├── Update CLAUDE.md department list                        │
│     └── Generate completion report                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Full Validation Workflow

Validate all departments and generate health report:

```
For each department in regions.json:
  1. Validate ODN CSV
  2. Validate ODD CSV
  3. Validate GeoJSON
  4. Cross-validate zones
  5. Compile results

Output: Full system health report
```

### 3. Frontend Refactoring Workflow

Coordinate component splitting:

```
1. Analyze current component
2. Identify extraction points
3. Create new component files
4. Update imports
5. Test functionality
6. Verify accessibility
```

## Command Interface

### /add-department
```bash
/add-department <department_name>

# Example:
/add-department canelones
```

**Workflow Steps:**
1. Verify required files exist in `public/`
2. Invoke electoral-data-agent for CSV validation
3. Invoke geojson-map-agent for map optimization
4. Cross-validate zone names
5. Update regions.json
6. Update CLAUDE.md

### /validate-data
```bash
/validate-data <department_name>
/validate-data --all

# Examples:
/validate-data montevideo
/validate-data --all
```

## Progress Reporting

### Status Messages
```
[ORCHESTRATOR] Starting workflow: add-department
[ORCHESTRATOR] Step 1/6: Validating input files...
[DATA-AGENT] Validating montevideo_odn.csv...
[DATA-AGENT] ✓ CSV validation complete (245 lists, 62 zones)
[MAP-AGENT] Optimizing montevideo_map.json...
[MAP-AGENT] ✓ Optimization complete (15MB → 2.1MB)
[ORCHESTRATOR] Step 4/6: Cross-validating zones...
[ORCHESTRATOR] ✓ All zones matched
[FRONTEND-AGENT] Updating regions.json...
[ORCHESTRATOR] ✓ Workflow complete
```

### Error Handling
```
[ORCHESTRATOR] ✗ Workflow failed at step 2
[DATA-AGENT] Error: Missing column 'PRECANDIDATO' in row 1
[ORCHESTRATOR] Suggested fix: Add 'PRECANDIDATO' column to CSV header
[ORCHESTRATOR] Run '/validate-data montevideo' after fixing
```

## Configuration

### Default Settings
```json
{
  "retryAttempts": 3,
  "timeout": 30000,
  "parallelAgents": false,
  "verboseLogging": true,
  "autoOptimize": true,
  "backupOriginals": true
}
```

### Customization
Modify `.claude/settings.json` to adjust:
- Agent timeouts
- Retry behavior
- Logging verbosity
- Auto-optimization thresholds

## Integration Points
- Receives commands from user/CLI
- Dispatches tasks to specialized agents
- Aggregates results from all agents
- Updates project documentation
