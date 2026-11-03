# Clips from the Higgsfield connector

For "make it Higgsfield style" or "use Higgsfield": the clips are made by the user's own Higgsfield connector (an MCP server at `https://mcp.higgsfield.ai/mcp`), and this library assembles, voices, captions, renders and checks them. The connector is a paid service that draws credits from the user's Higgsfield balance. Its help centre says generations through the connector always use credits, and the free or unlimited perks of the website do not apply there. So: never promise it is free, and never start a generation without a yes.

## Default use

When the connector's tools are present, use them for the visuals of any video where generated pictures help, even if the user never named Higgsfield: add the shot list to the plan you tell them in step 1, with the credit total (or "unknown, from your balance"), and ask one yes or no for the whole list. This is the only place the connector is used without being asked for, and it is never silent: credits are the user's money. A no (or "no clips") means the normal `$0` route for that video; do not ask again in the same project. If no connector is present, say nothing and do not nag.

## Before anything

1. Look for the connector's tools in this session (tool names containing `higgsfield`). Do not assume names; read them and their parameters from what the connector lists.
2. If there are none: stop and tell the user to add it. In Claude Desktop: Settings, Connectors, add a custom connector with the URL above, and sign in to Higgsfield. In Claude Code: `claude mcp add --transport http higgsfield https://mcp.higgsfield.ai/mcp`, then `/mcp` to sign in. Offer the `$0` route meanwhile: stills and diagram scenes through the normal recipes.
3. Ask the connector for the credit balance if it has a tool for it.

## Steps

1. Plan the shots first: a list of at most 6 clips, each with its prompt, length and aspect (9:16 or 16:9), written to `shots.md`. Original subjects only: no real person's likeness, no known characters, logos or brands in prompts.
2. Quote: ask the connector for the cost of each shot if it can; otherwise say the cost is unknown until it runs. Show the user the shot list and the total (or "unknown, from your balance") and wait for a yes to that list. One generation per shot; no retries without asking, and do not poll a pending job in a loop (a pending status is normal for video).
3. Generate through the connector's own tools. Save each result into the project folder: the user can download from Assets on higgsfield.ai, or you fetch the one https address the connector returned with a single `curl` the user approves. Never fetch any other address.
4. List each file: `node <video-generate>/scripts/adopt.mjs <project> <file> --id shot-1 --tool higgsfield --prompt "..." --credits <as reported>`. It checks the file is a real clip, logs it and marks it AI-generated; the credits are written only as the user or connector reported them.
5. Build `video.json` with a `broll` scene per clip (`video-story` `shots.mjs --build` does it for a shot list), then voice, timing, captions, render and QA as in `references/story.md`.
6. Report: the shots, credits reported, the files, and the reminder that the clips are AI-generated (realistic people or places need the synthetic-content label; `video-core` credits says so).

## Limits

- Look and motion come from the connector's models; this library does not change them. Say so when the user asks for a specific look.
- Clips are 4 to 15 seconds in practice: write narration to the clip lengths, not the other way round.
- Keep the connector's account details out of the project: no tokens, no cookies, nothing from the sign-in.
