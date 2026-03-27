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
Follow @.claude/maxsim/workflows/security-audit.md end-to-end.

1. **Reconnaissance:** Scan project structure — tech stack, entry points, data flows, trust boundaries, dependency catalog
2. **STRIDE Threat Modeling:** Evaluate each component against Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege
3. **OWASP Top 10 Check:** Scan for Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Misconfiguration, Vulnerable Components, Auth Failures, Data Integrity, Logging Failures, SSRF
4. **Red-Team Analysis:** Identify high-value targets, map attack paths, assess controls and gaps
5. **Report:** Compile findings with severity ratings, positive findings, dependency audit, prioritized recommendations
6. Post the report as a GitHub Issue labeled `security-audit` with the current date in the title
</process>
