# Postmortem: checkout slowdown (FICTIONAL example for the demo)

## Timeline

- 14:02 UTC [action] Deploy 2.3 rolled out | api
- 14:05 UTC [failure] Checkout requests start timing out | checkout
- 14:09 UTC [alert] Error rate above 5% | monitoring
- 14:17 UTC [action] On-call starts a rollback | api
- 14:31 UTC [fix] Rollback finished, errors back to normal | api

## Cause

A new query in 2.3 held database connections too long. (Not part of the video.)
