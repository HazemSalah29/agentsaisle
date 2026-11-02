# Agent Aisle: aisle add tour

[l1] This is a tour of Agent Aisle: aisle add, read from its own code.
  beat: hook

[l2] The model finds 5 components.
  beat: step
  fact: f1

[l3] aisle CLI to Registry site: Fetch the registry.
  beat: setup
  fact: f2

[l4] Registry site to aisle CLI: Versions and pinned commits.
  beat: step
  fact: f3

[l5] aisle CLI to GitHub codeload: Download that exact commit.
  beat: step
  fact: f4

[l6] GitHub codeload to aisle CLI: A tarball; nothing is cloned.
  beat: step
  fact: f5

[l7] aisle CLI to Audit engine: Audit the files first.
  beat: step
  fact: f6

[l8] Audit engine to aisle CLI: A grade and findings.
  beat: step
  fact: f7

[l9] aisle CLI to Your project: Move in, update the lockfile.
  beat: step
  fact: f8

[l10] That is what the code says, not live traffic.
  beat: button
