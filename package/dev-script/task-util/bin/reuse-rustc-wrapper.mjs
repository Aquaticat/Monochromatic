#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Preserve Cargo's rustc protocol exactly while retaining every failed compiler request.
const binary = process.env.REUSE_SCCACHE_BINARY;
const journal = process.env.REUSE_RUSTC_JOURNAL;
if (!binary || !journal) throw new Error('An isolated compiler-cache binary and request journal are required');
const args = process.argv.slice(2);
const startedAt = new Date().toISOString();
const start = performance.now();
const result = spawnSync(binary, args, { env: process.env, maxBuffer: 32 * 1024 * 1024, timeout: 600_000 });
const stderr = result.stderr ?? Buffer.alloc(0);
appendFileSync(journal, JSON.stringify({ startedAt, elapsedSeconds: (performance.now() - start) / 1000, args, exitStatus: result.status, signal: result.signal, error: result.error?.message, stdoutBytes: result.stdout?.length ?? 0, stderrBytes: stderr.length, stderrSha256: createHash('sha256').update(stderr).digest('hex'), failedStderr: result.status === 0 ? null : stderr.toString().slice(0, 32_000) }) + '\n');
if (result.stdout) writeFileSync(1, result.stdout);
if (result.stderr) writeFileSync(2, result.stderr);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
