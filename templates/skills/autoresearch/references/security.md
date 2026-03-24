# Security Workflow

Autonomous security auditing that uses the optimization loop to iteratively discover, validate, and report vulnerabilities. Combines STRIDE threat modeling, OWASP Top 10 sweeps, and red-team adversarial analysis.

## Trigger

- User invokes `/maxsim:security`
- User says "security audit", "threat model", "find vulnerabilities", "red-team", "OWASP", "STRIDE"

## Interactive Setup

If invoked without `--diff`, scope, or focus, the agent scans the codebase first, then collects context via a single batched call with 3 questions:

| # | Header | Question |
|---|--------|----------|
| 1 | Scope | "What should I audit?" |
| 2 | Depth | "How thorough?" |
| 3 | Action | "What should I do with confirmed vulnerabilities?" |

## Setup Phase — Threat Model Generation

### Step 1: Codebase Reconnaissance

The agent scans: dependencies (package.json, requirements.txt, go.mod), secrets handling (.env.example, config), infrastructure (Dockerfile, docker-compose), API routes, auth/middleware, database schemas, CI/CD configs.

### Step 2: Asset Identification

| Asset Type | Priority |
|------------|----------|
| Data stores (DB, Redis, cookies) | Critical |
| Authentication (JWT, OAuth, sessions) | Critical |
| API endpoints (REST, GraphQL, webhooks) | High |
| External services (payment, email, CDN) | High |
| User input surfaces (forms, URL params, uploads) | High |
| Configuration (env vars, CORS, feature flags) | Medium |

### Step 3: Trust Boundary Mapping

The agent identifies where trust levels change: browser/server, server/database, public/authenticated routes, user/admin roles, CI/CD/production, container/host.

### Step 4: STRIDE Threat Model

For each asset + trust boundary combination:

| Threat | Question |
|--------|----------|
| **S**poofing | Can an attacker impersonate a user/service? |
| **T**ampering | Can data be modified in transit or at rest? |
| **R**epudiation | Can actions be denied without evidence? |
| **I**nformation Disclosure | Can sensitive data leak? |
| **D**enial of Service | Can the service be disrupted? |
| **E**levation of Privilege | Can a user gain unauthorized access? |

### Step 5: Attack Surface Map

The agent generates an attack surface map showing entry points, data flows, and abuse paths.

### Step 6: Baseline

The agent runs existing security linting (`npm audit`, `eslint-plugin-security`, `bandit`, etc.) and records the count as baseline iteration 0.

## The Security Loop

Each iteration follows the optimization loop pattern adapted for security:

1. **Review:** Read threat model + past findings + results log. Select next untested attack vector by priority: critical STRIDE threats, OWASP categories not covered, high-severity attack paths, dependency vulnerabilities, configuration weaknesses, business logic flaws.
2. **Analyze:** Deep-dive into target code for the selected vector. Trace data flow, identify missing validation or access checks.
3. **Validate:** Construct proof with vulnerable code location (file:line), attack scenario, triggering input, expected vs actual behavior, impact assessment, confidence level (Confirmed/Likely/Possible).
4. **Classify:** Assign severity (Critical/High/Medium/Low/Info) + OWASP category + STRIDE category.
5. **Log:** Append to security-audit-results.tsv.
6. **Repeat.**

Every 5 iterations, print coverage summary showing STRIDE and OWASP coverage.

## OWASP Top 10 Checks

| ID | Category | Key Checks |
|----|----------|-----------|
| A01 | Broken Access Control | IDOR, missing auth middleware, privilege escalation, CORS |
| A02 | Cryptographic Failures | Plaintext secrets, weak hashing, hardcoded keys |
| A03 | Injection | SQL/NoSQL, command injection, XSS, template injection |
| A04 | Insecure Design | Missing rate limiting, no account lockout, race conditions, CSRF |
| A05 | Security Misconfiguration | Debug mode, default credentials, verbose errors, missing headers |
| A06 | Vulnerable Components | Known CVEs, outdated frameworks, unmaintained deps |
| A07 | Auth Failures | Weak passwords, no MFA, JWT vulnerabilities, session fixation |
| A08 | Data Integrity Failures | Missing CI/CD integrity checks, insecure deserialization |
| A09 | Logging Failures | Missing audit logs, sensitive data in logs, log injection |
| A10 | SSRF | Unvalidated URLs, DNS rebinding, missing allowlists |

## Red-Team Adversarial Lenses

| Persona | Mindset | Focus |
|---------|---------|-------|
| Security Adversary | "I am a hacker breaching this system" | Auth bypass, injection, data exposure |
| Supply Chain Attacker | "I am compromising dependencies or build pipeline" | Dependency CVEs, CI/CD weaknesses |
| Insider Threat | "I am a malicious employee" | Privilege escalation, data exfiltration |
| Infrastructure Attacker | "I am attacking the deployment" | Container escape, exposed services, env secrets |

## Composite Metric

```
metric = (owasp_categories_tested / 10) * 50
       + (stride_categories_tested / 6) * 30
       + min(finding_count, 20)
```

Direction: higher is better. Maximum: 100.

## Flags

| Flag | Purpose |
|------|---------|
| `--diff` | Delta mode — only audit files changed since last audit |
| `--fix` | After audit, auto-fix confirmed Critical/High findings |
| `--fail-on <severity>` | Exit non-zero if findings meet threshold (for CI gating) |

### Delta Mode (`--diff`)

The agent finds the latest previous audit, parses its findings, runs `git diff` to find changed files, and scopes the current audit to only those files. Findings are marked as New, Fixed, or Recurring.

### Auto-Fix (`--fix`)

After the audit, the agent filters for Confirmed Critical/High findings and switches to the fix loop targeting those issues. Safety rules: never fix Low/Info automatically, never modify test files, max 3 attempts per finding.

### Severity Gate (`--fail-on`)

After generating the report, the agent checks findings against the threshold. If met, it exits non-zero for CI pipeline blocking.

## Anti-Patterns

- Do not report theoretical risks without code evidence.
- Do not skip categories — aim for 100% OWASP + STRIDE coverage.
- Do not test against live production — analyze code statically.
- Do not report the same finding twice.
- Do not prioritize quantity over quality — 5 confirmed critical findings outweigh 50 theoretical lows.

## Output

Creates `security/{YYMMDD}-{HHMM}-{slug}/` with: `overview.md`, `threat-model.md`, `attack-surface-map.md`, `findings.md`, `owasp-coverage.md`, `dependency-audit.md`, `recommendations.md`, `security-audit-results.tsv`.
