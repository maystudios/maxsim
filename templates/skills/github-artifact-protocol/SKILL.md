# Skill: GitHub Artifact Protocol

## Trigger
When reading from or writing to GitHub Issues for MAXSIM artifacts.

## Protocol

### Artifact Types and Comment Conventions

All MAXSIM artifacts are stored as GitHub Issue comments with type metadata:

| Artifact | Comment Type | Tool | Format |
|----------|-------------|------|--------|
| Context decisions | `context` | `github post-comment --type context` | `<!-- maxsim:type=context -->` header |
| Research findings | `research` | `github post-comment --type research` | `<!-- maxsim:type=research -->` header |
| Plan content | (plan header) | `github post-plan-comment` | `<!-- maxsim:type=plan -->` header |
| Summary | `summary` | `github post-comment --type summary` | `<!-- maxsim:type=summary -->` header |
| Verification | `verification` | `github post-comment --type verification` | `<!-- maxsim:type=verification -->` header |
| UAT | `uat` | `github post-comment --type uat` | `<!-- maxsim:type=uat -->` header |
| Completion | (structured) | `github post-completion` | Commit SHA + files |

### Issue Lifecycle State Machine

**Phase Issues:**
```
To Do --> In Progress --> In Review --> Done
(created)  (plan done)    (PR created)  (PR merged + verified)
```

**Task Sub-Issues:**
```
To Do --> In Progress --> Done
(created)  (started)      (completed + review passed)
Done --> In Progress (review failed, reopened)
```

### Write Order (WIRE-01)

1. Build content in memory
2. POST to GitHub via CLI command
3. If successful, operation succeeds
4. If failed, operation aborts entirely -- no partial state

### Rollback Pattern (WIRE-07)

On partial failure during batch operations:
1. Close partially-created issues with `state_reason: 'not_planned'`
2. Post `[MAXSIM-ROLLBACK]` comment explaining why
3. Report what succeeded and what failed
4. Offer targeted retry

### External Edit Detection (WIRE-06)

- Body hash (SHA-256) stored in `github-issues.json` mapping after each write
- On read, compare live body hash against stored hash
- If different, warn user about external modification
- Do not auto-incorporate -- user decides

### What Stays Local

- `config.json` -- project settings
- `PROJECT.md` -- project vision
- `REQUIREMENTS.md` -- requirements
- `ROADMAP.md` -- phase structure
- `STATE.md` -- decisions, blockers, metrics
- `github-issues.json` -- mapping cache (rebuildable)
- `codebase/` -- stack, architecture, conventions
