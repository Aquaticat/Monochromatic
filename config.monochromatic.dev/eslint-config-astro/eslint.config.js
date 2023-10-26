import typescriptParser from '@typescript-eslint/parser';
import astroParser from 'astro-eslint-parser';
import astroPlugin from 'eslint-plugin-astro';

export default [
  {
    files: ['**/*.astro'],
    plugins: {
      astro: astroPlugin,
    },
    languageOptions: {
      sourceType: 'module',
      parser: astroParser,
      parserOptions: { parser: typescriptParser },
    },

    rules: {
      //region Possible Errors
      'astro/no-conflict-set-directives': 'error',
      'astro/no-unused-define-vars-in-style': 'error',
      'astro/no-deprecated-astro-canonicalurl': 'error',
      'astro/no-deprecated-astro-fetchcontent': 'error',
      'astro/no-deprecated-astro-resolve': 'error',
      'astro/no-deprecated-getentrybyslug': 'error',
      //endregion

      //region Security Vulnerability
      'astro/no-set-html-directive': 'error',
      //endregion

      //region Best Practices
      'astro/no-set-text-directive': 'error',
      //endregion

      //region Stylistic Issues
      'astro/prefer-class-list-directive': 'warn',
      'astro/prefer-object-class-list': 'warn',
      'astro/prefer-split-class-list': 'warn',
      //endregion

      //region Extension
      //endregion
    },
  },
];
