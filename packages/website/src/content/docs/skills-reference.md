---
id: skills-reference
title: Skills Reference
group: Advanced
---

Skills are focused knowledge modules that agents load at dispatch time. Each skill is a markdown file in `.claude/skills/` that provides procedures, conventions, and domain knowledge for a specific area. Skills are not executed directly -- they are included in agent prompts so the agent follows the documented procedures during its work.

### How skills are loaded

When the orchestrator dispatches an agent, it selects which skills to include based on the agent type and the task at hand. The executor agent loads commit-conventions and verification. The planner loads brainstorming and roadmap-writing. The researcher loads the research skill. All agents load the handoff-contract skill for structured communication.

Skills are additive: an agent can load multiple skills, and they do not conflict because each covers a distinct area of expertise.

### Skill reference

#### tdd

Defines the Test-Driven Development workflow: write a failing test first, implement the minimum code to pass, then refactor. The executor follows this cycle for each task when the project uses TDD. The skill includes guidance on test naming, assertion patterns, and when to write unit vs. integration tests.

**Used by:** executor

#### systematic-debugging

Provides the scientific method approach used by `/maxsim:debug`. Defines the six-step cycle: reproduce the symptom, form a hypothesis about the root cause, isolate the affected code, verify the hypothesis with targeted checks, apply the fix, and confirm the fix resolves the symptom. Includes guidance on evidence gathering and hypothesis prioritization.

**Used by:** executor (via debug workflow)

#### brainstorming

Structured ideation procedures for phase planning. Guides the planner through option generation, pros/cons analysis, and decision documentation. Helps surface non-obvious approaches and prevents the planner from anchoring on the first viable solution.

**Used by:** planner

#### roadmap-writing

Procedures for creating clear, actionable roadmaps with phased deliverables. Covers phase sizing (not too large, not too small), dependency ordering, and success criteria definition. Used during project initialization and milestone creation.

**Used by:** planner

#### handoff-contract

Defines the format for agent-to-agent communication. A handoff contract specifies what the sending agent accomplished, what the receiving agent must do next, and any constraints the receiver must respect. This is the core mechanism that prevents context loss between agent sessions.

**Used by:** all agents

#### commit-conventions

Conventional commit formatting rules, scope definitions, and atomic commit practices. Ensures every commit message follows a consistent format (e.g., `feat(auth): add JWT refresh endpoint`) and that each commit is self-contained. Also covers co-author trailers and Issue references.

**Used by:** executor

#### maxsim-batch

Procedures for running batch operations across multiple tasks efficiently. Used when the executor needs to apply the same change across many files or run a series of similar operations. Includes patterns for parallel batch execution and error handling in batch contexts.

**Used by:** executor

#### code-review

Code quality, security, and correctness review procedures. Defines what the verifier looks for during code review: bugs, anti-patterns, missing error handling, security vulnerabilities, performance issues, and deviation from the phase plan. Includes severity classification (blocking vs. advisory).

**Used by:** verifier

#### verification

Verification procedures and quality gate definitions. Covers the evidence block format (CLAIM/EVIDENCE/OUTPUT/VERDICT), gate pass/fail criteria, and the process for aggregating results from parallel reviewer agents. This skill drives the verify-phase workflow.

**Used by:** verifier

#### github-operations

Procedures for using the GitHub CLI (`gh`) and GitHub API effectively. Covers Issue creation, comment posting, Project Board manipulation, Milestone management, and label operations. Ensures agents interact with GitHub consistently and handle API errors gracefully.

**Used by:** all agents

#### research

Systematic research and analysis procedures for codebase investigation. Guides the researcher through file discovery, pattern identification, dependency analysis, and findings synthesis. Includes strategies for handling large codebases (parallel research, sampling, and focus areas).

**Used by:** researcher

#### project-memory

Procedures for reading and writing persistent memory in `.claude/agent-memory/`. Defines when to write memory (notable decisions, discovered patterns, failed approaches), what format to use, and how subsequent agents should read and apply memory entries. Prevents agents from repeating mistakes discovered in previous sessions.

**Used by:** all agents

#### using-maxsim

End-user guide for MaxsimCLI commands. Loaded when the user asks for help or when the orchestrator needs to explain available commands. Contains command syntax, common patterns, and troubleshooting guidance.

**Used by:** orchestrator

#### maxsim-simplify

Procedures for reducing complexity in code and plans. Helps agents identify over-engineering, unnecessary abstractions, and premature optimization. The planner uses it to keep plans focused. The executor uses it to resist adding complexity during implementation.

**Used by:** planner, executor

#### autoresearch

The autonomous investigation engine that powers `/maxsim:improve`, `/maxsim:fix-loop`, `/maxsim:debug-loop`, and `/maxsim:security`. Defines the hypothesis-test-iterate cycle for autonomous work: measure current state, form a hypothesis about what to change, apply the change, measure again, and decide whether to continue or stop. Includes retry budgets and escalation rules.

**Used by:** executor (autonomous commands)

### Creating custom skills

To add a custom skill, create a markdown file in `.claude/skills/your-skill-name/` with a clear purpose statement and step-by-step procedures. The orchestrator can load custom skills by name when dispatching agents. Custom skills are useful for project-specific conventions like a particular testing framework, deployment process, or code style guide.

{% callout type="tip" %}
Skills are the right place to document project conventions that agents should follow. Instead of repeating "always use our custom logger instead of console.log" in every conversation, write a custom skill that documents the convention. Agents will follow it automatically.
{% /callout %}
