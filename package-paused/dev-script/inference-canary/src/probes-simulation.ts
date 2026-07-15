/**
 * Simulation probe exports.
 *
 * Simulation probes give the model an interpreter source file and ask it to trace
 * program execution without running code. Unlike code-gen probes, they produce no
 * artifacts for linting; scoring is pure text match.
 */
import { stakSimulation, } from './simulation/stak-simulation.ts';

import type { Probe, } from './probes.ts';

/**
 * All simulation probes
 */
export const simulationProbes: readonly Probe[] = [
  stakSimulation,
];
