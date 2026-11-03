# Facts

- [f1] The CLI fetches registry.json over HTTPS and keeps it for 10 minutes. Source: packages/cli/src/registry.ts:56 (fetch) and :13 (cache time)
- [f2] A skill version resolves to a commit SHA. Source: packages/cli/src/registry.ts:99 (resolveSkill returns the SHA)
- [f3] The tarball of that exact commit is downloaded from codeload.github.com. Source: packages/cli/src/github.ts:11 (host), :78 (URL with the SHA) and :82 (fetch)
- [f4] Files from the tarball are only written, never executed. Source: packages/cli/src/github.ts:68 (comment on downloadSkill) and CLAUDE.md "Never execute code from downloaded skills"
- [f5] The files are audited before they are installed. Source: packages/cli/src/install.ts:107 (auditGuard) and packages/cli/src/guard.ts:34 (auditSkill)
- [f6] The folder is moved into place and aisle-lock.json is updated. Source: packages/cli/src/install.ts:141 and :142
- [f7] A critical finding blocks the install unless --force is given and the skill name is typed; --yes never counts. Source: packages/cli/src/guard.ts:20
