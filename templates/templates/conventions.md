# CONVENTIONS.md Template

Template for the GitHub Wiki conventions page — the coding conventions document that agents follow without asking.

<template>

```markdown
# Conventions

**Generated:** {{date}}
**Source:** {{source}}

## Tech Stack

Locked technology choices. Agents use these to write correct import statements and configurations.

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
<!-- | Runtime | Node.js | 22.x | Server and build tooling | -->
<!-- | Language | TypeScript | 5.x | Type safety across codebase | -->
<!-- | Framework | Next.js | 15.x | Full-stack React framework | -->
<!-- | Database | PostgreSQL | 16.x | Primary relational data store | -->
<!-- | ORM | Drizzle | latest | Type-safe database queries | -->
<!-- | Testing | Vitest | latest | Unit and integration tests | -->

## File Layout

Agents use this to know WHERE to create files and HOW to name them.

| Type | Location | Naming Convention | Example |
|------|----------|-------------------|---------|
<!-- | Pages/Routes | src/app/ | kebab-case dirs | src/app/user-settings/page.tsx | -->
<!-- | Components | src/components/ | PascalCase.tsx | src/components/UserCard.tsx | -->
<!-- | Utilities | src/utils/ | camelCase.ts | src/utils/formatDate.ts | -->
<!-- | API routes | src/app/api/ | route.ts in kebab-case dirs | src/app/api/auth/route.ts | -->
<!-- | Tests | src/__tests__/ or colocated | *.test.ts | src/utils/__tests__/formatDate.test.ts | -->
<!-- | Types | src/types/ | PascalCase.ts | src/types/User.ts | -->
<!-- | Config | project root | lowercase dotfiles | .env.local, tsconfig.json | -->

## Error Handling

Agents use this to write consistent error handling across all tasks.

**Pattern:** {{error_pattern}}
<!-- Options: exceptions / Result types / error codes / error boundaries -->

**Standard flow:**
{{error_flow}}
<!-- Describe how errors propagate through the system. Example:
  1. Database/external errors throw typed exceptions
  2. Service layer catches and wraps in domain errors
  3. API layer catches domain errors and maps to HTTP status codes
  4. Client receives structured { error, message, code } responses
  5. Unexpected errors propagate to global error handler + logging
-->

**What to catch vs let propagate:**
{{catch_vs_propagate}}
<!-- Example:
  - CATCH: Validation errors, auth failures, not-found, rate limits
  - PROPAGATE: Unexpected errors, system failures (let global handler log + alert)
  - NEVER SWALLOW: Errors without logging — always log before handling
-->

## Testing

| Aspect | Standard |
|--------|----------|
| Framework | {{test_framework}} |
| Test location | {{test_location}} |
| Naming convention | {{test_naming}} |
| Coverage target | {{coverage_target}} |
| What to test per task | {{test_scope}} |
<!-- Example values:
  Framework: Vitest
  Test location: Colocated __tests__/ dirs or tests/ at project root
  Naming convention: [module].test.ts for unit, [feature].e2e.ts for e2e
  Coverage target: 80% lines for business logic, no target for UI components
  What to test per task: Every new function gets unit tests. API endpoints get integration tests. UI gets smoke tests only.
-->
```

</template>

<generation_notes>

**Greenfield (new-project init):**
Populate from research agent recommendations + questioning confirmations.
- Tech Stack: from locked decisions in research synthesis
- File Layout: from recommended framework conventions
- Error Handling: from user's stated preference during questioning
- Testing: from user's stated testing strategy during questioning
- Set `{{source}}` to "new-project init"
- Set `{{generated_or_confirmed}}` to "generated"

**Brownfield (init-existing / init-existing scan + user confirmation):**
Populate from codebase scan results (`codebase/CONVENTIONS.md`) + user confirmation of each convention.
- Tech Stack: from detected dependencies in `codebase/STACK.md`
- File Layout: from detected file structure in `codebase/STRUCTURE.md`
- Error Handling: from detected patterns in `codebase/CONVENTIONS.md`
- Testing: from detected test setup in `codebase/STACK.md`
- Present each section to user: "Your codebase uses these patterns. Should new code follow them?"
- Set `{{source}}` to "init-existing scan + user confirmation"
- Set `{{generated_or_confirmed}}` to "confirmed"

**Lifecycle note:**
Generated at init. Update when conventions change. See Phase 3 (Agent Coherence) for lifecycle updates.

</generation_notes>

<guidelines>

**Tech Stack:**
- Only include architecturally significant choices (frameworks, databases, ORMs, runtimes)
- Exclude utility libraries (lodash, uuid, date-fns) unless they represent a project-wide convention
- Version should be specific enough for agents to use (major.minor, not just "latest")
- Purpose column explains WHY this technology was chosen

**File Layout:**
- Cover all file types agents will create: components, pages, utils, tests, types, config
- Use consistent naming conventions (PascalCase, camelCase, kebab-case)
- Include concrete examples — agents learn from examples more than rules
- Match the actual project structure, not an ideal one

**Error Handling:**
- Pick ONE pattern and stick with it — inconsistency is worse than any single approach
- Describe the full flow from error origin to user-facing response
- Be explicit about catch vs propagate — this prevents error swallowing

**Testing:**
- Coverage target should be realistic and specific to code type
- "What to test per task" is the most important row — agents read this before writing tests
- Include the test command if non-obvious

</guidelines>

---
*Conventions {{generated_or_confirmed}}: {{date}}*
