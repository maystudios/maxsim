---
name: github-operations
description: Unified GitHub interaction covering artifact types, comment conventions, CLI commands, and issue lifecycle. Use when reading from or writing to GitHub Issues, managing the project board, or posting structured comments.
user-invocable: false
---

## GitHub as Source of Truth

All project state lives on GitHub. No local `.planning/` files. The canonical record for every phase, task, decision, and progress update is an Issue or Issue comment on the configured repository.

## Issue Structure

- Phase issues: `[Phase N] Description` — labeled `type:phase`, added to board
- Task sub-issues: `[Task N.M] Description` — labeled `type:task`, parented to phase issue
- Issue bodies contain HTML comment markers for machine-readable metadata

## Comment Types

Every artifact posted to GitHub must include a type marker as the first line of the comment body.

| Type | Marker | Purpose |
|------|--------|---------|
| plan | `<!-- maxsim:type=plan -->` | Task breakdown posted after planning |
| research | `<!-- maxsim:type=research -->` | Investigation findings |
| context | `<!-- maxsim:type=context -->` | Phase context and decisions |
| progress | `<!-- maxsim:type=progress -->` | Status update during execution |
| verification | `<!-- maxsim:type=verification -->` | Verification results |
| summary | `<!-- maxsim:type=summary -->` | Phase or task completion summary |
| error | `<!-- maxsim:type=error -->` | Error report |
| escalation | `<!-- maxsim:type=escalation -->` | Escalation to user requiring input |
| handoff | `<!-- maxsim:type=handoff -->` | Agent handoff with state transfer |

## CLI Commands Reference

All commands use the MAXSIM tools router:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github <command> [--flag value]
```

Add `--raw` to any command for machine-readable JSON output: `{"ok": true, "result": "...", "rawValue": {...}}`.

### Core Commands

| Command | Purpose |
|---------|---------|
| `status` | Combined progress + interrupted phases + board overview |
| `get-issue --issue-number N` | Get issue details |
| `get-issue --issue-number N --include-comments` | Get issue with all comments |
| `post-comment --issue-number N --body "..."` | Post comment (include type marker in body) |
| `post-comment --issue-number N --body-file F` | Post comment from file (preferred for long content) |
| `move-issue --issue-number N --status "In Progress"` | Move issue to board column |
| `close-issue --issue-number N --state-reason completed` | Close issue as completed |
| `close-issue --issue-number N --state-reason not_planned` | Close issue as cancelled |
| `reopen-issue --issue-number N` | Reopen a closed issue |

### Phase and Task Lifecycle

| Command | Purpose |
|---------|---------|
| `create-phase --phase-number "01" --phase-name "Name" --goal "Goal"` | Create phase issue, add to board, set To Do |
| `create-task --phase-number "01" --task-id "T1" --title "T" --body "B" --parent-issue-number N` | Create task sub-issue |
| `batch-create-tasks --phase-issue N --tasks-json "[{...}]"` | Batch create tasks with rollback on failure |
| `post-plan-comment --phase-issue-number N --plan-content "..."` | Post plan comment on phase issue |
| `list-sub-issues --phase-issue-number N` | List all sub-issues under a phase |
| `bounce-issue --issue-number N --reason "feedback"` | Move back to In Progress with feedback comment |

### Board and Search

| Command | Purpose |
|---------|---------|
| `query-board --project-number N` | Query all board items |
| `query-board --project-number N --status "In Progress"` | Filter board by column |
| `search-issues --labels "type:phase" --state open` | Search issues by label or state |
| `phase-progress --phase-issue-number N` | Phase completion from sub-issue states |
| `all-progress` | All phases progress overview |
| `ensure-labels` | Create any missing standard labels |
| `sync-check` | Verify local mapping matches GitHub state |

### Large Text Arguments

For multi-line content, write to a temp file and use `--body-file`:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'EOF'
<!-- maxsim:type=summary -->
## Summary
Content here...
EOF
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number 42 --body-file "$TMPFILE"
rm "$TMPFILE"
```

## Board Columns

Valid values for `--status`:

```
To Do  →  In Progress  →  In Review  →  Done
```

- Phase issues move through all four columns
- Task sub-issues move: To Do → In Progress → Done (skip In Review unless a PR is involved)
- On review failure: Done → In Progress via `bounce-issue`

## Labels

| Label | Applied To |
|-------|-----------|
| `type:phase` | Phase issues |
| `type:task` | Task sub-issues |
| `type:bug` | Bug reports |
| `type:quick` | Quick tasks |
| `priority:p0` through `priority:p3` | All issues (p0 = critical) |
| `status:blocked` | Blocked issues |
| `status:needs-review` | Awaiting review |
| `maxsim:managed` | All issues created by MAXSIM |

## Write Order

1. Build full comment content in memory before any write
2. POST to GitHub via CLI command
3. If successful, operation complete
4. If failed, abort entirely — no partial state

## Rollback on Batch Failure

When `batch-create-tasks` partially fails:

1. Close partially-created issues with `--state-reason not_planned`
2. Post an `error` comment on the phase issue explaining the failure
3. Report what succeeded and what failed
4. Offer targeted retry for the failed subset

## External Edit Detection

If a body hash mismatch is detected (issue edited outside MAXSIM):

- Warn about the external modification
- Do not auto-incorporate changes
- Await explicit user instruction before proceeding
