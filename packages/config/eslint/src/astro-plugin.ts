import type { FlatConfig } from '@typescript-eslint/utils/ts-eslint';
import * as astroParser from './astro-parser.ts';
/**
 * ESLint plugin for Astro files.
 * Provides a custom parser that extracts frontmatter and script content for linting.
 */
const astroPlugin: FlatConfig.Plugin = {
  meta: {
    name: 'astro-internal',
    version: '1.0.0',
  },

  configs: {},
};

// Add shared configuration for all Astro files
const astroPluginWConfig: FlatConfig.Plugin & {
  configs: { recommended: FlatConfig.Config[]; };
} = {
  ...astroPlugin,
  configs: {
    recommended: [{
      files: ['**/*.astro'],
      plugins: {
        'astro-internal': astroPlugin,
      },
      languageOptions: {
        parser: astroParser,
      },
    }],
  },
};

export default astroPluginWConfig;
