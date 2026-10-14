# Pi provider probe credential loading

## Ciphertext mistaken for an API key

On October 14,
2026,
private Liquid and SubQ probes read `AUTO_MODE_LIQUID_API_KEY`
and `AUTO_MODE_SUBQ_API_KEY` directly from `.env.local.json`.
That file contains SOPS-encrypted values.
Liquid's documented Decisions endpoint returned HTTP 401 `invalid_api_key`;
SubQ's Decisions endpoint returned HTTP 403 `permission_error`.
Explicit rechecks reproduced both diagnostics with the same mistaken credential source.
SubQ's models endpoint returned HTTP 200 with the ciphertext,
so that response did not prove valid authentication.

The user questioned whether mise was involved.
`mise.toml` loads `.env.local.json` through `env._.file` with redaction enabled.
Its comments identify SOPS decryption through mise's built-in rops.
The [current mise documentation](https://mise.jdx.dev/environments/secrets/sops.html)
describes that encrypted-file support.
The installed `mise env --help` confirms that `--json` emits resolved values,
including secrets;
`--redacted` filters variables but does not mask their values.

Capture `mise env --json` in process memory from the repository directory.
Pass only the required decrypted key to the isolated probe process.
Never print or persist that JSON,
and avoid exception objects that include captured subprocess output.
Reject missing,
empty,
or `ENC[`-prefixed values before dispatch.
Only a real request with the resolved key verifies account access.

The initial in-memory capture passed presence and non-ciphertext checks for both keys.
Liquid's resolved key has its documented `liquid_` prefix.
No key or account mutation was needed to obtain these resolved values.
Real-key provider results remain separately required.
