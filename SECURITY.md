# Security Policy

## Supported Versions

Only the **latest published version** of `maxsimcli` on npm receives security fixes. We do not backport patches to older versions.

| Version | Supported |
|---------|-----------|
| Latest (`npm install maxsimcli@latest`) | ✅ |
| Older versions | ❌ |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.** Public disclosure before a fix is available puts all users at risk.

### Preferred: GitHub Private Security Advisory

Use [GitHub's private vulnerability reporting](https://github.com/maystudios/maxsimcli/security/advisories/new) to submit a report confidentially. This is the fastest path to a fix.

### Alternative: Email

Send a description of the vulnerability to: **security@maystudios.com**

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- Affected versions (if known)
- Any suggested fix (optional but appreciated)

## Response Timeline

| Stage | Target |
|-------|--------|
| Acknowledgment | Within 7 days |
| Status update / triage | Within 14 days |
| Fix release | Depends on severity; critical issues are prioritized |

We follow responsible disclosure: once a fix is released, we'll coordinate with the reporter on public disclosure timing (typically 7–14 days after the fix is published to npm).

## Scope

**In scope:**
- `maxsimcli` CLI package (install, tools router, adapters, hooks)
- Template files that could enable command injection or privilege escalation

**Out of scope:**
- Vulnerabilities in third-party dependencies (please report those upstream)
- Issues in the marketing website (`packages/website`)
- Social engineering attacks
- Denial-of-service attacks on individual machines

## Thank You

We appreciate responsible disclosure and the effort it takes to report security issues properly. Reporters will be credited in the release notes (unless they prefer to remain anonymous).
