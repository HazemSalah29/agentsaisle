# Facts

- [f1] The model lists 5 components and 4 connections. Source: docs/architecture.json (nodes, edges)
- [f2] aisle CLI to Registry site: Fetch the registry is in the code. Source: packages/cli/src/registry.ts:56
- [f3] Registry site to aisle CLI: Versions and pinned commits is in the code. Source: packages/cli/src/registry.ts:56
- [f4] aisle CLI to GitHub codeload: Download that exact commit is in the code. Source: packages/cli/src/github.ts:82
- [f5] GitHub codeload to aisle CLI: A tarball; nothing is cloned is in the code. Source: packages/cli/src/github.ts:82
- [f6] aisle CLI to Audit engine: Audit the files first is in the code. Source: packages/cli/src/guard.ts:34
- [f7] Audit engine to aisle CLI: A grade and findings is in the code. Source: packages/cli/src/guard.ts:34
- [f8] aisle CLI to Your project: Move in, update the lockfile is in the code. Source: packages/cli/src/install.ts:141
