[l1] Your API just got hit with ten thousand requests in one second.
  beat: hook
[l2] Without a limiter, it falls over.
  beat: stakes
[l3] There are three classic ways to stop that.
  beat: setup
[l4] Token bucket. Fixed window. Sliding window.
  beat: list
[l5] The token bucket is the favourite. Every request spends one token.
  beat: mechanism
[l6] Tokens refill at a steady rate. Run out, and you get a four twenty nine.
  beat: mechanism
[l7] Same burst of traffic, two limiters. The bucket soaks up the spike. The fixed window lets it through in chunks.
  beat: proof
[l8] So, bursty traffic? Use a token bucket.
  beat: takeaway
[l9] Follow for part two, where we build it in Redis.
  beat: cta
