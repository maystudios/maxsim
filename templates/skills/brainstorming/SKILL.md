---
name: brainstorming
description: Explores multiple implementation approaches before committing to one. Produces a structured comparison table with effort/risk assessment. Use when starting features, facing design decisions, or multiple valid approaches exist.
---

# Brainstorming

The first idea is rarely the best idea. Explore the space before committing to a direction.

## Process

### 1. Understand the Goal

Define the problem clearly before proposing solutions:

- What is the goal? What does success look like?
- What are the constraints (performance, compatibility, timeline)?
- What has been tried or considered already?
- What are the non-negotiables vs. nice-to-haves?

Ask one question at a time. Each answer informs the next question. Do not front-load a list of questions.

### 2. Research Context

Before proposing solutions, gather evidence:

- Read relevant code and check for prior decisions in the codebase.
- Identify patterns already in use — prefer consistency over novelty.
- Check for existing architectural decisions that constrain the options.

### 3. Generate 3+ Approaches

Present at least three distinct approaches. For each:

| Aspect | Content |
|--------|---------|
| **Summary** | One sentence |
| **How it works** | 3–5 implementation bullets |
| **Pros** | Concrete advantages ("200 fewer lines" beats "simpler") |
| **Cons** | Honest drawbacks — do not hide weaknesses |
| **Effort** | Low / Medium / High |
| **Risk** | What could go wrong and how recoverable it is |

If one approach is clearly superior, say so — but still present the alternatives so the reasoning can be validated.

### 4. Compare — Produce the Summary Table

Always include a top-level comparison table before the detailed breakdowns:

| # | Approach | Effort | Risk |
|---|----------|--------|------|
| A | [one-line summary] | Low/Med/High | Low/Med/High |
| B | [one-line summary] | Low/Med/High | Low/Med/High |
| C | [one-line summary] | Low/Med/High | Low/Med/High |

### 5. Select with Rationale

State which approach is recommended and why. Reference specific tradeoffs — not just "it's simpler." If no approach fits cleanly, propose a hybrid informed by the analysis.

### 6. Document the Decision

Record:
- Chosen approach and rationale
- Rejected alternatives and reasons for rejection
- Key implementation decisions that follow from the choice
- Known risks and mitigation plan

## Output Format

```markdown
## Problem Statement
[What needs to be decided]

## Approaches

| # | Approach | Effort | Risk |
|---|----------|--------|------|
| A | [summary] | Low/Med/High | Low/Med/High |
| B | [summary] | Low/Med/High | Low/Med/High |
| C | [summary] | Low/Med/High | Low/Med/High |

### Approach A: [name]
[How it works, pros, cons]

### Approach B: [name]
[How it works, pros, cons]

### Approach C: [name]
[How it works, pros, cons]

## Selected: [letter]
**Rationale:** [why this approach was chosen]
**Rejected:** [why alternatives were not chosen]
**Risks:** [known risks and mitigation]
```

## Explicit Approval Required

The user must explicitly approve one approach before any implementation begins. Vague responses like "Sounds good" or "Interesting" are not approval. If ambiguous, ask: "To confirm — should I proceed with [specific approach]?"

## Common Pitfalls

| Pitfall | Reality |
|---------|---------|
| "I already know the best approach" | You know your preferred approach. Alternatives may be better. |
| "There's only one way to do this" | There is almost never only one way. |
| "Brainstorming slows us down" | Building the wrong thing is slower. 30 minutes of design saves days of rework. |
| "The user will just pick the first one" | Present the best option last — anchoring on the first wastes the analysis. |

Stop immediately if you catch yourself writing code before presenting approaches, presenting only one option, asking multiple questions at once, or assuming approval without explicit confirmation.
