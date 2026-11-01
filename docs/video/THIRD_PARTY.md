# Third-party software (video library)

The video skills **bundle none of these**. They run programs the user installs, and our scripts never download or install anything. Licences are as recorded on 2026-11-01; `TODO(verify)` each before a public release.

| Program                    | Version tested               | Licence                             | How it is used                                                                                             |
| -------------------------- | ---------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| HyperFrames (HeyGen)       | 0.8.226                      | Apache 2.0                          | Renders the generated HTML project to frames; user-installed (`npm install --global hyperframes@0.8.226`). |
| FFmpeg / ffprobe           | 9.0.2                        | LGPL or GPL, depending on the build | Mixes audio, writes the final MP4, measures audio. System install.                                         |
| Chromium (via HyperFrames) | whatever HyperFrames fetches | BSD-style (Chromium)                | Headless rendering, managed by HyperFrames.                                                                |
| Node.js                    | 22+                          | MIT                                 | Runs our scripts.                                                                                          |

Our own code (the tween helper, scene kinds, scripts) is written for this repository and uses no GSAP. Bundled fonts: none; HyperFrames brings Inter and others, and users add their own OFL fonts to `brand/fonts/`.
