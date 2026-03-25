---
name: maxsim:security
description: Security audit — STRIDE + OWASP Top 10 + red-team analysis (read-only)
argument-hint: "[scope]"
allowed-tools: [Read, Bash, Grep, Glob, Agent, WebSearch, WebFetch]
---

<objective>
Perform a comprehensive read-only security audit of the codebase using three complementary frameworks: STRIDE threat modeling, OWASP Top 10 vulnerability check, and red-team attack surface analysis. Produce a structured security report with findings ranked by severity.
</objective>

<context>
Arguments: $ARGUMENTS

If $ARGUMENTS is provided, treat it as the audit scope (e.g., `src/auth/`, `api endpoints`, `the entire project`). If not provided, audit the entire project.

This is a READ-ONLY command. No code modifications, no commits, no Plan Mode. The allowed tools are restricted to read-only operations.

GitHub is the sole source of truth. The audit report is posted as a GitHub Issue labeled `security-audit`.
</context>

<process>
Invoke the `autoresearch` skill (security workflow) to structure the audit.

**Phase 1 — Reconnaissance**

1. Scan the project structure to understand the tech stack, entry points, and architecture
2. Identify the scope boundary (from $ARGUMENTS or full project)
3. Map data flows: where does user input enter, how does it flow through the system, where does it exit
4. Identify trust boundaries: client/server, internal/external, authenticated/unauthenticated
5. Catalog dependencies and their versions (`package.json`, `go.mod`, `requirements.txt`, etc.)

**Phase 2 — STRIDE Threat Modeling**

For each component in scope, evaluate against STRIDE:

| Threat | Question |
|--------|----------|
| **S**poofing | Can an attacker impersonate a user or component? |
| **T**ampering | Can data be modified in transit or at rest without detection? |
| **R**epudiation | Can actions be performed without audit trail? |
| **I**nformation Disclosure | Can sensitive data leak (logs, errors, responses, source)? |
| **D**enial of Service | Can the system be overwhelmed or made unavailable? |
| **E**levation of Privilege | Can a user gain unauthorized access or permissions? |

**Phase 3 — OWASP Top 10 Check**

Scan the codebase for patterns matching the OWASP Top 10 (2021):

1. **A01 Broken Access Control** — missing auth checks, IDOR, path traversal
2. **A02 Cryptographic Failures** — hardcoded secrets, weak algorithms, plaintext storage
3. **A03 Injection** — SQL, command, template injection; unsanitized input
4. **A04 Insecure Design** — missing rate limits, no input validation, trust violations
5. **A05 Security Misconfiguration** — default credentials, verbose errors, unnecessary features
6. **A06 Vulnerable Components** — known CVEs in dependencies
7. **A07 Authentication Failures** — weak passwords, missing MFA, session issues
8. **A08 Data Integrity Failures** — unsigned updates, deserialization, CI/CD pipeline gaps
9. **A09 Logging Failures** — missing audit logs, sensitive data in logs
10. **A10 SSRF** — unvalidated URLs, internal network access

**Phase 4 — Red-Team Analysis**

Think like an attacker:

1. Identify the highest-value targets (credentials, PII, admin access, payment data)
2. Map realistic attack paths from public entry points to high-value targets
3. Assess each path: what controls exist, what gaps remain
4. Check for common red-team findings: exposed debug endpoints, information leakage in error messages, insecure defaults, privilege escalation chains

**Phase 5 — Report**

Generate a structured security report:

1. **Executive Summary** — overall risk posture (Critical / High / Medium / Low)
2. **Findings Table** — each finding with:
   - Severity (Critical / High / Medium / Low / Info)
   - Category (STRIDE letter / OWASP number / Red-team)
   - Location (file path and line number)
   - Description (what the vulnerability is)
   - Impact (what an attacker could achieve)
   - Recommendation (how to fix it)
3. **Positive Findings** — security controls that are correctly implemented
4. **Dependency Audit** — known CVEs in dependencies (if any)
5. **Recommendations** — prioritized list of remediations

Post the report as a GitHub Issue labeled `security-audit` with the current date in the title.
</process>
