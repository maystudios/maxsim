<purpose>
Discussion stage sub-workflow for /maxsim:plan. Extracts implementation decisions that downstream agents (researcher, planner) need. Analyzes the phase to identify gray areas, lets the user choose what to discuss, then deep-dives each selected area until satisfied.

This file is loaded by the plan.md orchestrator. It does NOT handle gate confirmations or stage routing -- the orchestrator handles that. This sub-workflow focuses ONLY on running the discussion and posting the context decisions to GitHub.

You are a thinking partner, not an interviewer. The user is the visionary -- you are the builder. Your job is to capture decisions that will guide research and planning, not to figure out implementation yourself.
</purpose>

<required_reading>
@~/.claude/maxsim/references/thinking-partner.md
</required_reading>

<downstream_awareness>
**Context decisions (posted to GitHub) feed into:**

1. **researcher** -- Reads context comment to know WHAT to research
   - "User wants card-based layout" -> researcher investigates card component patterns
   - "Infinite scroll decided" -> researcher looks into virtualization libraries

2. **planner** -- Reads context comment to know WHAT decisions are locked
   - "Pull-to-refresh on mobile" -> planner includes that in task specs
   - "Claude's Discretion: loading skeleton" -> planner can decide approach

**Your job:** Capture decisions clearly enough that downstream agents can act on them without asking the user again.

**Not your job:** Figure out HOW to implement. That's what research and planning do with the decisions you capture.
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
- **Challenge vague answers** -- "Cards" could mean many things. Push for specifics.
- **Surface unstated assumptions** -- "You're assuming mobile-first -- is that intentional?"
- **Propose alternatives with trade-offs** -- Don't just accept first choice. Offer 2-3 options.
- **Make consequences visible** -- "Infinite scroll means no shareable page positions."
- **Disagree constructively** -- If an approach has risks, name them.
- **Follow the thread** -- Build on what they just said. Don't jump topics.

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
"[Feature X] would be a new capability -- that's its own phase.
Want me to note it for the roadmap backlog?

For now, let's focus on [phase domain]."
```

Capture the idea in a "Deferred Ideas" section. Don't lose it, don't act on it.
</scope_guardrail>

<gray_area_identification>
Gray areas are **implementation decisions the user cares about** -- things that could go multiple ways and would change the result.

**How to identify gray areas:**

1. **Read the phase goal** from ROADMAP.md
2. **Understand the domain** -- What kind of thing is being built?
   - Something users SEE -> visual presentation, interactions, states matter
   - Something users CALL -> interface contracts, responses, errors matter
   - Something users RUN -> invocation, output, behavior modes matter
   - Something users READ -> structure, tone, depth, flow matter
   - Something being ORGANIZED -> criteria, grouping, handling exceptions matter
3. **Generate phase-specific gray areas** -- Not generic categories, but concrete decisions for THIS phase

**Don't use generic category labels** (UI, UX, Behavior). Generate specific gray areas:

```
Phase: "User authentication"
-> Session handling, Error responses, Multi-device policy, Recovery flow

Phase: "Organize photo library"
-> Grouping criteria, Duplicate handling, Naming convention, Folder structure

Phase: "CLI for database backups"
-> Output format, Flag design, Progress reporting, Error recovery

Phase: "API documentation"
-> Structure/navigation, Code examples depth, Versioning approach, Interactive elements
```

**The key question:** What decisions would change the outcome that the user should weigh in on?

**Claude handles these (don't ask):**
- Technical implementation details
- Architecture patterns
- Performance optimization
- Scope (roadmap defines this)
</gray_area_identification>

<process>

## Step 1: Initialize

Phase number, name, directory, and GitHub issue number come from the orchestrator context.

```bash
INIT=$(node .claude/maxsim/bin/maxsim-tools.cjs init phase-op "${PHASE}")
```

Parse JSON for: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `plan_count`, `roadmap_exists`, `planning_exists`.

Also extract `phase_issue_number` passed from the orchestrator.

**If `phase_found` is false:** Error -- the orchestrator should have caught this, but fail safe.

## Step 2: Check Existing Context

Check if a context comment already exists on the phase GitHub Issue by calling:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github get-issue $PHASE_ISSUE_NUMBER --comments
```

Look for a comment that contains `<!-- maxsim:type=context -->`.

**If a context comment exists:**

Ask the user (via natural conversation):
```
Phase {phase_number} already has context on GitHub Issue #{phase_issue_number}. What would you like to do?
1. Update it -- review and revise existing context
2. View it -- show me what's there
3. Use as-is -- keep existing context and return to orchestrator
```

- If "Update": Load existing context comment content, continue to Step 3.
- If "View": Display context comment contents, then offer update/use-as-is.
- If "Use as-is": Return control to orchestrator.

**If no context comment exists:** Continue to Step 3.

## Step 3: Analyze Phase

Analyze the phase to identify gray areas worth discussing.

**Read the phase description from ROADMAP.md and determine:**

1. **Domain boundary** -- What capability is this phase delivering? State it clearly.

2. **Gray areas by category** -- For each relevant category, identify 1-2 specific ambiguities that would change implementation.

3. **Skip assessment** -- If no meaningful gray areas exist (pure infrastructure, clear-cut implementation), note this but still present options.

**Output your analysis internally, then present to user.**

## Step 4: Present Gray Areas

Present the domain boundary and gray areas to the user.

**State the boundary:**
```
Phase {phase_number}: {name}
Domain: {what this phase delivers -- from your analysis}

We'll clarify HOW to implement this.
(New capabilities belong in other phases.)
```

**Then present gray areas for selection (via natural conversation):**
```
Which areas do you want to discuss for {phase_name}?

1. {Specific area 1} -- {what decisions this covers}
2. {Specific area 2} -- {what decisions this covers}
3. {Specific area 3} -- {what decisions this covers}
4. {Specific area 4} -- {what decisions this covers}

Select by number (e.g., "1, 3" or "all").
```

Generate 3-4 **phase-specific** gray areas, not generic categories. Each should be a concrete decision area.

## Step 5: Discuss Areas

For each selected area, conduct a focused discussion loop.

**Philosophy: 4 questions, then check.**

Ask 4 questions per area before offering to continue or move on. Each answer often reveals the next question.

**For each area:**

1. **Announce the area:**
   ```
   Let's talk about {Area}.
   ```

2. **Ask 4 questions via natural conversation:**
   - Specific decisions for this area
   - Offer 2-3 concrete choices per question
   - Include "You decide" as an option when reasonable -- captures Claude discretion

3. **After 4 questions, check:**
   ```
   More questions about {area}, or move to next?
   ```
   - If "More" -> ask 4 more, then check again
   - If "Next" -> proceed to next selected area

4. **After all initially-selected areas complete:**
   - Summarize what was captured from the discussion so far
   ```
   We've discussed {list areas}. Any remaining gray areas to explore, or ready to create context?

   1. Explore more gray areas
   2. Ready to create context
   ```
   - If "Explore more": Identify 2-4 additional gray areas, present for selection, loop.
   - If "Ready": Proceed to Step 6.

**Adaptive probing (thinking-partner mode):**

Within each area, adapt your questioning based on the user's certainty level:
- **User is confident** (picks options quickly) -- probe deeper: "You chose X -- have you considered how that interacts with Y?"
- **User is uncertain** (hedges) -- propose alternatives: "Here are 3 approaches with trade-offs..."
- **User defers** (picks "You decide") -- accept but name consequences: "I'll go with X because [reason]. That means Y."

Challenge decisions that may have hidden costs. If the user picks something that conflicts with an earlier decision, surface it: "Earlier you said A, but this implies B. Which takes priority?"

**Question design:**
- Options should be concrete, not abstract ("Cards" not "Option A")
- Each answer should inform the next question
- If user gives free text, reflect it back and confirm

**Scope creep handling:**
If user mentions something outside the phase domain:
```
"[Feature] sounds like a new capability -- that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current area]: [return to current question]"
```

Track deferred ideas internally.
</process>

## Step 6: Post Context to GitHub

Build the context content in memory, then post it as a comment on the phase GitHub Issue.

**Structure the content by what was discussed:**

```markdown
<!-- maxsim:type=context -->
# Phase {X} Context: {Name}

**Phase Goal:** {goal from ROADMAP.md}
**Created:** {date}
**Requirements:** {requirement IDs if any}

## 1. {Category 1 that was discussed}

### {Decision Area}
- {Decision or preference captured}
- {Another decision if applicable}

### {Decision Area}
- {Decision or preference captured}

## 2. {Category 2 that was discussed}

### {Decision Area}
- {Decision or preference captured}

## {N}. Claude's Discretion

{Areas where user said "you decide" -- note that Claude has flexibility here}

## Deferred Ideas (Captured for Future Phases)

| Idea | Target |
|------|--------|
| {Deferred idea} | {suggested phase} |

{If none: "None -- discussion stayed within phase scope"}

---
*Context created: {date}*
*Decisions: {N} across {M} areas*
```

Post the comment to GitHub:
```bash
TMPFILE=$(mktemp)
echo "$CONTEXT_CONTENT" > "$TMPFILE"
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type context
```

Context decisions are posted as a GitHub comment on phase issue #{phase_issue_number}. No local CONTEXT.md file is written.

## Step 7: Return to Orchestrator

After posting the context comment to GitHub, return control to the plan.md orchestrator. Do NOT show gate confirmation or next steps -- the orchestrator handles the gate between Discussion and Research.

Display a brief completion message:
```
Discussion complete. Context decisions posted to GitHub Issue #{phase_issue_number}.
```

<success_criteria>
- Phase validated against roadmap
- Gray areas identified through intelligent analysis (not generic questions)
- User selected which areas to discuss
- Each selected area explored until user satisfied
- Scope creep redirected to deferred ideas
- Context comment captures actual decisions (not vague vision) with <!-- maxsim:type=context --> marker
- Context posted to GitHub Issue #{phase_issue_number} as a comment (no local CONTEXT.md written)
- Deferred ideas preserved for future phases
- Control returned to orchestrator without showing gate or next steps
</success_criteria>
