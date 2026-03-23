# Debug Subagent Prompt Template

Template for spawning verifier agent in debug mode. The agent contains all debugging expertise - this template provides problem context only.

---

## Template

```markdown
<objective>
Investigate issue: {issue_id}

**Summary:** {issue_summary}
</objective>

<symptoms>
expected: {expected}
actual: {actual}
errors: {errors}
reproduction: {reproduction}
timeline: {timeline}
</symptoms>

<mode>
symptoms_prefilled: {true_or_false}
goal: {find_root_cause_only | find_and_fix}
</mode>

<debug_file>
Document findings in GitHub Issue: #{issue_number} (add comment with debug report)
</debug_file>
```

---

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{issue_id}` | Orchestrator-assigned | `auth-screen-dark` |
| `{issue_number}` | GitHub Issue number | `42` |
| `{issue_summary}` | User description | `Auth screen is too dark` |
| `{expected}` | From symptoms | `See logo clearly` |
| `{actual}` | From symptoms | `Screen is dark` |
| `{errors}` | From symptoms | `None in console` |
| `{reproduction}` | From symptoms | `Open /auth page` |
| `{timeline}` | From symptoms | `After recent deploy` |
| `{goal}` | Orchestrator sets | `find_and_fix` |
| `{slug}` | Generated | `auth-screen-dark` |

---

## Usage

**From /maxsim:debug:**
```python
Agent(
  prompt=filled_template,
  subagent_type="verifier",
  description="Debug {slug}"
)
```

**From diagnose-issues (UAT):**
```python
Agent(prompt=template, subagent_type="verifier", description="Debug UAT-001")
```

---

## Continuation

For checkpoints, spawn fresh agent with:

```markdown
<objective>
Continue debugging {slug}. Evidence is in the GitHub Issue.
</objective>

<prior_state>
GitHub Issue: #{issue_number} — debug findings in issue comments
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
goal: {goal}
</mode>
```
