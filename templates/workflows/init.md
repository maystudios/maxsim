<purpose>
Unified initialization router. Detects current project and repo state, then delegates to the appropriate sub-workflow. This file is a thin router — all heavy logic lives in the sub-workflows.

Routes:
- Already initialized -> show status, offer reinit
- GitHub repo exists with code -> .claude/maxsim/workflows/init-existing.md
- New or empty repo -> .claude/maxsim/workflows/new-project.md
</purpose>

<process>

## Step 1: Check Already Initialized

```bash
INITIALIZED=$(test -f .claude/maxsim/config.json && echo "true" || echo "false")
```

If `INITIALIZED` is `true`, display current status and ask:

```
## MAXSIM Already Initialized

This project is already set up. Run /maxsim:go to continue where you left off.

Would you like to reinitialize? This will overwrite your existing config.
```

Use AskUserQuestion:
- header: "Reinitialize?"
- question: "This project is already initialized. Reinitialize from scratch?"
- options:
  - "Yes, reinitialize" — overwrite existing config
  - "No, continue with /maxsim:go" — exit router

If "No": Print "Run `/maxsim:go` to continue." and exit.
If "Yes": Continue to Step 2 (proceed as if not initialized).

## Step 2: Check GitHub Repo

```bash
gh repo view --json name,url,isEmpty 2>/dev/null || echo "NO_REPO"
```

Parse the result:

- If command fails or returns `NO_REPO`: `REPO_EXISTS=false`
- If JSON returned: `REPO_EXISTS=true`, parse `isEmpty` field

## Step 3: Check for Existing Code

```bash
HAS_CODE=$(test -n "$(ls -A . 2>/dev/null | grep -v '^\.git$' | head -1)" && echo "true" || echo "false")
```

## Step 4: Route to Sub-workflow

Use the results from Steps 2–3 to determine the route:

| REPO_EXISTS | isEmpty / HAS_CODE | Route |
|-------------|-------------------|-------|
| false | — | new-project |
| true | isEmpty=true and HAS_CODE=false | new-project |
| true | has code | init-existing |

### Route A: New Project

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► INITIALIZING NEW PROJECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Delegate to .claude/maxsim/workflows/new-project.md. Execute that workflow end-to-end. Pass through all $ARGUMENTS.

After completion:

```
Project initialized. Run /maxsim:go to start working.
```

### Route B: Existing Project

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► INITIALIZING EXISTING PROJECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Delegate to .claude/maxsim/workflows/init-existing.md. Execute that workflow end-to-end. Pass through all $ARGUMENTS.

After completion:

```
Project initialized. Run /maxsim:go to start working.
```

</process>

<constraints>
- This workflow is a ROUTER only — no initialization logic lives here
- Tool name is Agent (NOT Task)
- No SlashCommand tool
- GitHub Issues is the SOLE source of truth
- No local .planning/ directory references
- Use `node .claude/maxsim/bin/maxsim-tools.cjs` for CLI operations
- Do not inline or duplicate logic from new-project.md or init-existing.md
</constraints>
