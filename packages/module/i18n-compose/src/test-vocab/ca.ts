/**
 * Test-only Catalan vocabulary tables.
 *
 * @module
 */

import type {
  NounEntry,
  SubjectEntry,
} from '../entries.ts';
import type { CatalanVerbEntry, } from '../locales/ca/index.ts';
import type {
  TestLabel,
  TestNoun,
  TestSubject,
  TestVerb,
} from './types.ts';

/** Catalan label table for tests. */
export const caLabels: Record<TestLabel, string> = {
  siteName: 'Aquaticat',
  noResults: 'Sense resultats',
  page: 'pàgina',
};

/** Catalan subject table for tests. */
export const caSubjects: Record<TestSubject, SubjectEntry> = {
  I: {
    surface: 'Jo',
    possessive: 'meu',
    person: 1,
    number: 'singular',
  },
  you: {
    surface: 'Tu',
    possessive: 'teu',
    person: 2,
    number: 'singular',
  },
  they: {
    surface: 'Ells',
    possessive: 'seu',
    person: 3,
    number: 'plural',
  },
  who: {
    surface: 'Qui',
    possessive: 'de qui',
    person: 3,
    number: 'singular',
  },
};

/** Catalan noun table for tests. */
export const caNouns: Record<TestNoun, NounEntry> = {
  cat: {
    surface: 'gat',
    plural: 'gats',
    gender: 'masculine',
    articles: {
      definite: {
        singular: 'el',
        plural: 'els',
      },
      indefinite: {
        singular: 'un',
        plural: 'uns',
      },
    },
  },
  message: {
    surface: 'missatge',
    plural: 'missatges',
    gender: 'masculine',
    articles: {
      definite: {
        singular: 'el',
        plural: 'els',
      },
      indefinite: {
        singular: 'un',
        plural: 'uns',
      },
    },
  },
  item: {
    surface: 'article',
    plural: 'articles',
    gender: 'masculine',
    articles: {
      definite: {
        singular: "l'",
        plural: 'els',
      },
      indefinite: {
        singular: 'un',
        plural: 'uns',
      },
    },
  },
};

/** Catalan verb table for tests. */
export const caVerbs: Record<TestVerb, CatalanVerbEntry> = {
  have: {
    infinitive: 'tenir',
    imperative: 'Té',
    finite: {
      present: {
        '1s': 'tinc',
        '2s': 'tens',
        '3s': 'té',
        '1p': 'tenim',
        '2p': 'teniu',
        '3p': 'tenen',
      },
      past: {
        '1s': 'tenia',
        '2s': 'tenies',
        '3s': 'tenia',
        '1p': 'teníem',
        '2p': 'teníeu',
        '3p': 'tenien',
      },
      future: {
        '1s': 'tindré',
        '2s': 'tindràs',
        '3s': 'tindrà',
        '1p': 'tindrem',
        '2p': 'tindreu',
        '3p': 'tindran',
      },
    },
  },
  see: {
    infinitive: 'veure',
    finite: {
      present: {
        '1s': 'veig',
        '2s': 'veus',
        '3s': 'veu',
        '1p': 'veiem',
        '2p': 'veieu',
        '3p': 'veuen',
      },
    },
  },
  delete: {
    infinitive: 'esborrar',
    finite: {
      present: {
        '1s': 'esborro',
        '2s': 'esborres',
        '3s': 'esborra',
        '1p': 'esborrem',
        '2p': 'esborreu',
        '3p': 'esborren',
      },
    },
  },
  want: {
    infinitive: 'voler',
    finite: {
      present: {
        '1s': 'vull',
        '2s': 'vols',
        '3s': 'vol',
        '1p': 'volem',
        '2p': 'voleu',
        '3p': 'volen',
      },
    },
  },
  save: {
    infinitive: 'desar',
    imperative: 'Desa',
    finite: {
      present: {
        '1s': 'deso',
        '2s': 'deses',
        '3s': 'desa',
        '1p': 'desem',
        '2p': 'deseu',
        '3p': 'desen',
      },
    },
  },
};
