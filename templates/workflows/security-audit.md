<!-- GITHUB-ONLY: All state lives on GitHub. No local .planning/ directory. -->
<!-- CONSTRAINT: Use Agent tool (NOT Task). -->

<purpose>
Comprehensive read-only security audit using three complementary frameworks: STRIDE threat modeling, OWASP Top 10 vulnerability check, and red-team attack surface analysis. Produces a structured security report with findings ranked by severity. The report is posted as a GitHub Issue labeled `security-audit`. No code modifications, no commits.
</purpose>

<process>

## Step 1: Determine Audit Scope

Parse `$ARGUMENTS` for the audit scope:

- If provided: use it as the scope boundary (e.g., `src/auth/`, `api endpoints`, `packages/server/`)
- If not provided: audit the entire project

Store as `$AUDIT_SCOPE`.

## Step 2: Reconnaissance

Scan the project structure to build a comprehensive understanding:

### 2a — Tech Stack Identification

```bash
# Identify project type and dependencies
ls package.json go.mod requirements.txt Cargo.toml pom.xml Gemfile 2>/dev/null
```

Read dependency manifests to identify:
- Languages and frameworks in use
- Key dependencies (web frameworks, auth libraries, crypto libraries, ORMs)
- Dependency versions (for CVE checking in Phase 4)

### 2b — Entry Point Mapping

Identify all entry points where external input enters the system:

- HTTP/API endpoints (route definitions, controllers)
- CLI argument parsing
- File upload handlers
- WebSocket handlers
- Message queue consumers
- Cron jobs / scheduled tasks

### 2c — Data Flow Mapping

Trace how user input flows through the system:

- Where does user input enter?
- How is it validated and sanitized?
- Where does it interact with databases, file systems, or external services?
- Where does it exit (responses, logs, files)?

### 2d — Trust Boundary Identification

Map trust boundaries:

- Client/server boundary
- Internal/external service boundary
- Authenticated/unauthenticated boundary
- Admin/regular user boundary
- Network boundaries (public internet, VPC, internal)

### 2e — Dependency Catalog

Catalog all dependencies with their versions for CVE analysis:

```bash
# Example for Node.js projects
npm audit --json 2>/dev/null || true
```

Store findings as `$RECON_RESULTS`.

---

## Step 3: STRIDE Threat Modeling

For each component identified in `$AUDIT_SCOPE`, evaluate against all six STRIDE categories:

### Spoofing

Can an attacker impersonate a user or component?

- Check authentication mechanisms (JWT validation, session management, API key handling)
- Check for missing authentication on sensitive endpoints
- Check for credential storage (hardcoded secrets, plaintext passwords)
- Check for identity verification gaps

### Tampering

Can data be modified in transit or at rest without detection?

- Check for unsigned data transfers (missing HTTPS, unsigned cookies)
- Check for missing integrity checks on file uploads
- Check for unprotected database writes (missing authorization on mutation endpoints)
- Check for CSRF protections on state-changing operations

### Repudiation

Can actions be performed without an audit trail?

- Check for missing audit logging on sensitive operations
- Check for log completeness (are all state changes logged?)
- Check for log integrity (can logs be tampered with?)
- Check for non-repudiation mechanisms on critical actions

### Information Disclosure

Can sensitive data leak through any channel?

- Check error handling (verbose error messages, stack traces in production)
- Check logging (sensitive data in logs: passwords, tokens, PII)
- Check API responses (excessive data exposure, missing field filtering)
- Check source code exposure (`.env` files, config files, debug endpoints)
- Check HTTP headers (missing security headers, version disclosure)

### Denial of Service

Can the system be overwhelmed or made unavailable?

- Check for rate limiting on API endpoints
- Check for resource exhaustion (unbounded queries, file uploads, memory allocation)
- Check for regex denial of service (ReDoS)
- Check for missing timeouts on external calls

### Elevation of Privilege

Can a user gain unauthorized access or permissions?

- Check for IDOR (Insecure Direct Object References)
- Check role-based access control implementation
- Check for path traversal vulnerabilities
- Check for privilege escalation paths (admin endpoints without auth checks)

Store findings as `$STRIDE_FINDINGS`.

---

## Step 4: OWASP Top 10 Check (2021)

Scan the codebase for patterns matching each OWASP Top 10 category:

### A01 — Broken Access Control

- Missing authentication on sensitive endpoints
- IDOR vulnerabilities (user can access other users' data by changing IDs)
- Path traversal (user-controlled file paths without sanitization)
- Missing function-level access control
- CORS misconfiguration

### A02 — Cryptographic Failures

- Hardcoded secrets, API keys, or passwords in source code
- Weak cryptographic algorithms (MD5, SHA1 for security purposes)
- Plaintext storage of sensitive data
- Missing encryption for data in transit or at rest
- Weak random number generation for security-sensitive operations

### A03 — Injection

- SQL injection (string concatenation in queries, missing parameterization)
- Command injection (user input in `exec`, `spawn`, `system` calls)
- Template injection (user input in template rendering)
- NoSQL injection
- LDAP injection
- XSS (reflected, stored, DOM-based)

### A04 — Insecure Design

- Missing rate limits on critical operations
- Missing input validation
- Trust violations (client-side validation only)
- Missing business logic security controls
- Excessive functionality exposure

### A05 — Security Misconfiguration

- Default credentials still active
- Verbose error pages in production
- Unnecessary features enabled (debug endpoints, directory listing)
- Missing security headers
- Overly permissive CORS
- Outdated or unpatched components

### A06 — Vulnerable and Outdated Components

- Known CVEs in dependencies (from `npm audit`, `pip audit`, etc.)
- Outdated dependencies with known vulnerabilities
- Unmaintained dependencies

### A07 — Identification and Authentication Failures

- Weak password policies
- Missing multi-factor authentication on sensitive operations
- Session fixation or session management issues
- Credential stuffing vulnerabilities (missing rate limits on login)
- Insecure password recovery

### A08 — Software and Data Integrity Failures

- Unsigned software updates or downloads
- Insecure deserialization
- CI/CD pipeline integrity gaps
- Missing integrity verification on external data

### A09 — Security Logging and Monitoring Failures

- Missing audit logs for security events
- Sensitive data logged in plaintext
- Missing alerting for suspicious activity
- Insufficient log retention

### A10 — Server-Side Request Forgery (SSRF)

- Unvalidated URLs from user input used in server-side requests
- Missing allowlists for internal network access
- URL parsing bypass opportunities

Store findings as `$OWASP_FINDINGS`.

---

## Step 5: Red-Team Analysis

Think like an attacker and analyze realistic attack paths:

### 5a — High-Value Target Identification

Identify the highest-value targets in the system:

- Credentials and authentication tokens
- Personally identifiable information (PII)
- Admin access and privileged operations
- Payment data or financial records
- API keys and service account credentials
- Source code or intellectual property

### 5b — Attack Path Mapping

Map realistic attack paths from public entry points to high-value targets:

For each path, document:
- Entry point (how the attacker gets in)
- Intermediate steps (what the attacker needs to do)
- Target (what the attacker can access or do)
- Existing controls (what defenses are in place)
- Gaps (what defenses are missing)

### 5c — Common Red-Team Findings

Check specifically for:
- Exposed debug endpoints (`/debug`, `/admin`, `/status`, `/health` with sensitive data)
- Information leakage in error messages (stack traces, internal paths, version numbers)
- Insecure defaults that developers may not have changed
- Privilege escalation chains (combining multiple low-severity issues)
- Timing attacks on authentication
- Race conditions on critical operations

### 5d — Supply Chain Assessment

- Are dependencies pinned to exact versions?
- Is there a lockfile integrity check?
- Are there any typosquatting risks in dependency names?
- Is the CI/CD pipeline protected against injection?

Store findings as `$REDTEAM_FINDINGS`.

---

## Step 6: Compile Report

Aggregate all findings from STRIDE, OWASP, and Red-Team analysis. Assign severity to each finding:

| Severity | Criteria |
|----------|----------|
| **Critical** | Exploitable now, high impact (data breach, RCE, auth bypass) |
| **High** | Exploitable with minimal effort, significant impact |
| **Medium** | Exploitable with some effort, moderate impact |
| **Low** | Unlikely to be exploited or limited impact |
| **Info** | Best practice recommendation, no direct vulnerability |

Deduplicate findings that appear in multiple frameworks (e.g., a SQL injection finding from both OWASP A03 and STRIDE Tampering).

## Step 7: Post Report as GitHub Issue

Create a comprehensive GitHub Issue:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## Security Audit Report — {date}

**Scope:** $AUDIT_SCOPE
**Frameworks:** STRIDE + OWASP Top 10 (2021) + Red-Team Analysis

### Executive Summary

**Overall Risk Posture:** {Critical / High / Medium / Low}

- Critical findings: {count}
- High findings: {count}
- Medium findings: {count}
- Low findings: {count}
- Informational: {count}

{2-3 sentence summary of the most important findings}

---

### Findings

#### Critical

{For each critical finding:}
**[{STRIDE letter / OWASP number / Red-team}] {Title}**
- **Location:** `{file_path}:{line_number}`
- **Description:** {what the vulnerability is}
- **Impact:** {what an attacker could achieve}
- **Recommendation:** {how to fix it}

#### High

{Same format for high findings}

#### Medium

{Same format for medium findings}

#### Low

{Same format for low findings}

#### Informational

{Same format for info findings}

---

### Positive Findings

Security controls that are correctly implemented:
{List of good security practices found in the codebase}

---

### Dependency Audit

{Results from npm audit / pip audit / etc.}
{Known CVEs in dependencies, if any}

---

### Prioritized Recommendations

1. {Most critical fix — what and why}
2. {Second priority — what and why}
3. {Third priority — what and why}
...

---

*This audit was performed by MaxsimCLI security scanner. It is not a substitute for professional penetration testing.*
BODY_EOF
gh issue create \
  --title "Security Audit: {date} — $AUDIT_SCOPE" \
  --label "security-audit" \
  --body-file "$TMPFILE"
```

Parse the response for the issue number. Store as `$ISSUE_NUM`.

## Step 8: Display Summary

Display a summary to the user:

```
## Security Audit Complete

Report: GitHub Issue #$ISSUE_NUM
Scope: $AUDIT_SCOPE

Findings:
  Critical: {count}
  High: {count}
  Medium: {count}
  Low: {count}
  Info: {count}

Top recommendations:
  1. {most critical fix}
  2. {second priority}
  3. {third priority}

Full report: gh issue view $ISSUE_NUM
```

</process>

<success_criteria>
- [ ] Audit scope determined from $ARGUMENTS or defaulted to full project
- [ ] Reconnaissance completed: tech stack, entry points, data flows, trust boundaries, dependencies
- [ ] STRIDE threat modeling applied to all six categories for each component
- [ ] OWASP Top 10 (2021) check completed for all ten categories
- [ ] Red-team analysis completed: high-value targets, attack paths, common findings
- [ ] Each finding assigned a severity level (Critical / High / Medium / Low / Info)
- [ ] Findings deduplicated across frameworks
- [ ] Positive findings (good security practices) documented
- [ ] Dependency audit performed (npm audit / pip audit / equivalent)
- [ ] Prioritized recommendations listed
- [ ] Report posted as GitHub Issue with label `security-audit`
- [ ] No code modifications made (read-only audit)
- [ ] No commits created
- [ ] Summary displayed to user with issue number
</success_criteria>
</output>
