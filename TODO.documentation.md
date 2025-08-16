# Documentation & UI/UX Todo

## Documentation System Improvements

### High Priority

#### PlantUML Integration
**Status**: Normal Priority - Content creation enhancement

Add support for PlantUML diagrams in documentation.

#### Optimize SVG
**Status**: Normal Priority - Performance improvement

Reduce redundant attributes in PlantUML-generated SVGs:
- Remove redundant height/width attributes
- Optimize fill attributes on subelements
- Make font-size and similar properties more accessible

### Medium Priority

#### Pre-generate Search Results Pages
**Status**: Medium Priority - User experience

Use pagefind or other tools to pre-generate search results pages.
Improve search functionality with pre-generated results.

#### Set Default Modified Date by Git Log
**Status**: Medium Priority - Content management

Automatically set document modification dates from git history.

#### Format MDX Files
**Status**: Low Priority - Developer experience

Find a way to format MDX files properly.

## Localization and Internationalization

### Multiple Localized 404 Pages
**Status**: Normal Priority - User experience

Create localized 404 pages for different languages and regions.

### Automatic Translation Integration
**Status**: Low Priority - Future enhancement

Consider using [deepl-node](https://github.com/DeepLcom/deepl-node) for automatic translation.

## UI/UX Improvements

### Interactive Features

#### Dim Sidebar on Hover
**Status**: On Hold - Potentially annoying

Dim sidebar (.Aside) when hovering over main content.
Currently on hold - could be annoying for users.

### Comment System Implementation

#### Webmention Support
**Status**: Medium Priority - Decentralized web

Implement decentralized web mention protocol for comments.

#### Giscus Integration
**Status**: Medium Priority - GitHub integration

Add GitHub Discussions-based commenting system.

#### Pluggable Comment System
**Status**: Medium Priority - Flexibility

Allow defining 3rd party comment system.
Make comment system pluggable for flexibility.

## Documentation Standards

### Writing Guidelines

#### Technical Documentation Style
When writing technical documentation (README, philosophy, architecture docs):
- Write in active voice without collective pronouns
- State facts directly: "Astro for documentation" instead of "We chose Astro for our documentation"
- Avoid meta-references: write "Prioritizing portability" instead of "This aligns with the project's philosophy of portability"
- Use present tense for current state, future tense only for planned features
- Eliminate unnecessary connecting phrases and transitions

#### Markdown Conventions

**Text Formatting**:
- One sentence per line for better diffs and readability
- Use **bold** for emphasis, avoid _italics_
- Prefer fenced code blocks with language tags over inline code for multi-line snippets
- Use inline code `like this` for single commands, function names, or short code

**Lists**:
- Use `-` for unordered lists with one space after
- Numbered lists: pad marker to 4 characters (e.g., `1.  `, `10. `)
- Maintain consistent indentation (2 spaces for nested items)
- Add blank lines before and after lists

**Code Blocks**:
- Always specify language for syntax highlighting
- Use `bash` for shell commands, `ts` for TypeScript
- Include file paths as comments when showing file contents

**Structure**:
- Use ATX-style headers (`#` not underlines)
- Maximum header depth: 4 levels (####)
- Add blank line before headers (except first)
- Keep line length under 120 characters when possible

### Documentation Format Standards

#### Never Use Emojis
- NEVER use emojis in any content meant to be read by humans
- Focus on clear, professional text without decorative elements

#### Heading Style
- NEVER use ALL CAPS for headings or emphasis in documentation
- Use sentence case for headings
- For emphasis, use **bold** formatting instead of capitalization

## Content Management

### Version Control Integration
- Automatically track document changes through git history
- Use git log data for "last modified" timestamps
- Integrate with build system for automatic updates

### Asset Optimization
- Optimize images for web delivery
- Implement responsive image loading
- Compress and optimize SVG assets
- Consider WebP/AVIF formats for better compression

## User Experience Research

### Accessibility
- Ensure all documentation meets WCAG guidelines
- Test with screen readers and keyboard navigation
- Provide alternative text for all visual content
- Maintain good color contrast ratios

### Performance
- Monitor page load times for documentation sites
- Implement efficient caching strategies
- Optimize for mobile devices
- Test on various network conditions

## Future Enhancements

### Interactive Documentation
- Consider implementing interactive code examples
- Add copy-to-clipboard functionality for code blocks
- Implement search highlighting and navigation
- Add feedback mechanisms for documentation quality

### Analytics and Insights
- Track which documentation sections are most accessed
- Identify common user paths through documentation
- Monitor search queries to identify missing content
- Gather user feedback on documentation helpfulness