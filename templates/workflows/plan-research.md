<purpose>
Research stage sub-workflow for /maxsim:plan. Spawns 5-10 parallel researcher agents (using
Agent tool with run_in_background=true) to investigate different aspects of the phase in
parallel, aggregates their findings, and posts the consolidated research to GitHub as a comment
with <!-- maxsim:type=research -->.

This file is loaded by the plan.md orchestrator. It does NOT handle gate confirmations or
stage routing -- the orchestrator handles that. This sub-workflow focuses ONLY on running
research and posting the output to GitHub.

GitHub Issues is the sole source of truth. No local RESEARCH.md file is written.
</purpose>

<critical_rules>
- Tool name is `Agent` (NOT `Task`)
- Agent spawning: Agent(prompt, subagent_type, model, isolation, run_in_background)
- Parallel agents use run_in_background=true, then collect results
- Research is posted to GitHub with <!-- maxsim:type=research -->
- Use `node .claude/maxsim/bin/maxsim-tools.cjs` for all CLI operations
- No local RESEARCH.md file is written -- GitHub is the sole source of truth
- Do NOT show gate confirmation or next steps -- the orchestrator handles those
</critical_rules>

<process>

## Step 1: Check Prerequisites

The orchestrator provides phase context. Verify we have what we need:

- `phase_number`, `phase_name`, `phase_dir`, `padded_phase`, `phase_slug`
- `researcher_model`, `research_enabled`
- `has_research` (whether a research comment already exists on the phase issue)
- `phase_req_ids` (requirement IDs that this phase must address)
- `phase_issue_number` (GitHub Issue number for the phase)
- `--force-research` flag presence

## Step 2: Resolve Researcher Model

```bash
RESEARCHER_MODEL=$(node .claude/maxsim/bin/maxsim-tools.cjs resolve-model researcher --raw)
```

## Step 3: Check Existing Research

Determine whether a research comment already exists on the phase GitHub Issue by checking
for a comment containing `<!-- maxsim:type=research -->`. This is reflected in the
`has_research` flag passed from the orchestrator.

**If `has_research` is true AND `--force-research` is NOT set:**

Research already exists as a GitHub comment on Issue #{phase_issue_number}. Display:
```
Using existing research from GitHub Issue #{phase_issue_number}.
```

Return control to orchestrator -- no need to re-research.

**If `has_research` is true AND `--force-research` IS set:**

Continue to Step 4 (re-research will post a new research comment, replacing the old one).

**If `has_research` is false:**

Continue to Step 4.

**If `research_enabled` is false AND `--force-research` is NOT set:**

Research is disabled in config. Display:
```
Research disabled in config (workflow.research = false).
Skipping research stage.
```

Return control to orchestrator.

## Step 4: Read Phase Context from GitHub

Fetch the phase issue with all comments to extract context for research scoping:

```bash
ISSUE_DATA=$(node .claude/maxsim/bin/maxsim-tools.cjs github get-issue \
  --issue-number $PHASE_ISSUE_NUMBER --include-comments)
```

Extract from the response:
- Phase goal and description from the issue body
- Context comment content (from the `<!-- maxsim:type=context -->` comment, if present)

The context comment determines WHAT to research: user decisions lock certain approaches,
guiding researchers away from alternatives.

## Step 5: Define Research Domains

Based on the phase description and context decisions, identify 5-10 distinct research domains.
Each domain should be independently investigatable by a separate agent.

**Research domain categories (select those relevant to this phase):**

1. **Existing code patterns** -- How is similar functionality implemented in the codebase?
   File structure, naming conventions, module patterns used.
2. **Dependencies & libraries** -- What packages/APIs are already available? Which to use?
3. **API contracts** -- External service interfaces, response shapes, error codes.
4. **Test patterns** -- How are tests written for this type of code? Coverage expectations.
5. **Data models** -- Existing schema, types, validation patterns relevant to the phase.
6. **Integration points** -- Where does this phase connect to existing systems?
7. **Security & validation** -- Input validation patterns, auth flows, edge cases.
8. **Performance considerations** -- Known bottlenecks, caching patterns, query patterns.
9. **Configuration & environment** -- Config file patterns, env vars, feature flags.
10. **Error handling** -- How errors surface, logging patterns, user-facing error formats.

Select 5-10 domains most relevant to this phase. Define a focused research question for each.

## Step 6: Spawn Parallel Research Agents

Display:
```
Researching Phase {phase_number}: {phase_name}...
Spawning {N} parallel research agents...
```

Spawn each researcher as a background Agent. All agents run in parallel:

```
Agent(
  prompt="<objective>
Research Domain: {domain_name}
Phase: {phase_number} -- {phase_name}

Research Question: {focused question for this domain}

<context>
Phase Goal: {phase_goal}
User Decisions (from context comment): {key decisions that constrain this domain}
Phase Requirements: {phase_req_ids}
</context>

<instructions>
Investigate this specific domain. Use Read, Grep, Glob to explore the codebase.
Use WebFetch for external documentation if needed.

Focus on: what the planner needs to know to create correct tasks for this domain.
Answer the research question with evidence from the codebase or official sources.

<output_format>
Return findings as structured markdown:

## {Domain Name}

**Research Question:** {question}
**Confidence:** HIGH | MEDIUM | LOW

### Findings
{evidence-backed findings}

### Recommended Approach
{what the planner should do, based on findings}

### Pitfalls
{known risks or gotchas to avoid}

### Open Questions
{anything that needs user decision or remains uncertain}
</output_format>
</instructions>",
  subagent_type="researcher",
  model="{researcher_model}",
  isolation="worktree",
  run_in_background=true
)
```

Spawn all research agents in parallel using `run_in_background=true`. Do not await any
individual agent before spawning the next.

## Step 7: Collect and Aggregate Findings

After all background agents complete, collect their results.

For each agent result:
- Extract the domain findings markdown
- Note the confidence level (HIGH/MEDIUM/LOW)
- Note any open questions flagged by the agent

**Aggregate into a consolidated research document:**

```markdown
<!-- maxsim:type=research -->
# Phase {X} Research: {Name}

**Phase Goal:** {goal}
**Researched:** {date}
**Domains investigated:** {N}
**Overall confidence:** {HIGH if all HIGH, MEDIUM if mixed, LOW if any LOW}

## Summary

{3-5 bullet executive summary of the most important findings}

---

{Insert each domain findings section in order of relevance}

---

## Synthesis: Key Decisions for Planner

{Cross-cutting decisions the planner should make, derived from aggregate findings}

| Decision | Recommended | Rationale |
|----------|-------------|-----------|
| {decision area} | {what to do} | {why, from evidence} |

## Open Questions

{Unresolved questions that require user input or further investigation}

---
*Research created: {date}*
*Agents: {N} researchers across {N} domains*
```

## Step 8: Post Research to GitHub

Post the consolidated research as a comment on the phase GitHub Issue:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
{consolidated_research_document}
BODY_EOF
node .claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type research
```

Research findings are posted as a GitHub comment on phase issue #{phase_issue_number}.
No local RESEARCH.md file is written.

Display confirmation:
```
Research complete. Findings from {N} agents posted to GitHub Issue #{phase_issue_number}.
```

## Step 9: Handle Agent Failures

If any research agent fails or returns no findings:

- Log which domain failed: "Agent for '{domain}' returned no findings."
- Continue with findings from the agents that did succeed.
- Note the failed domain in the research document under "Incomplete Research".
- Do NOT block progress on a single failed agent -- partial research is better than none.

If more than half the agents fail:
```
Research partially failed. Only {N}/{total} agents returned findings.

1. Retry failed agents
2. Proceed with partial research
3. Skip research and proceed to planning
```

Wait for user choice.

## Step 10: Return to Orchestrator

After research is posted to GitHub (or research is skipped), return control to the plan.md
orchestrator. Do NOT show gate confirmation or next steps -- the orchestrator handles the gate
between Research and Planning.

</process>

<success_criteria>
- [ ] Researcher model resolved from config
- [ ] Existing research detected from GitHub Issue comment (<!-- maxsim:type=research --> marker) and reused unless --force-research
- [ ] Phase context read from GitHub Issue (context comment + issue body)
- [ ] 5-10 research domains defined based on phase characteristics
- [ ] All research agents spawned in parallel using run_in_background=true
- [ ] Agent tool used (not Task) for all agent spawning
- [ ] Each agent investigates a distinct, focused domain
- [ ] Agent failures handled gracefully -- partial research does not block progress
- [ ] Findings aggregated into consolidated research document
- [ ] Research document posted as GitHub comment with <!-- maxsim:type=research --> marker
- [ ] No local RESEARCH.md file written
- [ ] Control returned to orchestrator without showing gate or next steps
</success_criteria>
