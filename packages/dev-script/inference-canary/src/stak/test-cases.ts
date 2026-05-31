/**
 * Test programs and expected outputs for both Stak probes.
 *
 * Expected values are trimmed strings (no leading/trailing whitespace) to allow
 * flexible comparison against model responses that may vary in trailing newlines.
 */

/**
 * Single simulation test case with program source and expected trimmed output
 */
export type SimulationCase = {
  /**
   * Short identifier used in logging
   */
  readonly label: string;
  /**
   * Stak program source (newline-separated tokens)
   */
  readonly program: string;
  /**
   * Expected output after trimming leading/trailing whitespace
   */
  readonly expected: string;
};

/**
 * Five programs covering the key Stak semantics for the simulation probe.
 * Programs are ordered from trivial (sanity check) to non-obvious (trip wires).
 */
export const SIMULATION_CASES: readonly SimulationCase[] = [
  {
    label: 'add',
    program: '3\n5\nADD\nPRINT',
    expected: '8',
  },
  {
    label: 'floor-div',
    program: '-7\n2\nDIV\nPRINT',
    expected: '-4',
  },
  {
    label: 'floor-mod',
    program: '-7\n2\nMOD\nPRINT',
    expected: '1',
  },
  {
    label: 'printc',
    program: '72\nPRINTC\n105\nPRINTC',
    expected: 'Hi',
  },
  {
    label: 'loop',
    program: [
      '3',
      'STORE n',
      'LABEL top',
      'LOAD n',
      'JUMPZ done',
      'LOAD n',
      'PRINT',
      'LOAD n',
      '1',
      'SUB',
      'STORE n',
      'JUMP top',
      'LABEL done',
    ]
      .join('\n',),
    expected: '3\n2\n1',
  },
];

/**
 * Composite test program for the codegen probe.
 * Exercises floor division, floored modulo, PRINTC with Unicode code points, and loops.
 */
export const CODEGEN_TEST_INPUT: string = [
  '-7',
  '2',
  'DIV',
  'PRINT',
  '-7',
  '2',
  'MOD',
  'PRINT',
  '72',
  'PRINTC',
  '105',
  'PRINTC',
  '10',
  'PRINTC',
  '5',
  'STORE n',
  'LABEL loop',
  'LOAD n',
  'JUMPZ done',
  'LOAD n',
  'PRINT',
  'LOAD n',
  '1',
  'SUB',
  'STORE n',
  'JUMP loop',
  'LABEL done',
]
  .join('\n',);

/**
 * Expected stdout from running CODEGEN_TEST_INPUT through a correct Stak interpreter.
 * Breakdown: floor-div=-4, floor-mod=1, PRINTC(72,105,10)="Hi LF", loop prints 5..1.
 *
 * Trailing newline is omitted because nano-spawn strips the final newline from
 * captured stdout (see nano-spawn `getOutput` in source/result.js).
 */
export const CODEGEN_EXPECTED_OUTPUT: string = '-4\n1\nHi\n5\n4\n3\n2\n1';

export { PERF_TEST_INPUT, } from './test-cases-perf.ts';
