# Storyboard

| scene | kind | narration | visual | seconds | transition | props |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | title | l1 | Big number line, the payoff first | | | `{"text":"10 through a limit of 5","subtitle":"how a rate limit really works"}` |
| s2 | list | l2, l3 | Not a counter: a bucket of tokens | | fade | `{"heading":"Not a counter per minute","items":["A bucket of tokens","Each request takes one","Tokens drip back steadily"]}` |
| s3 | rate-limit | l4, l5, l6, l7 | Token bucket on 60 random requests | | fade | `{}` |
| s4 | code | l8 | The token bucket in a few lines | | fade | `{"language":"js","file":"token bucket, simplified from the simulator","title":"The bucket in code","code":"const allow = (b, now) => {\n  const dt = (now - b.last) / 1000;\n  b.tokens = Math.min(b.capacity, b.tokens + dt * b.refill);\n  b.last = now;\n  if (b.tokens < 1) return false; // 429\n  b.tokens -= 1;\n  return true;\n};"}` |
| s5 | rate-limit | l9, l10, l11, l12, l13 | Fixed against sliding window on the same burst | | fade | `{}` |
| s6 | title | l14 | Takeaway | | fade | `{"text":"Test it, do not guess","subtitle":"run the simulation before you pick"}` |
