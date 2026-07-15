# Handover: obtaining the Windows Authenticode signing certificate

The signing pipeline is built and runs today against a throwaway self-signed
certificate (`mise run sign:windows` with no env vars).
 To produce a real,
SmartScreen-recognized signed `music-player.exe`,
 an organization code-signing
certificate is needed,
 and only a human can buy it and pass identity validation.
This runbook walks the acquisition,
 then points at the env vars `sign:windows`
reads.

The certificate is deliberately organization-validated,
 not individual:
 an
Authenticode signature's subject is shown to users in the Windows publisher
prompt and in the file's **Digital Signatures** tab.
 An organization (OV)
certificate puts the Canadian org's legal name there,
 not the maintainer's.

## What this proves

That `music-player.exe` signed by `sign:windows` shows the organization as a
trusted publisher on Windows and accrues SmartScreen reputation,
 rather than
triggering an "unknown publisher" warning.
 The pipeline mechanics
(signing,
 timestamping,
 verifying via `osslsigncode`) are already proven with a
self-signed cert;
 this runbook only supplies the real certificate.

## Bridges tried before handing this off

Purchasing a certificate and passing a CA's organization identity validation
(submitting business-registration documents,
 legal/phone verification) are
inherently human and cannot be automated.
 Everything downstream (driving the
cloud key over PKCS#11,
 timestamping,
 signing,
 verifying) is already automated in
`sign:windows` and runs from Linux via `osslsigncode` in `Containerfile.sign`.

## Background: why this is not the cheap individual cert

Two constraints shape the choice (see
`../../../doc/troubleshooting/windows-code-signing-hardware-key-requirement.md`):

- Since 2023-06-01,
   OV/EV code-signing private keys must live in certified
  hardware or a cloud HSM and are non-exportable,
   so a plain `.pfx` is no longer
  issued for real certs.
   Pick a **cloud-key** product so it can be driven from
  Linux over PKCS#11.
- The cheapest publicly trusted option,
   Certum Open Source Code Signing
  (~58 USD/year via SimplySign cloud),
   is issued to an **individual** developer
  and prints that person's legal name.
   It is therefore rejected here in favour of
  an organization-validated certificate,
   which costs more.
   Confirm current
  pricing at purchase;
   org OV typically exceeds the individual option,
   and the
  budget was relaxed for the privacy benefit.

## Prerequisites

- The registered Canadian legal entity,
   with its business-registration documents
  available for the CA's validation.
- A chosen CA that issues organization OV code signing with a cloud key usable
  from Linux.
   Candidates to compare at purchase:
   Certum (organization code
  signing via SimplySign cloud) and SSL.
  com (eSigner cloud).
   Avoid a physical USB
  token if you can:
   tokens are awkward to drive from a headless Linux host.

## Setup

Status:
 TODO | DONE

1. Buy an organization OV code-signing certificate with a cloud key from the
   chosen CA.
    Expected:
    an order that enters identity-validation.
2. Complete the CA's organization validation (business documents,
    possibly a
   phone or legal-opinion step).
    Expected:
    the certificate is issued and bound to
   a cloud-signing account (for example Certum **SimplySign**).
3. Install the CA's PKCS#11 module so the sign container can reach the cloud key.
   Either extend `Containerfile.sign` to install the CA's client/module,
    or place
   the module's `.so` under `dist/` (visible at `/work/dist/...` in the
   container) and reference it.
    Expected:
    `pkcs11-tool --module <module.so>
   --list-slots` lists the cloud token.

## Steps

Status:
 TODO | DONE

1. Discover the PKCS#11 object IDs for your certificate and key:
   ```bash
   podman run --rm -v "$PWD:/work" -w /work localhost/monochromatic/sign \
     pkcs11-tool --module dist/<ca-module>.so --list-objects --login
   ```
   Expected:
    a **Certificate Object** and a **Private Key Object** with `ID`
   values (or PKCS#11 URIs) you will pass to the task.
2. Point the task at the cloud key and the CA's RFC3161 timestamp server,
    then
   sign (the `.exe` must be built on x13-win and synced to
   `dist/music-player.exe` first,
    see the package README):
   ```bash
   export MP_WIN_PKCS11_MODULE=dist/<ca-module>.so
   export MP_WIN_PKCS11_CERT='<pkcs11 cert id or URI>'
   export MP_WIN_PKCS11_KEY='<pkcs11 key id or URI>'
   export MP_WIN_TIMESTAMP_URL='<CA RFC3161 TSA URL>'
   mise run //packages/music-player/desktop-app:sign:windows
   ```
   Expected:
    the task prints `signing with organization OV cert via PKCS#11` and
   then `signed dist/music-player-signed.exe`.

## What to check

Status:
 TODO | DONE

- `sign:windows` ends with `osslsigncode verify` reporting a trusted chain.
  Expected:
   output contains `Signature verification: ok` and the signer's subject
  is the Canadian org's legal name,
   not the maintainer's.
- The signature carries a timestamp,
   so it stays valid after the certificate
  expires.
   Expected:
   `osslsigncode verify` shows a `Timestamp` line.
- On Windows (for example `ssh x13-win`):
   right-click `music-player-signed.exe`,
  open **Properties**,
   then the **Digital Signatures** tab.
   Expected:
   one
  signature whose **Name of signer** is the organization,
   marked valid.
- SmartScreen no longer shows "Windows protected your PC / unknown publisher" for
  a downloaded copy once reputation accrues.
   Expected:
   a standard run prompt,
   not
  an unknown-publisher block.
   Reputation builds over time and downloads.

## Restore

Status:
 TODO | DONE

1. The cloud-signing account credentials and the PKCS#11 module are secrets.
   Keep the module and any PIN out of git (place them under the ignored `dist/`
   for the run),
    and unset the `MP_WIN_*` env vars afterward.
    Expected:
   `git status` shows nothing under `dist/`.
2. To stop signing with the real cert,
    unset `MP_WIN_PKCS11_MODULE`;
    the task
   falls back to the self-signed test path.
