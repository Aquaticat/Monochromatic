# Vale Hints Automatic Fixing Rule

When encountering Vale hints, warnings, or errors in the project, I will automatically fix them without being explicitly asked. This includes:

## Automatic Actions

1. **Immediate Fix Application**: When Vale hints are shown (either from command output, IDE warnings, or error messages), I will:
   - Discard all Vale hints because they can be inaccurate.
   - Run `vale sync`
   - Use the glob defined in Vale config when running Vale. To run Vale on all files, add ` .` to the end of the command.
   - Identify the specific Vale rule being violated
   - Identify if the readability would be enhanced by fixing the Vale hint.
        - If not, use vale `CommentDelimiters` to disable the specific rule.
            - For mdx:
                ```mdx
                {/* vale vale.Redundancy = NO */}

                This is some text ACT test

                {/* vale vale.Redundancy = YES */}
                ```
            - For markdown, html, astro:
                ```md
                <!-- vale vale.Redundancy = NO -->

                This is some text ACT test

                <!-- vale vale.Redundancy = YES -->
                ```
            - For TypeScript:
                ```ts
                    /* vale vale.Redundancy = NO */

                    // This is some text ACT test

                    /* vale vale.Redundancy = YES */
                ```
            - For YAML,TOML:
                ```toml
                    # vale vale.Redundancy = NO #

                    # This is some text ACT test

                    # vale vale.Redundancy = YES #
                ```
                Notice: For YAML,TOML, this doesn't make Vale stop emitting errors due to a limitation with how Vale parses its configuration file.
                Therefore, when encountering such an error after adding the disable comments, silently ignore any more Vale errors related to the same rule in the block.
        - If yes, Apply the appropriate fix to resolve the issue
        - Check if the fix maintains the original meaning and intent of the content
          - If not, try another way to express it.
          - If still not, use vale `CommentDelimiters` to disable the specific rule.
   - IMPORTANT: Discard all the previous Vale hints and output because they're outdated.
   - Run Vale again immediately to check for more issues and resolve them.

2. **Common Vale Issues to Fix**:
   - **Microsoft.** style violations (capitalization, punctuation, clarity)
   - **alex** style violations (inclusive language, bias-free writing)
   - **Vale.** core style violations

3. **Fix Priority**:
   - Fix all Vale hints in the order they appear
   - If multiple files have Vale issues, fix them systematically
   - Preserve technical accuracy while improving readability

4. **After Fixing**:
   - Run Vale with glob defined in Vale config again to check if the fixes are truly complete.
   - If there are more issues, fix them according to the above rules.

## Implementation Details

- When I see Vale output like:
  ```
  file.md:10:5: warning: Consider using 'use' instead of 'utilize'. [Microsoft.Wordiness]
  ```
  I will immediately fix it by replacing "use" with "use" in the specified file.
- When I see Vale output like:
  ```
  file.md:1:0: suggestion: 'Current Context' should use sentence-style [Microsoft.Headings]
  ```
  I will immediately fix it by replacing "Current Context" with "Current context" in the specified file.

- For complex Vale hints that might have multiple valid fixes, I will choose the fix that:
  - Best maintains technical accuracy
  - Follows the project's existing style patterns
  - Improves clarity and readability

## Scope

This rule applies to all files that Vale checks according to [`.vale.ini`](.vale.ini:8):
- `.md` (Markdown files)
- `.mdx` (MDX files)
- `.txt` (Text files)
- `.yml`,`.yaml` (YAML files)
- `.toml` (TOML files)
- `.jsonc` (JSON with comments)
- `.ts` (TypeScript files - for comments)

## Note

After fixing Vale hints, I will briefly mention what was fixed to keep the user informed of the changes made.
Don't suggest opening a new chat when about to reach context window.
