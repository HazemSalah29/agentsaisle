# Facts

- [f1] The simulated token bucket holds 5 tokens and refills 3 a second; 60 requests arrive at random (Poisson) at about 6 a second, seed 42. Source: simulate.mjs --seed 42 --count 60 --pattern poisson --rate 6 --algo token-bucket --capacity 5 --refill 3
- [f2] In that simulation 29 requests are allowed and 31 are rejected. Source: simulate.mjs, same command as f1
- [f3] A fixed window of 5 requests a second lets 10 through when 5 arrive at 0.9 s and 5 at 1.1 s, 0.2 s apart. Source: simulate.mjs --seed 1 --count 15 --pattern burst --burst-size 5 --burst-every 0.2 --burst-offset 0.9 --algo fixed-window --limit 5 --window 1
- [f4] The same traffic through a sliding window of 5 a second lets 5 through. Source: simulate.mjs, same arrivals as f3 with --algo sliding-window --limit 5 --window 1
- [f5] The code on screen is the token bucket step of the simulator, simplified. Source: registry/official/video-core/assets/sim/rate-limit.mjs, function decider
