import { logtapeGetLogger } from '@monochromatic-dev/module-es/ts';
import { stringify } from '@ungap/structured-clone/json';
import { hasMagic } from 'glob';
import { readFile } from 'node:fs/promises';
import { ResolverFactory } from 'oxc-resolver';
import { z } from 'zod';

const l = logtapeGetLogger(['a', 'confObj']);

const resolve = new ResolverFactory();

// Example: [ "cat", [ "./.ignore", [ "cat", [ ".stylelintignore", "./.gitignore" ] ] ] ],
const operationsKeywordsSchema = z.union([z.literal('cat'), z.literal('override')]);

const destinationSpecifierSchema = z.string().transform(
  (destinationSpecifier, ctx): DestinationVirtualFile | DestinationVirtualFile[] => {
    // Destination specifier can be a single file or a glob.
    // Destination specifier cannot be a fetchable.

    if (hasMagic(destinationSpecifier, { magicalBraces: true })) {
      l.error`glob for destinationSpecifier ${destinationSpecifier} not implemented.`;

      return [];
    }

    const destinationResolveResult = resolve.sync(process.cwd(), destinationSpecifier);

    if (destinationResolveResult.error) {
      if (
        ['Cannot find module '].some((errorMessageStarting) =>
          destinationResolveResult.error!.startsWith(errorMessageStarting)
        )
      ) {
        l.warn`${destinationResolveResult.error}
          This is probably because the destination file just doesn't exist,
          which is one of the intended use cases.
          However, this also mean we're bypassing oxc's enhanced resolving algorithm.
          If you require oxc's enhanced resolve algorithm for this destination file specifier,
          create an empty file yourself first.`;

        return { specifier: destinationSpecifier, path: destinationSpecifier };
      }

      if (
        ['JSONError '].some((errorMessageStarting) =>
          destinationResolveResult.error!.startsWith(errorMessageStarting)
        )
      ) {
        l.warn`${destinationResolveResult.error}
          We're overwriting the entire file anyway.
          `;

        const errorJsonString = destinationResolveResult.error!.slice(
          destinationResolveResult.error!.indexOf('{', destinationResolveResult
            .error!
            .lastIndexOf('}')),
        );

        l.warn`${errorJsonString}`;

        const errorJson: { path: string; } = JSON.parse(errorJsonString);

        return { specifier: destinationSpecifier, path: errorJson.path };
      }

      ctx.addIssue({
        message: `oxc resolver error: ${destinationResolveResult.error}`,
        code: z.ZodIssueCode.custom,
        fatal: true,
      });

      return z.NEVER;
    }

    return { specifier: destinationSpecifier, path: destinationResolveResult.path! };
  },
);

type DestinationVirtualFile = {
  specifier: string;
  path: string;
  moduleType: 'txt' | 'json' | 'toml' | 'yaml';
};

type SourceVirtualFileFile = {
  specifier: string;
  path: string;
};

type SourceVirtualFileType =
  | {
    moduleType: 'txt';
    content: string;
  }
  | {
    moduleType: 'json' | 'toml' | 'yaml';
    content: {};
  };

type SourceVirtualFile = SourceVirtualFileFile & SourceVirtualFileType;

const sourceMultiSpecifierSchema = z
  .string()
  .refine((sourceMultiSpecifier) =>
    hasMagic(sourceMultiSpecifier, { magicalBraces: true })
  )
  .transform(async (sourceMultiSpecifier): Promise<SourceVirtualFile[]> => {
    l.error`glob for destinationSpecifier ${sourceMultiSpecifier} not implemented.`;

    const result: SourceVirtualFile[] = [];

    return result;
  });

const sourceSingleSpecifierSchema = z
  .string()
  .refine((sourceSingleSpecifier) =>
    !hasMagic(sourceSingleSpecifier, { magicalBraces: true })
  )
  .transform(async (sourceBaseSpecifier, ctx): Promise<SourceVirtualFile> => {
    try {
      const response = await fetch(sourceBaseSpecifier);
      return ({
        specifier: sourceBaseSpecifier,
        path: sourceBaseSpecifier,
        content: await response.text(),
      });
    } catch (fetchError) {
      l.warn`fetchError ${fetchError} for ${sourceBaseSpecifier}
      Probably because source base specifier isn't a fetchable url.
      Proceeding to use OXC resolve`;

      const sourceBaseResolveResult = resolve.sync(process.cwd(), sourceBaseSpecifier);

      if (sourceBaseResolveResult.error) {
        // Must succeed, otherwise it cannot be seen as source.
        ctx.addIssue({
          message: `oxc resolver error: ${sourceBaseResolveResult.error}`,
          code: z.ZodIssueCode.custom,
          fatal: true,
        });

        return z.NEVER;
      }

      return {
        specifier: sourceBaseSpecifier,
        path: sourceBaseResolveResult.path!,
        content: await readFile(sourceBaseResolveResult.path!, 'utf8'),
      };
    }
  });

// Source base specifier is single string refering to a single file, a glob, or a fetchable here, even when source specifier is an array.
const sourceBaseSpecifierSchema = z.union([
  sourceMultiSpecifierSchema,
  sourceSingleSpecifierSchema,
]);

const applyOperation = (
  operationBase: [
    z.infer<typeof operationsKeywordsSchema>,
    [SourceVirtualFile, ...SourceVirtualFile[]],
  ],
  ctx: z.RefinementCtx,
): SourceVirtualFile => {
  if (operationBase[0] === 'cat') {
    return {
      specifier: operationBase[0],
      path: stringify(operationBase),
      content: operationBase[1].reduce(
        (prevVirtualFileContent, currentVirtualFile): string =>
          `${prevVirtualFileContent}
${currentVirtualFile.content}`,
        '',
      ),
    };
  }

  l.error`Not implemented!`;

  ctx.addIssue({
    message: `Operation not implemented: ${operationBase.at(0)}`,
    code: z.ZodIssueCode.custom,
    // Add fatal: true once I implement override.
  });

  return {
    specifier: operationBase[0],
    path: stringify(operationBase),
    content: '',
  };
};

export const confObjSchema = z.object({
  files: z
    .array(z
      .record(
        z.string(),
        z.union([
          sourceBaseSpecifierSchema,
          z
            .tuple([
              operationsKeywordsSchema,
              z
                .array(z.union([
                  sourceSingleSpecifierSchema,
                  z
                    .tuple([
                      operationsKeywordsSchema,
                      z
                        .array(z.union([
                          sourceSingleSpecifierSchema,
                          z
                            .tuple([
                              operationsKeywordsSchema,
                              z
                                .array(z.union([
                                  sourceSingleSpecifierSchema,
                                  z
                                    .tuple([
                                      operationsKeywordsSchema,
                                      z
                                        .array(z.union([
                                          sourceSingleSpecifierSchema,
                                          z
                                            .tuple([
                                              operationsKeywordsSchema,
                                              z
                                                .array(sourceSingleSpecifierSchema)
                                                .nonempty(),
                                            ])
                                            .transform(applyOperation),
                                        ]))
                                        .nonempty(),
                                    ])
                                    .transform(applyOperation),
                                ]))
                                .nonempty(),
                            ])
                            .transform(applyOperation),
                        ]))
                        .nonempty(),
                    ])
                    .transform(applyOperation),
                ]))
                .nonempty(),
            ])
            .transform(applyOperation),
        ]),
      )
      .transform((
        destinationSpecifierAndsource,
      ): [
        DestinationVirtualFile | DestinationVirtualFile[],
        SourceVirtualFile | SourceVirtualFile[],
      ][] =>
        Object.entries(destinationSpecifierAndsource).map((
          [destinationSpecifier, source],
        ) => [destinationSpecifierSchema.parse(destinationSpecifier), source])
      ))
    .nonempty(),
});
