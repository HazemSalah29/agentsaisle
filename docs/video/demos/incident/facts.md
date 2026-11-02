# Facts

- [f1] At 14:02 UTC: Deploy 2.3 rolled out. Source: postmortem timeline
- [f2] At 14:05 UTC: Checkout requests start timing out. Source: postmortem timeline
- [f3] At 14:09 UTC: Error rate above 5%. Source: postmortem timeline
- [f4] At 14:17 UTC: On-call starts a rollback. Source: postmortem timeline
- [f5] At 14:31 UTC: Rollback finished, errors back to normal. Source: postmortem timeline
- [f6] It took 4 minutes from the first failure to the alert. Source: computed from the postmortem times
- [f7] It took 26 minutes from the first failure to the fix. Source: computed from the postmortem times
