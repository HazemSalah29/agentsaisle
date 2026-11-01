# The rate-limit simulation

The scene and `simulate.mjs` run the same code. A request arrives, the algorithm says allowed or rejected (a 429), and the meter shows what the algorithm holds right after. The same seed always gives the same video.

## Algorithms and what they hold

| Algorithm        | Parameters                 | The meter shows                                                                                         |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `token-bucket`   | `capacity`, `refillPerSec` | Tokens left. Starts full; a request takes one; tokens refill steadily. Allows a burst up to `capacity`. |
| `leaky-bucket`   | `capacity`, `leakPerSec`   | Bucket level. Starts empty; a request adds one; the level drains steadily. Rejects when full.           |
| `fixed-window`   | `limit`, `windowSec`       | Requests counted in this window. Resets at each window edge.                                            |
| `sliding-window` | `limit`, `windowSec`       | Requests in the last window. Each leaves exactly `windowSec` after it was allowed.                      |

## Arrival patterns

- `steady`: evenly spaced, `ratePerSec`.
- `poisson`: random but seeded, about `ratePerSec` on average. Looks like real traffic.
- `burst`: `burstSize` requests at once every `burstEverySec`. Best for showing a token bucket absorb a burst while a leaky bucket does not.

## Choosing numbers that make the point

- Keep the average arrival rate above the limit rate so rejections happen; otherwise the viewer sees nothing rejected.
- 40 to 120 requests reads well; the scene draws at most 600 (one dot each).
- To compare two algorithms, give both the same capacity or limit, and use `burst` or a seed whose first rejection is early. Try 2 or 3 seeds with `simulate.mjs` and keep the one that shows the difference honestly; say in `facts.md` which seed and why.
- The footer of the scene says how much real time is shown in how many seconds. Do not narrate it as real time.

## Honesty

Quote only numbers `simulate.mjs` printed. Say "in this simulation". Do not claim that one algorithm is better in general from one seed; say what it did on this traffic. A fixed window can let through twice its limit across a window edge, and `burst` shows it; a sliding window does not.
