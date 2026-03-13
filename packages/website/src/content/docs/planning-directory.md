---
id: planning-directory
title: Planning Directory
group: Core Concepts
---

Every MaxsimCLI project has a `.planning/` directory at the project root. This directory is the persistent memory of your project. It stores everything from the initial vision through per-task execution summaries.

{% codeblock language="text" %}
.planning/
├── config.json              # model_profile, workflow flags, branching strategy
├── PROJECT.md               # Vision document (always loaded by agents)
├── REQUIREMENTS.md          # v1/v2/out-of-scope requirements with traceability
├── ROADMAP.md               # Phase structure with milestone groupings
├── STATE.md                 # Live memory: decisions, blockers, metrics, progress
├── phases/
│   └── 01-Foundation/
│       ├── 01-CONTEXT.md        # Decisions made in discuss-phase
│       ├── 01-RESEARCH.md       # Phase research findings
│       ├── 01-01-PLAN.md        # First plan (numbered per attempt)
│       ├── 01-01-SUMMARY.md     # Completion record with deviations
│       ├── 01-VERIFICATION.md   # Post-execution verification results
│       └── 01-UAT.md            # User acceptance test transcript
└── todos/
    ├── pending/                 # Active todo items
    └── completed/               # Archived todos
{% /codeblock %}

The `config.json` file controls model selection, workflow agent toggles, and branching strategy. PROJECT.md is loaded into every agent context automatically. It is the one document that every agent reads.

Phase directories are named `NN-Name` (e.g., `01-Foundation`). Files within them use the phase number as prefix. This naming scheme makes the directory scannable and supports the decimal gap-closure phases (01.1, 01.2) that verification creates.

{% callout type="tip" %}
Commit your .planning/ directory to git. It is the institutional memory of your project. SUMMARY.md files, decisions in STATE.md, and RESEARCH.md files are all valuable artifacts that should be versioned alongside your code.
{% /callout %}
