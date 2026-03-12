# Skill: GitHub Tools Guide

## Trigger
When interacting with GitHub Issues, project boards, or progress tracking in MAXSIM.

## CLI Invocation

All GitHub operations use the MAXSIM CLI tools router:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github <command> [--flag value] [--raw]
```

Add `--raw` to get machine-readable JSON output (no formatting).

## Command Reference

### Setup
| Command | Description |
|---------|-------------|
| `github setup [--milestone-title "T"]` | Set up GitHub integration: board, labels, milestone, templates |

### Phase Lifecycle
| Command | Description |
|---------|-------------|
| `github create-phase --phase-number "01" --phase-name "Name" --goal "Goal" [--requirements "R1,R2"] [--success-criteria "SC1,SC2"]` | Create phase issue + add to board + set "To Do" |
| `github create-task --phase-number "01" --task-id "T1" --title "Title" --body "Body" --parent-issue-number N` | Create task sub-issue |
| `github batch-create-tasks --phase-number "01" --parent-issue-number N --tasks '[{"task_id":"1.1","title":"Title","body":"Body"}, ...]'` | Batch create tasks with rollback |
| `github post-plan-comment --phase-issue-number N --plan-number "01" --plan-content "..." [--plan-content-file F]` | Post plan comment on phase issue |

### Comments
| Command | Description |
|---------|-------------|
| `github post-comment --issue-number N --body "..." [--body-file F] [--type TYPE]` | Post comment (types: research, context, summary, verification, uat, general) |
| `github post-completion --issue-number N --commit-sha "SHA" --files-changed "a.ts,b.ts"` | Post completion comment |

### Issue Operations
| Command | Description |
|---------|-------------|
| `github get-issue --issue-number N [--include-comments]` | Get issue details (with optional comments) |
| `github list-sub-issues --phase-issue-number N` | List sub-issues of a phase issue |
| `github close-issue --issue-number N [--reason "..."] [--state-reason completed\|not_planned]` | Close issue |
| `github reopen-issue --issue-number N` | Reopen closed issue |
| `github bounce-issue --issue-number N --reason "feedback"` | Bounce to In Progress with feedback |
| `github move-issue --issue-number N --status "STATUS"` | Move to board column (To Do, In Progress, In Review, Done) |
| `github detect-external-edits --phase-number "01"` | Check body hash mismatch |

### Board Operations
| Command | Description |
|---------|-------------|
| `github query-board --project-number N [--status "STATUS"] [--phase "01"]` | Query board items |
| `github add-to-board --project-number N --issue-number M` | Add issue to board |
| `github search-issues [--labels "L1,L2"] [--state open\|closed\|all] [--query "text"]` | Search issues |
| `github sync-check` | Verify local mapping matches GitHub state |

### Progress
| Command | Description |
|---------|-------------|
| `github phase-progress --phase-issue-number N` | Phase progress from sub-issues |
| `github all-progress` | All phases progress overview |
| `github detect-interrupted --phase-issue-number N` | Detect interrupted phase |

### Convenience
| Command | Description |
|---------|-------------|
| `github status` | Combined progress + interrupted + board overview |
| `github sync` | Sync check + repair actions |
| `github overview` | Board summary grouped by column |

## Text Arguments

For large text (body, plan-content), write to a tmpfile and use `--*-file`:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'EOF'
Multi-line content here...
EOF
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number 42 --body-file "$TMPFILE" --type summary
```

## Output Format

All commands return JSON when `--raw` is passed:
```json
{"ok": true, "result": "...", "rawValue": {...}}
```

Without `--raw`, returns human-readable formatted output.
