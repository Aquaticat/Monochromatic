# Maven Central publication credentials

## What this proves

This procedure creates the Sonatype Central Portal token needed by
`.github/workflows/kotlin-linter-publish.yml` without placing its value in Git,
chat,
or command output.

The browser automation bridge reached `https://central.sonatype.com/usertoken`,
but the fresh browser had no authenticated Sonatype session.
The MCP browser bridge was also unavailable.
A human login is therefore required.
The one-time token cannot safely pass through the agent's browser output,
so this procedure stores it in a mode-`600` local file for direct transfer into GitHub Actions secrets.

## Setup

Status:
TODO

- Use a Linux desktop with a browser,
  terminal,
  and access to the GitHub repository `Aquaticat/Monochromatic`.
- Use the Sonatype Central Portal account that owns the verified `cat.aquati` namespace.
- Confirm that no screen sharing or terminal recording will capture the generated token.

## Steps

Status:
TODO

1. Open <https://central.sonatype.com/usertoken> in the browser.
   The Sonatype page displays **Sign In** when no authenticated session exists.
2. Select **Sign In** and complete the account's login flow.
   The browser returns to the Central Portal under the authenticated account.
3. Return to <https://central.sonatype.com/usertoken>.
   The page displays **Generate User Token**.
4. Select **Generate User Token**.
   A dialog displays token name and expiration controls.
5. Enter `monochromatic-kotlin-linter-github-actions` in the token name field.
   The dialog displays that exact name.
6. Set **Expiration Date** to `2027-08-16`,
   or the latest permitted date if the portal rejects that date.
   The selected expiration remains visible in the dialog.
7. Select **Generate User Token**.
   A one-time credentials dialog displays a token username and token password.
8. Open a terminal and run:

   ```sh
   install --mode=600 /dev/null "$HOME/maven-central-token.local"
   nano "$HOME/maven-central-token.local"
   ```

   The terminal opens an empty Nano buffer named `maven-central-token.local`.
9. Paste the token username on the first line.
   Nano displays one non-empty first line.
10. Press **Enter** and paste the token password on the second line.
    Nano displays one non-empty second line.
11. Save with **Ctrl+O**, then confirm the path with **Enter**.
    Nano reports `[ Wrote 2 lines ]`.
12. Exit with **Ctrl+X**.
    The terminal returns to its shell prompt.
13. Close the one-time Sonatype credentials dialog.
    The token list displays `monochromatic-kotlin-linter-github-actions`.
14. Tell the coding agent only this path:
    `~/maven-central-token.local`.
    Do not paste either credential into chat.

## What to check

Status:
TODO

Run:

```sh
stat --format='%a' "$HOME/maven-central-token.local"
wc --lines "$HOME/maven-central-token.local"
```

Expected output starts with these exact values:

```text
600
2
```

Do not print the file contents.
The coding agent will transfer each line directly into the repository secrets
`MAVEN_CENTRAL_USERNAME` and `MAVEN_CENTRAL_PASSWORD`.

## Restore

Status:
TODO

After the coding agent confirms that both GitHub Actions secrets exist,
delete the transfer file:

```sh
rm -- "$HOME/maven-central-token.local"
```

The command prints no output.
To revoke or rotate the token later,
return to <https://central.sonatype.com/usertoken>,
select the token named `monochromatic-kotlin-linter-github-actions`,
and use its **Revoke** control.
