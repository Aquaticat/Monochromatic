import path from 'path';

import fs from 'fs';

import shell from 'shelljs';

const minify = (file: string, format = 'html'): string => {
  console.log('minify', file);

  switch (format) {
    case 'html': {
      const tempFilePath = path.join(path.resolve(), 'temp.html');

      fs.writeFileSync(tempFilePath, file);
      console.log(fs.readFileSync(tempFilePath, { encoding: 'utf8' }));

      shell.exec(
        `echo 'yes' && pnpm exec html-minifier-terser --case-sensitive --collapse-whitespace --conservative-collapse --decode-entities --keep-closing-slash --preserve-line-breaks -o ${tempFilePath}.out ${tempFilePath}`,
      );

      fs.writeFileSync(tempFilePath, '');

      const resultHtml = fs.readFileSync(`${tempFilePath}.out`, { encoding: 'utf8' });

      console.log('\n\nresultHtml\n\n', resultHtml);

      fs.writeFileSync(`${tempFilePath}.out`, '');

      return resultHtml;
    }

    default: {
      throw TypeError(`${format} is not one of supported types.
      Supported types:
      'html',
      'md' (GitHub flavored markdown)
      'mdx'`);
    }
  }
};

export default minify;
