     // file-enforcer.config.ts
     import { enforce, cat, exec } from '@monochromatic-dev/dev-script-file-enforcer';

     export default enforce([
       // Simple copy (source, dest)
       cat(['./AGENTS.md']).overwrite('./CLAUDE.md'),
       cat(['./packages/config/oxlint/.oxlintrc.json']).overwrite('./.oxlintrc.json'),
       cat(['./packages/config/oxlint/oxlint-require-tsdoc.ts']).overwrite('./oxlint-require-tsdoc.ts'),

       // Mirror glob: wildcards in source map to same position in dest
       cat('./packages/*/*/src/*.ts')
       .inspect() // [{ path: './...', content: '...' }, ...]
       .overwriteEach('./temp/*/*/src/*.ts'),

       // Concatenate multiple files into one
       cat(['./.ignore', './.stylelintignore', './.gitignore'])
       .inspect() // `<combinedContent>`
       .overwrite('./.remarkignore'),

       // Concatenate with dedup (remove duplicate lines)
       cat(['./AGENTS.md', './CLAUDE.md', './LICENSE']).dedup().overwrite('./.remarkignore'),

       // Pipeline: read -> transform -> write
       cat(['./full-config.json'])
         .inspect() // `<content>`
         .jsonPath('.rules')          // simple dot-path property access
         .overwrite('./rules.json'),

       // Pipeline with exec
       exec('rg', ['TODO', './src'])
         .overwrite('./todos.txt'),

       // Later entries override earlier ones on dest conflict
       cat(['./temp/placeholder.ts']).overwrite('./temp/build/file-enforcer/src/index.ts'),

       cat(['./temp/placeholder.ts']).overwriteIfNotExists('./temp/build/file-enforcer/src/index.ts'),
     ]);

