# Incident details

Timeline lines, under a heading that contains "timeline":

```
- 14:02 [action] Deploy 2.3 rolled out | api
- 14:09 [alert] Error rate above 5%
- 14:31 [fix] Rolled back
```

- A line is a time (HH:MM or HH:MM:SS, optional UTC), an optional `[type]` (`failure`, `alert`, `action`, `fix`, `info`; default `info`) and the text, with an optional `| where` (a component, up to 24 characters).
- 2 to 10 events. Times must go forward; across midnight, trim the timeline or split the video.
- Computed: minutes from the first failure (or first event) to the first later alert and to the last fix.
- Not built: logs as input, an overlay on the architecture diagram, severity or customer impact numbers.
