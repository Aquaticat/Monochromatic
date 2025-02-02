import {
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
} from '@monochromatic-dev/module-es/ts';
import { fs } from '@monochromatic-dev/module-node/ts';
import { parse } from 'smol-toml';
import { confObjSchema } from './confObj.ts';
import parsed from './parsed.ts';

await logtapeConfigure(logtapeConfiguration('monochromatic-file-enforcer'));

const l = logtapeGetLogger(['a', 'index']);

const confObjInput = parse(
  await fs.readFileU(parsed.config),
);

const confObj = await confObjSchema.parseAsync(confObjInput);

l.info`Parsed ${parsed.config}, ${confObjInput} as ${confObj}`;

// First implement apply all 1 to 1.

confObj.files.forEach((ruleGroup) => {
  ruleGroup.forEach(
    async ([destination, source]) => {
      if (Array.isArray(source) || Array.isArray(destination)) {
        l
          .error`Multiple files to multiple files, multiple files to one file, one file to multiple files not implemented for ${destination} <- ${source}`;
      }

      if (Array.isArray(source)) {
        // TODO: Implement
      } else {
        if (Array.isArray(destination)) {
          // TODO: Implement
        } else {
          await fs.outputFile(destination.path, source.content!);
        }
      }
    },
  );
});

/*
confObj.files.forEach((fileGroup) => {
  Object.entries(fileGroup).forEach(
    async ([destinationFilesSpecifier, sourceFilesSpecifier]) => {
      l.info`${destinationFilesSpecifier}, ${sourceFilesSpecifier}`;

      // Refactor: might be better to resolve source and destination separately first without considering many/one to many/one. In the end, it still comes down to having the same parts.

      if (typeof sourceFilesSpecifier === 'string') {
        if (sourceFilesSpecifier.includes('*')) {
          if (!destinationFilesSpecifier.includes('*')) {
            throw new TypeError(
              `When source ${sourceFilesSpecifier} is glob and destination ${destinationFilesSpecifier} is not, source represents multiple files and destination represents one file, impossible to handle.`,
            );
          }

          l.debug(`source and destination are both glob, both represent multiple files.`);
          l.warn(`Not implemented yet`);
        }

        const sourceText: string = await (async (): Promise<string> => {
          try {
            return await (await fetch(sourceFilesSpecifier)).text();
          } catch (fetchError) {
            l.debug`${sourceFilesSpecifier} is not a fetchable ${fetchError}`;
            return await readFile(resolve.sync(process.cwd(), sourceFilesSpecifier).path!,
              'utf8');
          }
          // source and destination are both not glob, each represent a individual file,
        })();

        await writeFile(resolve.sync(process.cwd(), destinationFilesSpecifier).path!,
          sourceText);
      }

      l.debug(`source is an array of operations creating one file`);
      l.warn(`Not implemented yet.`);
    },
  );
}); */
