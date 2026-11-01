# What-if: if this goes down

`scripts/simulate.mjs` and the **Failure** view of the page answer one question from the model alone: if these components were down, what else would fail, what would only slow down, and which request flows would break. The answer is a **what-if from the model**, never a prediction about production. It is only as good as the connections, `sync` flags, `optional` marks and evidence in the model.

```
node <skill>/scripts/simulate.mjs --model docs/architecture.json --down redis
node <skill>/scripts/simulate.mjs --model docs/architecture.json --down redis,db --json
```

## The rules

1. A component named in `--down` is **failed**.
2. For each connection that points at a failed component, look at the caller:
   - a synchronous connection (anything not marked `sync: false`): the caller **fails** too, and the same rules apply to its callers;
   - a connection marked `optional: true` (the caller has a fallback, with evidence): the caller is **degraded** and the spread stops there;
   - an asynchronous connection (`sync: false`): the caller is **degraded**, because its work is delayed and the queue builds up. It does not fail.
3. Only failed components spread further. A failure can travel all the way round a cycle, and the search still ends.
4. A flow is **broken** at the first step that touches a failed component, **degraded** if it only touches degraded ones, otherwise **ok**. Steps marked `together` count as part of the step before them.

Each affected component keeps the link that explains it: the connection, the component it calls, and the first evidence `file:line` of that connection ("Shop API fails: it calls Session cache with no fallback, `orders.ts:41`").

## Reading the output

The text lists the failed and degraded components, the reasons, and the flows that break, in at most 40 lines. `--json` prints the whole result on one line for the agent to quote. Unknown ids are ignored and named; if none is a component the script exits 2.

## In the page

Open the Failure view, select a component and press **Simulate down**. Failed components are outlined in red with the word "failed" (colour is never the only sign), degraded ones are dashed and say "degraded", the rest fade. The panel lists the reasons and the broken flows and the result is announced to screen readers. The address keeps it (`#lens=failure&down=redis`). A risk card has a **What if it goes down?** button that opens the same view for the first component the risk names.
