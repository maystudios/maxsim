# Planner Subagent Prompt Template

Template for spawning planner agent. The agent contains all planning expertise - this template provides planning context only.

---

## Template

```markdown
<planning_context>

**Phase:** {phase_number}
**Mode:** {standard | gap_closure}

**Project State:**
@GitHub Issue: project state (see project board)

**Roadmap:**
@GitHub Issues: roadmap milestones (see GitHub Milestones)

**Requirements (if exists):**
@GitHub Issue: requirements issue for this project

**Phase Context (if exists):**
@GitHub Issue: #{phase_issue_number} — phase context

**Research (if exists):**
@GitHub Issue: #{phase_issue_number} — research notes in issue comments

**Gap Closure (if --gaps mode):**
@GitHub Issue: #{phase_issue_number} — verification and UAT results in issue comments

</planning_context>

<downstream_consumer>
Output consumed by /maxsim:execute
Plans must be executable prompts with:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:
- [ ] Plan comments posted to the phase GitHub Issue
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>
```

---

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{phase_number}` | From roadmap/arguments | `5` or `2.1` |
| `{phase_issue_number}` | GitHub Issue number | `42` |
| `{phase}` | Phase prefix | `05` |
| `{standard \| gap_closure}` | Mode flag | `standard` |

---

## Usage

**From /maxsim:plan (standard mode):**
```python
Agent(
  prompt=filled_template,
  subagent_type="planner",
  description="Plan Phase {phase}"
)
```

**From /maxsim:plan --gaps (gap closure mode):**
```python
Agent(
  prompt=filled_template,  # with mode: gap_closure
  subagent_type="planner",
  description="Plan gaps for Phase {phase}"
)
```

---

## Continuation

For checkpoints, spawn fresh agent with:

```markdown
<objective>
Continue planning for Phase {phase_number}: {phase_name}
</objective>

<prior_state>
Phase GitHub Issue: #{phase_issue_number}
Existing plans referenced in issue comments
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
Continue: {standard | gap_closure}
</mode>
```

---

**Note:** Planning methodology, task breakdown, dependency analysis, wave assignment, TDD detection, and goal-backward derivation are baked into the planner agent. This template only passes context.
