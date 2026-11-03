# Interactive demo

A 24-second, seven-scene project with one branch: after "Two common ways" the viewer picks token bucket or sliding window, and both paths continue at the last scene. Build the page with:

```
node registry/official/video-core/scripts/export-html.mjs docs/video/demos/interactive
```

`question-frame.png` is the page in headless Chrome at the moment the question opens (last frame of the scene held behind it). The player was driven through the DevTools protocol: question at 7 s, both answers played to the shared scene, speed 2x to the end. Not tried: audio in a browser, touch input, Safari and Firefox.
