---
name: edit
description: Tighten and clarify writing without changing its meaning or voice. Use when asked to edit, proofread or shorten an article, email, README or other document. Do not use to write new content or to change what an argument says.
model: sonnet
effort: medium
allowed-tools: Read Edit Write
---

# Edit

## Use when
- You are asked to edit, proofread, tighten or shorten existing text.

## Don't use when
- The user wants new content written from scratch.
- The edit would change the author's claims, facts or opinions.

## Steps
1. Read the whole piece first and note its audience and purpose in one line.
2. Fix errors: spelling, grammar, punctuation, inconsistent names and numbers.
3. Cut filler words, repeated points and throat-clearing openings. Prefer the shorter phrase when the meaning is equal.
4. Clarify: replace vague words with specific ones, make a passive sentence active where it reads better, split a sentence that carries two ideas.
5. Keep the author's terms, tone and formatting conventions. Add no claims, facts or opinions that are not in the text.
6. Flag any sentence you could not fix without asking the author.

## Budget
- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.
- Edit in place and show changes the user can accept or reject; never silently rewrite an argument.

## Output
- The edited text, then a short list of the changes that matter and the sentences you flagged.

## Done when
- The meaning is unchanged and the text is shorter or clearer.
- Every flagged sentence is listed for the author.
