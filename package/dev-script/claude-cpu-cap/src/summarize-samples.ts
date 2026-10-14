// Summarizes the watcher's sample log as Tctl per package-power bucket, counting only settled samples:
// a sample counts when the previous `settledSamples` samples (2 minutes at 10 seconds each) were all in the same bucket.
// Usage: node summarize-samples.ts [days-back, default 1]
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const sampleDir = join(homedir(), '.local', 'share', 'claude-cpu-cap', 'samples');
const bucketWatts = 20;
const settledSamples = 12;
const daysBack = Number(process.argv[2] ?? 1);

type Row = { time: string; tctl: number; watts: number; mhz: number };
const rows: Row[] = [];
const cutoff = Date.now() - daysBack * 86_400_000;
for (const name of readdirSync(sampleDir).sort()) {
  if (!name.endsWith('.csv')) continue;
  for (const line of readFileSync(join(sampleDir, name), 'utf8').split('\n').slice(1)) {
    const [time, tctl, , , watts, mhz] = line.split(',');
    if (time === undefined || watts === undefined || tctl === undefined || watts === '' || tctl === '') continue;
    if (Date.parse(time) < cutoff) continue;
    rows.push({ time, tctl: Number(tctl), watts: Number(watts), mhz: Number(mhz) });
  }
}

const bucketOf = ({ watts }: { watts: number }): number => Math.floor(watts / bucketWatts) * bucketWatts;
const byBucket = new Map<number, number[]>();
for (let index = settledSamples; index < rows.length; index += 1) {
  const bucket = bucketOf({ watts: rows[index]!.watts });
  let settled = true;
  for (let back = 1; back <= settledSamples; back += 1) {
    if (bucketOf({ watts: rows[index - back]!.watts }) !== bucket) settled = false;
  }
  if (!settled) continue;
  byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), rows[index]!.tctl]);
}

const percentile = ({ sorted, fraction }: { sorted: number[]; fraction: number }): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
console.log(`samples read: ${rows.length}; settled = ${settledSamples} previous samples in the same ${bucketWatts} W bucket`);
for (const [bucket, temps] of [...byBucket.entries()].sort((a, b) => a[0] - b[0])) {
  const sorted = [...temps].sort((a, b) => a - b);
  console.log(
    `${bucket}-${bucket + bucketWatts} W: ${sorted.length} settled samples, ` +
      `Tctl median ${percentile({ sorted, fraction: 0.5 })}, p90 ${percentile({ sorted, fraction: 0.9 })}, max ${sorted.at(-1)}`,
  );
}
if (byBucket.size === 0) console.log('no settled samples yet; keep the watcher running through some sustained load');
