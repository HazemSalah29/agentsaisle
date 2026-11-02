# Providers

`providers.yaml` (no keys in it):

```yaml
monthlyCapUsd: 5 # 0 means no paid generation
providers:
  - id: gem-image
    adapter: gemini-image # or: veo
    kind: image
    model: <model id from the provider's docs>
    keyEnv: GEMINI_API_KEY
    usdPerImage: 0 # fill in the current price
  - id: veo
    adapter: veo
    kind: video
    model: <model id>
    keyEnv: GEMINI_API_KEY
    usdPerSecond: 0 # fill in the current price
```

Adapters: `test` (offline, free, built in), `gemini-image`, `veo`. Both network adapters talk only to `generativelanguage.googleapis.com` and refuse to download from any other host. Their endpoint paths and field names are `TODO(verify)`: they were written without access to the docs, so run one cheap call and check before relying on them. Licences, watermarks and commercial-use terms are also `TODO(verify)`.

Not built: music, sfx, lipsync. Higgsfield Katana is an MCP tool the agent calls, not an adapter.
