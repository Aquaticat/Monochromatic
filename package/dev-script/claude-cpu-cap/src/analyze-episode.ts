// Stats for a sustained-load episode: the sample rows between two UTC times, read-only.
// Usage: node analyze-episode.ts <from-utc> <to-utc> [local-date, default today]
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [from, to] = [process.argv[2]!, process.argv[3]!];
const day = process.argv[4] ?? new Date().toLocaleDateString('sv');
const lines = readFileSync(join(homedir(), '.local', 'share', 'claude-cpu-cap', 'samples', `${day}.csv`), 'utf8').trim().split('\n');
const header = lines[0]!.split(',');
const rows = lines.slice(1).map((line) => line.split(',')).filter((row) => row[0]! >= from && row[0]! <= to);
const col = (name: string): number[] => rows.map((row) => Number(row[header.indexOf(name)]));
const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
console.log('rows', rows.length, from, to);
for (const name of ['tctl_c', 'tccd1_c', 'tccd2_c', 'package_w', 'average_mhz', 'cpu_pressure_some_avg10', 'load1', 'fan1_rpm', 'fan2_rpm', 'fan4_rpm', 'fan5_rpm', 'fan6_rpm', 'corsair_probe_c', 'chiplet1_w', 'chiplet2_w', 'board3_c', 'board5_c', 'nvme_c']) {
  const values = col(name);
  console.log(name.padEnd(24), 'median', median(values), 'min', Math.min(...values), 'max', Math.max(...values));
}
