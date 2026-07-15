# Handover: obtaining the macOS code-signing + notarization credentials

The signing pipeline is built and runs today against a throwaway self-signed
identity (`mise run sign:macos` with no env vars).
 To produce a real,
 notarized,
Gatekeeper-trusted `Music Player.app`,
 three Apple credentials are needed,
 and
only a human can obtain them.
 This runbook walks the acquisition,
 then points at
the env vars the `sign:macos` and `notarize:macos` tasks read.

The identity is deliberately an organization,
 not an individual:
 a Developer ID
signature embeds the team's name and Gatekeeper shows it as
`Developer ID Application: <name>`.
 Enrolling as an organization puts the
Canadian org's legal name there,
 not the maintainer's personal name.

## What this proves

That a `Music Player.app` signed by `sign:macos` and submitted by
`notarize:macos` is accepted by macOS Gatekeeper on a machine that has never seen
it,
 with the signer shown as the organization.
 The pipeline mechanics
(bundling,
 signing,
 stapling,
 verifying) are already proven with a self-signed
cert;
 this runbook only supplies the real identity.

## Bridges tried before handing this off

These steps are inherently human and legal,
 not automatable:
 creating an Apple
account,
 paying the membership fee,
 passing Apple's organization identity
verification,
 and obtaining a D-U-N-S number for the Canadian entity.
 No CLI,
token,
 or API bridges any of them.
 Everything downstream of holding the
credentials (CSR generation,
 certificate assembly,
 signing,
 notarization,
stapling,
 verification) is already automated in the mise tasks and runs from
Linux via `rcodesign`.

## Prerequisites

- A registered Canadian legal entity (corporation or registered business name)
  whose name you are willing to publish as the signer.
- A **D-U-N-S Number** for that entity.
   Apple requires it for organization
  enrollment.
   It is free from Dun & Bradstreet;
   request or look it up through
  Apple's tool at <https://developer.apple.com/enroll/duns-lookup/>.
   Allow several
  business days if the entity has no existing D-U-N-S.

## Setup

Status:
 TODO | DONE

1. Confirm the Canadian entity's legal name,
    address,
    and D-U-N-S Number match
   Dun & Bradstreet's record.
    Expected:
    the **D-U-N-S Lookup** page returns your
   entity with the correct legal name.
2. Have a device that can receive Apple's verification call/email and run a web
   browser for the enrollment.
    The Apple Silicon Mac (`ssh m1`) is convenient but
   any machine works.

## Steps

Status:
 TODO | DONE

1. Go to <https://developer.apple.com/programs/enroll/> and start enrollment.
   Choose **Organization** (not Individual).
    Expected:
    the form asks for the
   legal entity name,
    D-U-N-S Number,
    and your authority to bind the org.
2. Submit and complete Apple's verification (Apple may phone the number on the
   D-U-N-S record).
    Pay the **99 USD/year** membership.
    Expected:
    the account
   state becomes **Active** with an organization team;
    note the 10-character
   **Team ID**.
3. In <https://developer.apple.com/account/resources/certificates/list>,
    click
   **+**,
    choose **Developer ID Application**,
    and follow the CSR prompt.
    Generate
   the CSR and private key off-box (keeps the key on the Linux signing host):
   ```bash
   # On the Linux signing box:
   openssl req -new -newkey rsa:2048 -nodes \
     -keyout dist/devid.key -out dist/devid.csr \
     -subj "/CN=<Canadian Org Legal Name>"
   ```
   Upload `dist/devid.csr`.
    Expected:
    Apple issues a certificate;
    download
   `developerID_application.cer`.
4. Download Apple's intermediate **Developer ID Certification Authority (G2)**
   from <https://www.apple.com/certificateauthority/> so the signature chains.
   Assemble the `.p12` (leaf + intermediate + key):
   ```bash
   openssl x509 -inform DER -in developerID_application.cer -out dist/devid.crt
   openssl pkcs12 -export \
     -inkey dist/devid.key -in dist/devid.crt \
     -certfile DeveloperIDG2CA.cer \
     -out dist/developer-id.p12 -passout pass:CHANGES_ME
   printf 'CHANGES_ME' > dist/developer-id.p12.pass
   ```
   Expected:
    `dist/developer-id.p12` exists.
    (Alternative:
    on the Mac,
    generate
   the CSR in **Keychain Access** and **export** the issued certificate as a
   `.p12`;
    Keychain bundles the chain for you.
   )
5. Create an App Store Connect API key for notarization at
   <https://appstoreconnect.apple.com/access/integrations/api>.
    Generate a key
   with the **Developer** role.
    Expected:
    you download `AuthKey_<KEYID>.p8` once
   and can read the **Issuer ID** (a UUID) and **Key ID** on the page.
6. Encode the API key into the single JSON `rcodesign` expects:
   ```bash
   mise exec -- rcodesign encode-app-store-connect-api-key \
     -o dist/asc-api-key.json \
     <ISSUER_ID> <KEYID> AuthKey_<KEYID>.p8
   ```
   Expected:
    `dist/asc-api-key.json` is written.
7. Point the tasks at the credentials and run them (the Mach-O must be built on
   the Mac and synced to `dist/music-player` first,
    see the package README):
   ```bash
   export MP_MACOS_P12=dist/developer-id.p12
   export MP_MACOS_P12_PASSWORD_FILE=dist/developer-id.p12.pass
   export MP_ASC_API_KEY_JSON=dist/asc-api-key.json
   mise run //package/music-player/desktop-app:bundle:macos
   mise run //package/music-player/desktop-app:sign:macos
   mise run //package/music-player/desktop-app:notarize:macos
   ```
   Expected:
    `sign:macos` prints `signing with Developer ID (.p12) for
   notarization`,
    and `notarize:macos` prints `notarized + stapled dist/Music
   Player.app`.

## What to check

Status:
 TODO | DONE

- `sign:macos` ends with `rcodesign verify` printing no errors,
   and the signing
  identity is the organization,
   not a person.
   Confirm with:
  ```bash
  mise exec -- rcodesign verify dist/Music\ Player.app
  ```
  Expected:
   a line naming `Developer ID Application: <Canadian Org Legal Name>`,
  not the maintainer's name.
- `notarize:macos` completes without an `Invalid` status from Apple.
   Expected
  output contains `notarized + stapled`.
- On any Mac (for example `ssh m1`),
   Gatekeeper accepts the stapled app:
  ```bash
  spctl --assess --type execute --verbose=4 dist/Music\ Player.app
  ```
  Expected:
   `accepted` and `source=Notarized Developer ID`.

## Restore

Status:
 TODO | DONE

1. The `.p12`,
    its password file,
    the `.p8`,
    and `asc-api-key.json` are secrets.
   They live under `dist/` (gitignored) only for the run;
    move them to your
   secret store and unset the env vars afterward.
    Expected:
    `git status` shows
   none of them (they are under the ignored `dist/`).
2. Nothing about the credentials is committed to the repo.
    To stop signing,
   simply unset `MP_MACOS_P12` / `MP_ASC_API_KEY_JSON`;
    the tasks fall back to the
   self-signed test path.
