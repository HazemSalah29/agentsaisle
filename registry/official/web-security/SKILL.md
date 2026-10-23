---
name: web-security
description: Apply web security rules while building or changing a Next.js app (input validation, authorization, secrets, headers, redirects, HTML, rate limits, dependencies) and run secret, header and dependency checks. Use when touching forms, server actions, route handlers, auth, data access, environment variables, next.config or dependencies, or when asked for a security review. Do not use for non-web code or for penetration testing a live site.
model: sonnet
effort: high
allowed-tools: Read Grep Glob Edit Write Bash(node *) Bash(git diff *) Bash(npm audit *) Bash(pnpm audit *)
---

# Web security

## Use when
- You add or change forms, Server Actions, Route Handlers, authentication, data access or file uploads.
- You touch environment variables, `next.config`, middleware or dependencies.
- The user asks for a security review of web code.

## Don't use when
- The code is not part of a web application.
- The request is to attack or probe a site you do not own.

## Rules
1. **Validate every input on the server** (zod or similar) and reject unknown fields. Client-side checks are only a convenience.
2. **Authorize in every Server Action and Route Handler.** They are public endpoints. Check who the user is and that they own the thing they are changing, on every call.
3. **Parameterized queries only.** Never build SQL, shell commands or file paths by joining user text. Use the query builder or ORM parameters.
4. **Keep secrets on the server.** Only `NEXT_PUBLIC_` variables reach the browser, so never put a key, token or password in one. Mark server-only modules with `import "server-only"`.
5. **Send security headers:** Content-Security-Policy (no `unsafe-eval`; avoid `unsafe-inline` for scripts), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and frame protection (`frame-ancestors`).
6. **Redirect only to safe targets.** After login or logout, accept relative paths or an allow-list, never a raw URL from the query string.
7. **Never render user HTML as-is.** Avoid `dangerouslySetInnerHTML` with user content; if unavoidable, sanitize on the server with a vetted library.
8. **Rate-limit sign-in, sign-up, password reset and any expensive or abusable endpoint.**
9. **Keep dependencies honest.** Commit the lockfile, add only dependencies you need, and review what a new package does before adding it.
10. **Fail closed.** If a check cannot run or a value is missing, deny the action rather than allow it.

## Steps
1. List what your change exposes: inputs, endpoints, data, headers, dependencies.
2. Apply the rules to each. Fix gaps in the code you are touching; report gaps elsewhere instead of rewriting them.
3. Scan your changes for secrets: `node <this skill's folder>/scripts/secrets-scan.mjs`. It checks added lines and masks any match. Remove the secret, rotate it if it was ever committed, and load it from the environment.
4. If you touched `next.config` or middleware: `node <this skill's folder>/scripts/headers-check.mjs`. Add whatever it reports missing.
5. If dependencies changed: `npm audit --omit=dev --json | node <this skill's folder>/scripts/audit-summary.mjs` (use `pnpm audit --json` for pnpm projects). It prints only high and critical findings.
6. Fix findings, rerun the same check, and say plainly anything you could not fix.

## Budget
- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.
- Never print or quote a secret. Refer to it by file and line.

## Output
- Changed files and, per rule, what you did when it applied.
- The three check results in one line each (or "not applicable").
- Open risks you did not fix, most serious first.

## Done when
- `secrets-scan.mjs` finds nothing in your added lines.
- `headers-check.mjs` passes, or the missing headers are listed with a reason.
- No high or critical production vulnerabilities remain, or each is reported with its fix.
- Every new endpoint validates input and checks authorization.
