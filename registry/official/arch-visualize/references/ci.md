# Checking the architecture in a pull request

An example workflow, for a team that commits `docs/architecture.json` next to the code. On every pull request it:

1. checks that the model is valid (`model-check.mjs`);
2. writes the possible risks as SARIF and uploads them to code scanning (`risk-check.mjs --format sarif`);
3. compares the model with the one on the base branch (`diff.mjs`);
4. renders the page with the Changes view open and keeps it as a build artifact (`render.mjs --diff`).

This is documentation. It is not part of this repository's own workflows, and it was not run on a real project while writing this file.

## The workflow

Save it as `.github/workflows/architecture.yml` in your project. The skill folder must be committed in the project (here `.claude/skills/arch-visualize`); change `SKILL` if it lives elsewhere.

```yaml
name: architecture
on:
  pull_request:
    paths: ["docs/architecture.json"]

permissions:
  contents: read
  security-events: write # needed to upload SARIF

env:
  SKILL: .claude/skills/arch-visualize

jobs:
  architecture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4 # TODO(verify) current major version
        with:
          fetch-depth: 0 # the base branch is needed for the comparison
      - uses: actions/setup-node@v4 # TODO(verify) current major version
        with:
          node-version: 20

      - name: Check the model
        run: node $SKILL/scripts/model-check.mjs --model docs/architecture.json

      - name: Write the possible risks as SARIF
        run: node $SKILL/scripts/risk-check.mjs --model docs/architecture.json --root . --format sarif --out architecture.sarif

      - name: Upload to code scanning
        uses: github/codeql-action/upload-sarif@v3 # TODO(verify) current major version and inputs
        with:
          sarif_file: architecture.sarif
          category: architecture

      - name: Compare with the base branch
        id: base
        run: |
          if git cat-file -e "origin/${{ github.base_ref }}:docs/architecture.json" 2>/dev/null; then
            git show "origin/${{ github.base_ref }}:docs/architecture.json" > architecture.base.json
            node $SKILL/scripts/diff.mjs --base architecture.base.json --head docs/architecture.json --out architecture.diff.json
            echo "has_base=true" >> "$GITHUB_OUTPUT"
          else
            echo "The base branch has no docs/architecture.json yet, so there is nothing to compare."
          fi

      - name: Render the page
        run: |
          if [ "${{ steps.base.outputs.has_base }}" = "true" ]; then
            node $SKILL/scripts/render.mjs --model docs/architecture.json --diff architecture.diff.json --out architecture.html --force
          else
            node $SKILL/scripts/render.mjs --model docs/architecture.json --out architecture.html --force
          fi

      - uses: actions/upload-artifact@v4 # TODO(verify) current major version
        with:
          name: architecture
          path: |
            architecture.html
            architecture.diff.json
            architecture.sarif
```

## Things to know

- **Nothing here changes your model.** `--format sarif` leaves `docs/architecture.json` alone, and `diff.mjs` and `render.mjs` only write the files named in `--out`.
- **A change is not a failure.** `diff.mjs` exits 0 whenever it ran, even when the architecture changed. It exits 2 only when it could not run (a missing file or an invalid model), which fails the step. If you want a pull request to fail on something, decide that in your own step, for example by reading `architecture.diff.json`.
- **Possible risks, not verdicts.** The SARIF results say "Possible risk to check". Treat them as a list to read in code scanning, and tune the workflow so it does not block merges on them unless your team decided that.
- **Pull requests from forks** get a read-only token, so the upload step may be refused. The artifact still works. Remove the upload step, or run it only for branches in the same repository.
- **A base without a model** is handled above: the page is rendered without the Changes view.
- **No network is used by the scripts.** The workflow itself downloads actions and uploads results; the skill's scripts never fetch anything.
- **Model changes only.** The workflow runs when `docs/architecture.json` changes. If the code changes and the model is not updated, nothing runs: ask the agent to regenerate the model as part of the change.

## To check before relying on it

`TODO(verify)`: the action names, their current major versions and the inputs of the SARIF upload step were written from memory and not checked against the current documentation of the hosting service. Look them up before you copy the file.
