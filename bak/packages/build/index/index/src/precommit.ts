import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import {
  exec,
  packageInfo,
} from '@monochromatic-dev/module-node/ts';
import { pipedAsync } from 'rambdax';
const l = getLogger(['a', 'precommit']);

export default async (): Promise<void> => {
  await Promise.all([
    pipedAsync(
      path.join(packageInfo.workspaceAbsDir, '.vscode'),
      fs.exists,
      Boolean,
      async (existsDotVscode) => {
        if (existsDotVscode) {
          l
            .error`.vscode found in root.
            Suggestion: merge its contents into *.code-workspace and delete .vscode`;

          // TODO: Implement auto merging .vscode into .code-workspace.
          throw new Error(
            `Handling auto merging .vscode settings into .code-workspace not implemented!`,
          );
        }
      },
    ),
    (async function formatters() {
      // MAYBE: We need to add `yarn run -T -B` to the front if not using our own $c.

      // CSS/TS/VUE/JSON linter/formatter
      await exec`${packageInfo.pe} biome format --write .`;

      await Promise.all([
        // TS linter/formatter
        exec`${packageInfo.pe} oxlint -c ${
          path.join(packageInfo.workspaceAbsDir, 'packages/config/oxlint/index.json')
        } --ignore-path ${
          path.join(packageInfo.workspaceAbsDir, 'packages/config/oxlint/.eslintignore')
        } --fix`,

        // CSS linter/formatter
        exec`${packageInfo.pe} stylelint --fix '**/*.css'`,
      ]);

      // CSS/TS/VUE formatter
      await exec`${packageInfo.pe} dprint fmt`;
    })(),
  ]);
};
