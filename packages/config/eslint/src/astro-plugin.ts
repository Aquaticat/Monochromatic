import type {
  ESLint,
  Linter,
} from 'eslint';
import * as astroParser from './astro-parser.ts';
/**
 * ESLint plugin for Astro files.
 * Provides a custom parser that extracts frontmatter and script content for linting.
 */
const astroPlugin: ESLint.Plugin = {
  meta: {
    name: 'astro-internal',
    version: '1.0.0',
  },

  configs: {},
};

// Add shared configuration for all Astro files
const astroPluginWConfig: ESLint.Plugin & {
  configs: { recommended: Linter.Config; };
} = {
  ...astroPlugin,
  configs: {
    recommended: {
      files: ['**/*.astro',],
      plugins: {
        'astro-internal': astroPlugin,
      },
      languageOptions: {
        parser: astroParser,
      },
    },
  },
};

export default astroPluginWConfig;
