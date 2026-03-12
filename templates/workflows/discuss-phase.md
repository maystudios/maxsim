<sanity_check>
Before executing any step in this workflow, verify:
1. The current directory contains a `.planning/` folder — if not, stop and tell the user to run `/maxsim:init` first.
2. `.planning/ROADMAP.md` exists — if not, stop and tell the user to initialize the project.
</sanity_check>

<purpose>
Extract implementation decisions that downstream agents need. Analyze the phase to identify gray areas, let the user choose what to discuss, then deep-dive each selected area until satisfied.

You are a thinking partner, not an interviewer. The user is the visionary — you are the builder. Your job is to capture decisions that will guide research and planning, not to figure out implementation yourself.
</purpose>

<required_reading>
@~/.claude/maxsim/references/thinking-partner.md
</required_reading>

<tool_mandate>
**CRITICAL — Structured user interaction is MANDATORY.**

Every question directed at the user MUST use a structured tool. NEVER write a question as plain text and wait for the user to respond. This applies to:

- Gray area selection (multiSelect)
- Every deep-dive question within an area
- "More questions or next area?" continuation prompts
- "Ready to create context?" final prompts
- Any clarification or follow-up question
- Existing context handling (update/view/skip)

**Tool selection:** Use `AskUserQuestion` (questions appear in terminal).

**Why:** Plain-text questions create a worse UX — the user has to type free-form answers instead of selecting from well-designed options. Structured choices are the entire point of the discuss workflow.

**The rule is simple:** If you need input from the user → use `AskUserQuestion`. Zero exceptions.
</tool_mandate>

<downstream_awareness>
**CONTEXT.md feeds into:**

1. **researcher** — Reads CONTEXT.md to know WHAT to research
   - "User wants card-based layout" → researcher investigates card component patterns
   - "Infinite scroll decided" → researcher looks into virtualization libraries

2. **planner** — Reads CONTEXT.md to know WHAT decisions are locked
   - "Pull-to-refresh on mobile" → planner includes that in task specs
   - "Claude's Discretion: loading skeleton" → planner can decide approach

**Your job:** Capture decisions clearly enough that downstream agents can act on them without asking the user again.

**Not your job:** Figure out HOW to implement. That's what research and planning do with the decisions you capture.

**Phase-scoped artefakte:** In addition to project-level artefakte (DECISIONS.md, ACCEPTANCE-CRITERIA.md, NO-GOS.md), this workflow creates phase-scoped copies in the phase directory. These contain ONLY the entries from this phase's discussion, giving downstream agents focused context without needing to parse the full project-level files.
</downstream_awareness>

<philosophy>
**User = founder/visionary. Claude = thinking partner and builder.**

The user knows:
- How they imagine it working
- What it should look/feel like
- What's essential vs nice-to-have
- Specific behaviors or references they have in mind

The user doesn't know (and shouldn't be asked):
- Codebase patterns (researcher reads the code)
- Technical risks (researcher identifies these)
- Implementation approach (planner figures this out)
- Success metrics (inferred from the work)

Ask about vision and implementation choices. Capture decisions for downstream agents.

**Thinking-partner behaviors (from thinking-partner.md):**
- **Challenge vague answers** — "Cards" could mean many things. Push for specifics.
- **Surface unstated assumptions** — "You're assuming mobile-first — is that intentional?"
- **Propose alternatives with trade-offs** — Don't just accept first choice. Offer 2-3 options.
- **Make consequences visible** — "Infinite scroll means no shareable page positions."
- **Disagree constructively** — If an approach has risks, name them.
- **Follow the thread** — Build on what they just said. Don't jump topics.

Apply these behaviors within each discussion area. The user should feel like they're thinking through decisions with a collaborator, not answering a survey.
</philosophy>

<scope_guardrail>
**CRITICAL: No scope creep.**

The phase boundary comes from ROADMAP.md and is FIXED. Discussion clarifies HOW to implement what's scoped, never WHETHER to add new capabilities.

**Allowed (clarifying ambiguity):**
- "How should posts be displayed?" (layout, density, info shown)
- "What happens on empty state?" (within the feature)
- "Pull to refresh or manual?" (behavior choice)

**Not allowed (scope creep):**
- "Should we also add comments?" (new capability)
- "What about search/filtering?" (new capability)
- "Maybe include bookmarking?" (new capability)

**The heuristic:** Does this clarify how we implement what's already in the phase, or does it add a new capability that could be its own phase?

**When user suggests scope creep:**
```
"[Feature X] would be a new capability — that's its own phase.
Want me to note it for the roadmap backlog?

For now, let's focus on [phase domain]."
```

Capture the idea in a "Deferred Ideas" section. Don't lose it, don't act on it.
</scope_guardrail>

<gray_area_identification>
Gray areas are **implementation decisions the user cares about** — things that could go multiple ways and would change the result.

**How to identify gray areas:**

1. **Read the phase goal** from ROADMAP.md
2. **Understand the domain** — What kind of thing is being built?
   - Something users SEE → visual presentation, interactions, states matter
   - Something users CALL → interface contracts, responses, errors matter
   - Something users RUN → invocation, output, behavior modes matter
   - Something users READ → structure, tone, depth, flow matter
   - Something being ORGANIZED → criteria, grouping, handling exceptions matter
3. **Generate phase-specific gray areas** — Not generic categories, but concrete decisions for THIS phase

**Don't use generic category labels** (UI, UX, Behavior). Generate specific gray areas:

```
Phase: "User authentication"
→ Session handling, Error responses, Multi-device policy, Recovery flow

Phase: "Organize photo library"
→ Grouping criteria, Duplicate handling, Naming convention, Folder structure

Phase: "CLI for database backups"
→ Output format, Flag design, Progress reporting, Error recovery

Phase: "API documentation"
→ Structure/navigation, Code examples depth, Versioning approach, Interactive elements
```

**The key question:** What decisions would change the outcome that the user should weigh in on?

**Claude handles these (don't ask):**
- Technical implementation details
- Architecture patterns
- Performance optimization
- Scope (roadmap defines this)
</gray_area_identification>

<process>

<step name="initialize" priority="first">
Phase number from argument (required).

```bash
INIT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init phase-op "${PHASE}")
```

Parse JSON for: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`, `plan_count`, `roadmap_exists`, `planning_exists`.

**If `phase_found` is false:**
```
Phase [X] not found in roadmap.

Use /maxsim:progress to see available phases.
```
Exit workflow.

**If `phase_found` is true:** Continue to check_existing.
</step>

<step name="check_existing">
Check if CONTEXT.md already exists using `has_context` from init.

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null
```

**If exists:**
Use AskUserQuestion:
- header: "Context"
- question: "Phase [X] already has context. What do you want to do?"
- options:
  - "Update it" — Review and revise existing context
  - "View it" — Show me what's there
  - "Skip" — Use existing context as-is

If "Update": Load existing, continue to analyze_phase
If "View": Display CONTEXT.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:**

Check `has_plans` and `plan_count` from init. **If `has_plans` is true:**

Use AskUserQuestion:
- header: "Plans exist"
- question: "Phase [X] already has {plan_count} plan(s) created without user context. Your decisions here won't affect existing plans unless you replan."
- options:
  - "Continue and replan after" — Capture context, then run /maxsim:plan {X} to replan
  - "View existing plans" — Show plans before deciding
  - "Cancel" — Skip discuss-phase

If "Continue and replan after": Continue to analyze_phase.
If "View existing plans": Display plan files, then offer "Continue" / "Cancel".
If "Cancel": Exit workflow.

**If `has_plans` is false:** Continue to analyze_phase.
</step>

<step name="analyze_phase">
Analyze the phase to identify gray areas worth discussing.

**Read the phase description from ROADMAP.md and determine:**

1. **Domain boundary** — What capability is this phase delivering? State it clearly.

2. **Gray areas by category** — For each relevant category (UI, UX, Behavior, Empty States, Content), identify 1-2 specific ambiguities that would change implementation.

3. **Skip assessment** — If no meaningful gray areas exist (pure infrastructure, clear-cut implementation), the phase may not need discussion.

**Output your analysis internally, then present to user.**

Example analysis for "Post Feed" phase:
```
Domain: Displaying posts from followed users
Gray areas:
- UI: Layout style (cards vs timeline vs grid)
- UI: Information density (full posts vs previews)
- Behavior: Loading pattern (infinite scroll vs pagination)
- Empty State: What shows when no posts exist
- Content: What metadata displays (time, author, reactions count)
```
</step>

<step name="present_gray_areas">
Present the domain boundary and gray areas to user.

**First, state the boundary:**
```
Phase [X]: [Name]
Domain: [What this phase delivers — from your analysis]

We'll clarify HOW to implement this.
(New capabilities belong in other phases.)
```

**Then use AskUserQuestion (multiSelect: true):**
- header: "Discuss"
- question: "Which areas do you want to discuss for [phase name]?"
- options: Generate 3-4 phase-specific gray areas, each with:
  - "[Specific area]" (label) — concrete, not generic
  - [1-2 questions this covers] (description)
  - **Highlight the recommended choice with brief explanation why**

**Do NOT include a "skip" or "you decide" option.** User ran this command to discuss — give them real choices.

**Examples by domain:**

For "Post Feed" (visual feature):
```
☐ Layout style — Cards vs list vs timeline? Information density?
☐ Loading behavior — Infinite scroll or pagination? Pull to refresh?
☐ Content ordering — Chronological, algorithmic, or user choice?
☐ Post metadata — What info per post? Timestamps, reactions, author?
```

For "Database backup CLI" (command-line tool):
```
☐ Output format — JSON, table, or plain text? Verbosity levels?
☐ Flag design — Short flags, long flags, or both? Required vs optional?
☐ Progress reporting — Silent, progress bar, or verbose logging?
☐ Error recovery — Fail fast, retry, or prompt for action?
```

For "Organize photo library" (organization task):
```
☐ Grouping criteria — By date, location, faces, or events?
☐ Duplicate handling — Keep best, keep all, or prompt each time?
☐ Naming convention — Original names, dates, or descriptive?
☐ Folder structure — Flat, nested by year, or by category?
```

Continue to discuss_areas with selected areas.
</step>

<step name="discuss_areas">
For each selected area, conduct a focused discussion loop.

**Philosophy: 4 questions, then check.**

Ask 4 questions per area before offering to continue or move on. Each answer often reveals the next question.

**For each area:**

1. **Announce the area:**
   ```
   Let's talk about [Area].
   ```

2. **Ask 4 questions using AskUserQuestion:**
   - header: "[Area]" (max 12 chars — abbreviate if needed)
   - question: Specific decision for this area
   - options: 2-3 concrete choices (AskUserQuestion adds "Other" automatically), with the recommended choice highlighted and brief explanation why
   - Include "You decide" as an option when reasonable — captures Claude discretion

3. **After 4 questions, check:**
   - header: "[Area]" (max 12 chars)
   - question: "More questions about [area], or move to next?"
   - options: "More questions" / "Next area"

   If "More questions" → ask 4 more, then check again
   If "Next area" → proceed to next selected area
   If "Other" (free text) → interpret intent: continuation phrases ("chat more", "keep going", "yes", "more") map to "More questions"; advancement phrases ("done", "move on", "next", "skip") map to "Next area". If ambiguous, ask: "Continue with more questions about [area], or move to the next area?"

4. **After all initially-selected areas complete:**
   - Summarize what was captured from the discussion so far
   - AskUserQuestion:
     - header: "Done"
     - question: "We've discussed [list areas]. Which gray areas remain unclear?"
     - options: "Explore more gray areas" / "I'm ready for context"
   - If "Explore more gray areas":
     - Identify 2-4 additional gray areas based on what was learned
     - Return to present_gray_areas logic with these new areas
     - Loop: discuss new areas, then prompt again
   - If "I'm ready for context": Proceed to write_context

**Adaptive probing (thinking-partner mode):**

Within each area, adapt your questioning based on the user's certainty level:
- **User is confident** (picks options quickly) — probe deeper: "You chose X — have you considered how that interacts with Y?"
- **User is uncertain** (picks "Other", hedges) — propose alternatives: "Here are 3 approaches with trade-offs..."
- **User defers** (picks "You decide") — accept but name consequences: "I'll go with X because [reason]. That means Y."

Challenge decisions that may have hidden costs. If the user picks something that conflicts with an earlier decision, surface it: "Earlier you said A, but this implies B. Which takes priority?"

**Question design:**
- Options should be concrete, not abstract ("Cards" not "Option A")
- Each answer should inform the next question
- If user picks "Other", receive their input, reflect it back, confirm

**Scope creep handling:**
If user mentions something outside the phase domain:
```
"[Feature] sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current area]: [return to current question]"
```

Track deferred ideas internally.
</step>

<step name="write_context">
Create CONTEXT.md capturing decisions made.

**Find or create phase directory:**

Use values from init: `phase_dir`, `phase_slug`, `padded_phase`.

If `phase_dir` is null (phase exists in roadmap but no directory):
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**File location:** `${phase_dir}/${padded_phase}-CONTEXT.md`

**Structure the content by what was discussed:**

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary

[Clear statement of what this phase delivers — the scope anchor]

</domain>

<decisions>
## Implementation Decisions

### [Category 1 that was discussed]
- [Decision or preference captured]
- [Another decision if applicable]

### [Category 2 that was discussed]
- [Decision or preference captured]

### Claude's Discretion
[Areas where user said "you decide" — note that Claude has flexibility here]

</decisions>

<specifics>
## Specific Ideas

[Any particular references, examples, or "I want it like X" moments from discussion]

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<deferred>
## Deferred Ideas

[Ideas that came up but belong in other phases. Don't lose them.]

[If none: "None — discussion stayed within phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date]*
```

Write file.

**Generate phase-specific artefakte:**

After writing CONTEXT.md, append phase-specific entries to the project-level artefakte files.

**Append to DECISIONS.md:**

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs artefakte-append .planning/DECISIONS.md
```

Append content:

```markdown

## Phase [X]: [Name]

| # | Decision | Rationale | Alternatives Considered | Status |
|---|----------|-----------|------------------------|--------|
| [next #] | [Decision from discussion] | [Why chosen] | [What else was offered] | Locked |
```

**Append to ACCEPTANCE-CRITERIA.md:**

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs artefakte-append .planning/ACCEPTANCE-CRITERIA.md
```

Append content under "Phase-Level Criteria":

```markdown

### Phase [X]: [Name]

- [ ] [Observable outcome from decisions — e.g., "User sees card-based layout on feed page"]
- [ ] [Observable outcome from decisions — e.g., "Infinite scroll loads next batch on scroll"]
- [ ] [Observable outcome from decisions — e.g., "Empty state shows onboarding prompt"]
```

**Append to NO-GOS.md (if applicable):**

If any "don't do this" or "avoid this approach" decisions were made during discussion:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs artefakte-append .planning/NO-GOS.md
```

Append content:

```markdown

## Phase [X]: [Name]

- [Approach to avoid] -- [why, from discussion]
```

If no no-gos emerged from discussion, skip this append.

**Commit artefakte updates:**

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs(${padded_phase}): update artefakte from phase discussion" --files .planning/DECISIONS.md .planning/ACCEPTANCE-CRITERIA.md .planning/NO-GOS.md
```

**Create phase-scoped artefakte:**

After appending to project-level artefakte, create phase-scoped copies containing ONLY the entries from this phase's discussion. These give downstream agents (researcher, planner, executor) focused phase-specific context without parsing the full project-level files.

For each artefakte type that had entries appended in the previous step:

**Decisions (if phase decisions were captured):**
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs artefakte-write decisions --phase ${phase_num} --content "# Phase ${phase_num}: ${phase_name} — Decisions\n\n| # | Decision | Rationale | Alternatives Considered | Status |\n|---|----------|-----------|------------------------|--------|\n[phase-specific decision entries from the discussion above]"
```

**Acceptance Criteria (if phase criteria were defined):**
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs artefakte-write acceptance-criteria --phase ${phase_num} --content "# Phase ${phase_num}: ${phase_name} — Acceptance Criteria\n\n[phase-specific criteria entries from the discussion above, each as a - [ ] checkbox line]"
```

**No-Gos (if phase no-gos emerged):**
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs artefakte-write no-gos --phase ${phase_num} --content "# Phase ${phase_num}: ${phase_name} — No-Gos\n\n[phase-specific no-go entries from the discussion above, each as a - bullet]"
```

Only create artefakte files for types that actually had entries — skip any type where no relevant decisions/criteria/no-gos emerged.

Include the phase-scoped artefakte files in the same git commit as the project-level artefakte:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs(${padded_phase}): create phase-scoped artefakte from discussion" --files "${phase_dir}/"
```

</step>

<step name="confirm_creation">
Present summary and next steps:

```
Created: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisions Captured

### [Category]
- [Key decision]

### [Category]
- [Key decision]

[If deferred ideas exist:]
## Noted for Later
- [Deferred idea] — future phase

---

## ▶ Next Up

**Phase ${PHASE}: [Name]** — [Goal from ROADMAP.md]

`/maxsim:plan ${PHASE}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/maxsim:plan ${PHASE} --skip-research` — plan without research
- Review/edit CONTEXT.md before continuing

---
```
</step>

<step name="git_commit">
Commit phase context (uses `commit_docs` from init internally):

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs(${padded_phase}): capture phase context" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Confirm: "Committed: docs(${padded_phase}): capture phase context"
</step>

<step name="update_state">
Update STATE.md with session info:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs state record-session \
  --stopped-at "Phase ${PHASE} context gathered" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Commit STATE.md:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs(state): record phase ${PHASE} context session" --files .planning/STATE.md
```
</step>

<step name="auto_advance">
Check for auto-advance trigger:

1. Parse `--auto` flag from $ARGUMENTS
2. Read `workflow.auto_advance` from config:
   ```bash
   AUTO_CFG=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**If `--auto` flag present AND `AUTO_CFG` is not true:** Persist auto-advance to config (handles direct `--auto` usage without new-project):
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs config-set workflow.auto_advance true
```

**If `--auto` flag present OR `AUTO_CFG` is true:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► AUTO-ADVANCING TO PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context captured. Spawning plan...
```

Spawn plan as Task with direct workflow file reference (do NOT use Skill tool — Skills don't resolve inside Task subagents):
```
Task(
  prompt="
    <objective>
    You are the plan orchestrator. Create executable plans for Phase ${PHASE}: ${PHASE_NAME}, then auto-advance to execution.
    </objective>

    <execution_context>
    @~/.claude/maxsim/workflows/plan.md
    @~/.claude/maxsim/references/ui-brand.md
    @~/.claude/maxsim/references/model-profile-resolution.md
    </execution_context>

    <arguments>
    PHASE=${PHASE}
    ARGUMENTS='${PHASE} --auto'
    </arguments>

    <instructions>
    1. Read plan.md from execution_context for your complete workflow
    2. Follow ALL steps: initialize, validate, load context, research, plan, verify, auto-advance
    3. When spawning agents (researcher, planner), use Task with specified subagent_type and model
    4. For step 14 (auto-advance to execute): spawn execute-phase as a Task with DIRECT file reference — tell it to read execute-phase.md. Include @file refs to execute-phase.md, checkpoints.md, tdd.md, model-profile-resolution.md. Pass --no-transition flag so execute-phase returns results instead of chaining further.
    5. Do NOT use the Skill tool or /maxsim: commands. Read workflow .md files directly.
    6. Return: PHASE COMPLETE (full pipeline success), PLANNING COMPLETE (planning done but execute failed/skipped), PLANNING INCONCLUSIVE, or GAPS FOUND
    </instructions>
  ",
  subagent_type="general-purpose",
  description="Plan Phase ${PHASE}"
)
```

**Handle plan return:**
- **PHASE COMPLETE** → Full chain succeeded. Display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAXSIM ► PHASE ${PHASE} COMPLETE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished: discuss → plan → execute

  Next: /maxsim:plan ${NEXT_PHASE} --auto
  <sub>/clear first → fresh context window</sub>
  ```
- **PLANNING COMPLETE** → Planning done, execution didn't complete:
  ```
  Auto-advance partial: Planning complete, execution did not finish.
  Continue: /maxsim:execute ${PHASE}
  ```
- **PLANNING INCONCLUSIVE / CHECKPOINT** → Stop chain:
  ```
  Auto-advance stopped: Planning needs input.
  Continue: /maxsim:plan ${PHASE}
  ```
- **GAPS FOUND** → Stop chain:
  ```
  Auto-advance stopped: Gaps found during execution.
  Continue: /maxsim:plan ${PHASE} --gaps
  ```

**If neither `--auto` nor config enabled:**
Route to `confirm_creation` step (existing behavior — show manual next steps).
</step>

</process>

<success_criteria>
- Phase validated against roadmap
- Gray areas identified through intelligent analysis (not generic questions)
- User selected which areas to discuss
- Each selected area explored until user satisfied
- Scope creep redirected to deferred ideas
- CONTEXT.md captures actual decisions, not vague vision
- Deferred ideas preserved for future phases
- STATE.md updated with session info
- User knows next steps
</success_criteria>
