<purpose>
Verify MaxsimCLI installation and GitHub connectivity. Report the status of each check with actionable fix instructions.
</purpose>

<process>

## Step 1: Check .claude/ directory structure

Verify the required files exist:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs validate-structure
```

Expected checks:
- `.claude/` directory exists
- `.claude/maxsim/` directory exists
- `.claude/maxsim/bin/maxsim-tools.cjs` exists
- `.claude/maxsim/config.json` exists (or create with defaults)

Record PASS/FAIL for each.

---

## Step 2: Check gh CLI

```bash
gh --version
```

If not found: FAIL — "gh CLI not installed. Install from: https://cli.github.com"

```bash
gh auth status
```

If not authenticated: FAIL — "Not authenticated. Run: gh auth login"

Record PASS/FAIL.

---

## Step 3: Check GitHub repo

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github status
```

If the command returns an error:
- Check if the current directory is a git repo: `git remote get-url origin`
- If no remote: FAIL — "No GitHub remote found. Add one or run /maxsim:init in a GitHub repo."
- If remote exists but API fails: FAIL — "GitHub API unreachable. Check: gh auth status"

Record PASS/FAIL.

---

## Step 4: Check project board

From the `github status` output, verify a project board is configured.

If no project board: WARN — "No GitHub Project board linked. Run /maxsim:init to configure."

Record PASS/WARN/FAIL.

---

## Step 5: Report results

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► HEALTH CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Check                        | Status | Notes |
|------------------------------|--------|-------|
| .claude/ structure           | PASS   |       |
| maxsim-tools.cjs present     | PASS   |       |
| gh CLI installed             | PASS   | v2.x  |
| gh CLI authenticated         | PASS   | user@github.com |
| GitHub repo accessible       | PASS   | org/repo |
| Project board linked         | PASS   | Project #N |

Overall: HEALTHY / DEGRADED / BROKEN
```

**If any check FAILed**, list fix instructions after the table:

```
## Issues Found

- [Check Name]: [Error message]
  Fix: [exact command or instruction to resolve]
```

**If all checks PASS:**

```
All systems operational. MAXSIM is ready to use.

Run /maxsim:go to resume your project.
```

</process>

<success_criteria>
- [ ] .claude/ directory structure verified
- [ ] gh CLI installation and authentication checked
- [ ] GitHub repo accessibility confirmed
- [ ] Project board existence confirmed
- [ ] Status of each check reported with fix instructions for failures
- [ ] Overall health status (HEALTHY / DEGRADED / BROKEN) displayed
</success_criteria>
