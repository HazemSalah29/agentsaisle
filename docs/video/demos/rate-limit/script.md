# How a rate limit really works

[l1] Ten requests got through a limit of five.
  beat: hook
  on-screen: 10 through a limit of 5
  fact: f3

[l2] Most people think a limit just counts requests per minute.
  beat: misconception

[l3] Picture a bucket of tokens. Each request takes one. Tokens drip back steadily.
  beat: analogy

[l4] Here is that bucket, simulated.
  beat: step
  fact: f1

[l5] It holds five tokens and refills three a second.
  beat: step
  fact: f1

[l6] Sixty random requests arrive, about six a second.
  beat: step
  fact: f1

[l7] Twenty-nine get through. Thirty-one are turned away.
  beat: step
  fact: f2

[l8] The bucket itself is only a few lines.
  beat: step
  fact: f5

[l9] But how you count the window matters.
  beat: edge
  fact: f3

[l10] A fixed window resets on the clock.
  beat: edge
  fact: f3

[l11] Five requests just before the reset, five just after.
  beat: edge
  fact: f3

[l12] Two tenths of a second apart, and ten get through. Double the limit.
  beat: edge
  fact: f3

[l13] A sliding window remembers the last second, so only five get through.
  beat: edge
  fact: f4

[l14] Choose the algorithm for the traffic you expect, and test it in a simulation.
  beat: takeaway
