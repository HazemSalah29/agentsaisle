---
description: Brand interview, then your first reel. Run once after setup, or again to change your brand.
argument-hint: "(no arguments, it asks you)"
---

# /video reel start

A short talk that fills in your page details, then makes your first reel right away as proof.

Every "run `/video reel <name>`" below means: read `<animate-reel>/references/cmd-<name>.md` and follow it.

## 0. Check first

Read `00 - notes/context/declared/brand.md`.

- If `page_name` is empty: a fresh page. Go to step 1.
- If it is filled: ask one question with buttons: "Change my brand" (go to step 1, show the current answers as the picks), "Make a reel" (go to step 4), or "Show me the full tour" (go to step 3).

## 1. Core or full tour

Ask once, with buttons:

1. **Core, about 5 minutes** (recommended): your page details, then your first reel.
2. **Full tour**: the same, plus a walk through your boards, your notes and how Claude learns your taste.

## 2. The brand interview

Ask in small groups with AskUserQuestion: 2 to 4 numbered choices per question, the pick marked, and always room for "let me describe it" in the user's own words. Skip anything already said.

1. **Niche:** Islamic, faceless, business, personal, or other. Write the lowercase word (`islamic`, `faceless`, `business`, `personal`, `other`).
2. **Page name and handle.** Ask in plain words: "What is your page called, and your @handle?"
3. **Voice:** offer three short voices that fit the niche (for example warm and calm, bold and direct, playful and light).
4. **Colours:** offer three pairs (a main colour and an accent) that fit the niche, or "use my own".
5. **Comment word:** the one word you ask people to comment. Offer three that fit the niche.
6. **Hashtags:** suggest a fixed set of 5 to 8 for the niche. The user can edit it.
7. **Content kinds:** the kinds of reels you make. Suggest 3 to 5 for the niche, for example "lessons", "made-up stories", "tips", "myths". Each kind becomes a group on the boards. If the user wants made-up stories, save that kind as `parable` (call it "made-up stories" when you talk to the user). Save every other kind as a short lowercase word.

Then:

- Write the answers into the frontmatter of `00 - notes/context/declared/brand.md` (`page_name`, `handle`, `niche`, `voice`, `colours`, `comment_word`, `hashtags`, `content_kinds` as a list). Leave `voice_id` empty. Replace the body with two or three plain lines about the page.
- If the user said something about what they like or dislike, add it under `## Likes` or `## Dislikes` in `00 - notes/context/observed/taste.md`.
- One line in `log.md`: `YYYY-MM-DD | Brand set up | brand.md`.
- Read the brand back in five short lines and ask "Looks right?" with buttons.

## 3. Full tour only

Short and plain, one part per message, and the user can stop at any time:

1. **Your boards.** Open `01 - dashboards/Home.md` in Obsidian. Name the seven boards in one line each.
2. **Your notes.** Ideas live in `00 - notes/ideas/`, reels in `00 - notes/content/`, finished videos in `03 - export/`, and your posts and numbers in `00 - notes/ledger.md`.
3. **Saving things.** Paste a link or a note and say "save this". Claude files what it learned (`/video reel save`).
4. **Taste.** After each reel Claude asks what worked and keeps one lesson in `taste.md`. After you post, `/video reel review` turns your numbers into lessons.
5. **Your day.** `/video reel today` shows what to make next, what is due and what to review.

## 4. Your first reel

1. Ask with buttons: "Give me 3 ideas" (recommended) or "I have a topic".
2. **3 ideas:** read `<animate-reel>/references/agent-idea-scout.md` and do its job here, for 3 ideas only. **Own topic:** write one idea note for it the same way.
3. The user picks one. Run `/video reel reel` on it.

## 5. After the first reel

Only now, offer two extras, one question with buttons, both optional:

- **Zernio**, to schedule posts and pull your numbers on its own (the first 2 accounts are free). It is a connector the user adds in Claude themselves from zernio.com, then signs in and connects Instagram. Claude installs nothing and never types a key or password. Without Zernio, `/video reel review` reads a screenshot instead.
- **A voiceover voice** (ElevenLabs). Tell the user in plain words:
  1. **Get your key.** Make an account at elevenlabs.io, open your profile, "API Keys", and make a new key. If your page earns money, you need a paid plan: the free plan does not allow that use.
  2. **Set it yourself.** Add `ELEVENLABS_API_KEY` to your own shell profile or system environment, then close and reopen Claude. The key never goes in the chat, and Claude never asks for it, reads it or writes it anywhere. To check it, only test that the variable is set, never show it.
  3. **Pick a voice.** List the user's ElevenLabs voices (the voiceover part of `<animate-reel>/references/sound.md`), describe two or three, and let the user pick. Write its id to `voice_id` in brand.md. From then on, each reel asks "Voiceover, yes or no?"

End with one line: "Run `/video reel today` any day to see what to do next."

## Rules

- Plain, short sentences. Warm. No em dashes. No jargon.
- Never guess the user's page from any file in this folder. Only from what they tell you.
