# config-cosign

Cosign key pair for signing OCI container images built by vm-builder.

## Files

- `cosign.pub`:
   public key (committed,
   used for verification)
- `cosign.key`:
   private key (gitignored,
   empty passphrase)
- `.gitignore`:
   prevents private key from being committed

## Regenerating the key pair

```bash
cd package/config/cosign
COSIGN_PASSWORD="" cosign generate-key-pair --output-key-prefix cosign
```

## Signing an image

```bash
COSIGN_PASSWORD="" cosign sign --key package/config/cosign/cosign.key IMAGE_REF
```

## Verifying an image

```bash
cosign verify --key package/config/cosign/cosign.pub IMAGE_REF
```
