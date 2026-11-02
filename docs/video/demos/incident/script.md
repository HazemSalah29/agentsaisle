# A checkout slowdown

[l1] This is the story of A checkout slowdown, from the postmortem.
  beat: hook

[l2] 14:02 UTC. Deploy 2.3 rolled out.
  beat: setup
  fact: f1

[l3] 14:05 UTC. Checkout requests start timing out.
  beat: step
  fact: f2

[l4] 14:09 UTC. Error rate above 5%.
  beat: step
  fact: f3

[l5] 14:17 UTC. On-call starts a rollback.
  beat: step
  fact: f4

[l6] 14:31 UTC. Rollback finished, errors back to normal.
  beat: step
  fact: f5

[l7] It took 4 minutes from the first failure to the alert.
  beat: lesson
  fact: f6

[l8] It took 26 minutes from the first failure to the fix.
  beat: lesson
  fact: f7
