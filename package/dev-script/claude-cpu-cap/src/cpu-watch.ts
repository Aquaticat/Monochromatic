// Persistent guard for Claude sessions' CPU use, run as the user unit `claude-cpu-watch.service`.
// 1. Reconciles the `claude-code-bash` cgroup quota to the thread count in `~/.config/claude-cpu-cap/threads`
//    (Claude Code recreates that cgroup in every boot and has no CPU limit setting of its own).
// 2. Prints one line per alert or recovery when the system degrades; routine samples are never printed.
// Test the alert path with e.g. `CPU_WATCH_LIMIT_CPU_SOME=0 node cpu-watch.ts`.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const intervalMs = 2000;
const periodUsec = 100_000;
const defaultThreads = 30;
const badAfterSamples = 3;
const clearAfterSamples = 5;
const totalThreads = cpus().length;
const capFile = join(homedir(), '.config', 'claude-cpu-cap', 'threads');
const cgroupFile = `/sys/fs/cgroup/user.slice/user-${process.getuid?.() ?? 1000}.slice/user@${process.getuid?.() ?? 1000}.service/app.slice/claude-code-bash/cpu.max`;

function limitFromEnv({ name, fallback }: { name: string; fallback: number }): number {
  const raw = process.env[`CPU_WATCH_LIMIT_${name}`];
  return raw === undefined ? fallback : Number(raw);
}

// Each metric is "bad" at or above its limit.
const limits = {
  'cpu-pressure-some-avg10': limitFromEnv({ name: 'CPU_SOME', fallback: 40 }),
  'memory-pressure-some-avg10': limitFromEnv({ name: 'MEMORY_SOME', fallback: 10 }),
  // Zen 4 is designed to sit at its 95 degree target under sustained load and to lower clocks to stay there, so a
  // 95 degree reading alone is normal (TechPowerUp, Ryzen 9 7950X cooling requirements). The user decided on
  // 2026-10-13 to alert on throttling instead: Tctl at or above the target AND the average clock at least this many
  // MHz below the boost-off clock. 300 sits above everything seen while the chip regulated at 95 degrees for 8 minutes
  // at 133 W (125 samples: shortfall median 83, p99 221, max 255); 100 flapped on that normal regulation (2026-10-13).
  'cpu-thermal-throttle-mhz': limitFromEnv({ name: 'THROTTLE_MHZ', fallback: 300 }),
  'scheduler-lag-ms': limitFromEnv({ name: 'LAG', fallback: 250 }),
};
type Metric = keyof typeof limits;
const thermalTargetCelsius = limitFromEnv({ name: 'TEMP', fallback: 95 });
// Clock the 7950X holds on all busy cores with boost disabled (observed 4477 to 4494 MHz in the sample log).
const boostOffMhz = limitFromEnv({ name: 'BOOST_OFF_MHZ', fallback: 4490 });

function readPressure({ file, kind }: { file: string; kind: 'some' | 'full' }): number {
  const text = readFileSync(file, 'utf8');
  const line = text.split('\n').find((candidate) => candidate.startsWith(`${kind} `));
  const match = /avg10=([\d.]+)/.exec(line ?? '');
  if (match?.[1] === undefined) throw new Error(`no ${kind} avg10 in ${file}`);
  return Number(match[1]);
}

function findTemperatureFile(): string | undefined {
  for (const entry of readdirSync('/sys/class/hwmon')) {
    const dir = join('/sys/class/hwmon', entry);
    if (readFileSync(join(dir, 'name'), 'utf8').trim() === 'k10temp') return join(dir, 'temp1_input');
  }
  return undefined;
}

function desiredThreads(): number {
  if (!existsSync(capFile)) return defaultThreads;
  const parsed = Number.parseInt(readFileSync(capFile, 'utf8').trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > totalThreads) {
    console.log(`CAP-FILE-INVALID ${capFile} must hold an integer from 1 to ${totalThreads}; using ${defaultThreads}`);
    return defaultThreads;
  }
  return parsed;
}

let lastReportedCap = '';
function reconcileCap(): string {
  const threads = desiredThreads();
  const wanted = `${threads * periodUsec} ${periodUsec}`;
  if (!existsSync(cgroupFile)) return `${threads} (cgroup absent)`;
  const current = readFileSync(cgroupFile, 'utf8').trim();
  if (current !== wanted) {
    writeFileSync(cgroupFile, wanted);
    console.log(`CAP-APPLIED claude-code-bash cpu.max "${current}" -> "${wanted}" (${threads} of ${totalThreads} threads)`);
  }
  lastReportedCap = `${threads}`;
  return `${threads}`;
}

// Alert context: package power from the zenergy socket energy counter, and the average clock.
// Fan speed is not reported: the only hwmon fan sensor is the GPU's, and the case and CPU fans sit behind a Corsair controller.
function findSocketEnergyFile(): string | undefined {
  for (const entry of readdirSync('/sys/class/hwmon')) {
    const dir = join('/sys/class/hwmon', entry);
    if (readFileSync(join(dir, 'name'), 'utf8').trim() !== 'zenergy') continue;
    for (const file of readdirSync(dir)) {
      const label = /^(energy\d+)_label$/.exec(file)?.[1];
      if (label !== undefined && readFileSync(join(dir, file), 'utf8').trim() === 'Esocket0') {
        return join(dir, `${label}_input`);
      }
    }
  }
  return undefined;
}

// Per-core energy counters (labels Ecore000 to Ecore015), indexed by core number; cores 0 to 7 are read as the first
// chiplet and 8 to 15 as the second, which the logged chiplet temperatures can confirm or refute.
function findCoreEnergyFiles(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync('/sys/class/hwmon')) {
    const dir = join('/sys/class/hwmon', entry);
    if (readFileSync(join(dir, 'name'), 'utf8').trim() !== 'zenergy') continue;
    for (const file of readdirSync(dir)) {
      const label = /^(energy\d+)_label$/.exec(file)?.[1];
      const core = /^Ecore(\d{3})$/.exec(label === undefined ? '' : readFileSync(join(dir, file), 'utf8').trim())?.[1];
      if (label !== undefined && core !== undefined) files[Number(core)] = join(dir, `${label}_input`);
    }
  }
  return files;
}

function findHwmonDir({ driver }: { driver: string }): string | undefined {
  for (const entry of readdirSync('/sys/class/hwmon')) {
    const dir = join('/sys/class/hwmon', entry);
    if (readFileSync(join(dir, 'name'), 'utf8').trim() === driver) return dir;
  }
  return undefined;
}

const socketEnergyFile = findSocketEnergyFile();
const coreEnergyFiles = findCoreEnergyFiles();
let previousEnergy: { microjoules: number; at: number } | undefined;
let previousCoreEnergy: { microjoules: number[]; at: number } | undefined;
let lastWatts: number | undefined;
let lastChipletWatts: [number, number] | undefined;
let lastMhz: number | undefined;
function describeHardware(): string {
  const parts: string[] = [];
  lastWatts = undefined;
  lastChipletWatts = undefined;
  lastMhz = undefined;
  if (coreEnergyFiles.length === 16) {
    const microjoules = coreEnergyFiles.map((file) => Number(readFileSync(file, 'utf8')));
    const at = performance.now();
    if (previousCoreEnergy !== undefined && microjoules.every((value, core) => value >= (previousCoreEnergy?.microjoules[core] ?? Infinity))) {
      const seconds = (at - previousCoreEnergy.at) / 1000;
      const watts = (cores: number[]): number => cores.reduce((sum, core) => sum + (microjoules[core]! - previousCoreEnergy!.microjoules[core]!), 0) / (seconds * 1_000_000);
      lastChipletWatts = [watts([0, 1, 2, 3, 4, 5, 6, 7]), watts([8, 9, 10, 11, 12, 13, 14, 15])];
    }
    previousCoreEnergy = { microjoules, at };
  }
  if (socketEnergyFile !== undefined) {
    const microjoules = Number(readFileSync(socketEnergyFile, 'utf8'));
    const at = performance.now();
    if (previousEnergy !== undefined && microjoules >= previousEnergy.microjoules) {
      lastWatts = (microjoules - previousEnergy.microjoules) / ((at - previousEnergy.at) * 1000);
      parts.push(`package ${lastWatts.toFixed(0)} W`);
    }
    previousEnergy = { microjoules, at };
  }
  const clocks = [...readFileSync('/proc/cpuinfo', 'utf8').matchAll(/^cpu MHz\s+:\s+([\d.]+)/gm)].map((match) => Number(match[1]));
  if (clocks.length > 0) {
    lastMhz = Math.round(clocks.reduce((sum, mhz) => sum + mhz, 0) / clocks.length);
    parts.push(`average clock ${lastMhz} MHz`);
  }
  return parts.join(', ');
}

// Sample log: one CSV line every `sampleEveryIterations` loop passes, one file per local day, kept for 14 days.
// Times are UTC. Used to judge steady-state temperature at a given power instead of alert-time peaks.
const sampleDir = join(homedir(), '.local', 'share', 'claude-cpu-cap', 'samples');
const sampleEveryIterations = 5;
const sampleRetentionDays = 14;
const sampleHeader =
  'utc_time,tctl_c,tccd1_c,tccd2_c,package_w,average_mhz,cpu_pressure_some_avg10,load1,cap_threads,' +
  'fan1_rpm,fan2_rpm,fan3_rpm,fan4_rpm,fan5_rpm,fan6_rpm,corsair_probe_c,' +
  'chiplet1_w,chiplet2_w,board1_c,board2_c,board3_c,board4_c,board5_c,board6_c,acpi_c,nvme_c,burst,' +
  'gpu_edge_c,gpu_w,igpu_edge_c,igpu_w\n';
const tokenFile = process.env['CPU_WATCH_TOKEN_FILE'] ?? join(homedir(), '.config', 'claude-cpu-cap', 'cc-token');
const statusUrl = 'http://127.0.0.1:11987/status';
let fanReadFailing = false;

// Reads the Corsair controller's fan RPMs and probe temperature through the local CoolerControl API with a bearer token.
// Returns empty fields when the token file is absent or rejected (for example after rotation); reports the change once.
async function readCorsairFields(): Promise<string[]> {
  const empty = ['', '', '', '', '', '', ''];
  if (!existsSync(tokenFile)) return empty;
  try {
    const response = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${readFileSync(tokenFile, 'utf8').trim()}` },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`CoolerControl status HTTP ${response.status}`);
    const body = (await response.json()) as {
      devices: { type: string; status_history: { temps?: { name: string; temp: number }[]; channels?: { name: string; rpm?: number }[] }[] }[];
    };
    const corsair = body.devices.find((device) => device.type === 'Liquidctl' && (device.status_history.at(-1)?.channels ?? []).some((channel) => channel.name === 'fan1'));
    const latest = corsair?.status_history.at(-1);
    if (latest === undefined) throw new Error('no Corsair fan channels in the CoolerControl status');
    if (fanReadFailing) console.log('FAN-READ-RECOVERED CoolerControl fan speeds are being recorded again');
    fanReadFailing = false;
    return [
      ...['fan1', 'fan2', 'fan3', 'fan4', 'fan5', 'fan6'].map((name) => String(latest.channels?.find((channel) => channel.name === name)?.rpm ?? '')),
      String(latest.temps?.[0]?.temp ?? ''),
    ];
  } catch (error) {
    if (!fanReadFailing) console.log(`FAN-READ-FAILED ${String(error)}; fan columns stay empty until the token at ${tokenFile} works`);
    fanReadFailing = true;
    return empty;
  }
}
let sampleDay = '';
const boardDir = findHwmonDir({ driver: 'gigabyte_wmi' });
const acpiDir = findHwmonDir({ driver: 'acpitz' });
const nvmeDir = findHwmonDir({ driver: 'nvme' });
// Two amdgpu devices exist: the discrete card (has a fan input, reports power1_average) and the CPU's integrated
// graphics (no fan, reports power1_input). Their heat reaches the case air (card) or the package (integrated).
const amdgpuDirs = readdirSync('/sys/class/hwmon')
  .map((entry) => join('/sys/class/hwmon', entry))
  .filter((dir) => readFileSync(join(dir, 'name'), 'utf8').trim() === 'amdgpu');
const gpuDir = amdgpuDirs.find((dir) => existsSync(join(dir, 'fan1_input')));
const igpuDir = amdgpuDirs.find((dir) => !existsSync(join(dir, 'fan1_input')));
function readMicroWatts({ file }: { file: string }): string {
  return existsSync(file) ? (Number(readFileSync(file, 'utf8')) / 1_000_000).toFixed(1) : '';
}
// While package power steps by more than `burstStepWatts` between two passes, samples are written on every pass
// (2 seconds) for `burstMs`, because the first seconds after a load step show the die-to-heatsink path best.
const burstStepWatts = limitFromEnv({ name: 'BURST_STEP_W', fallback: 25 });
const burstMs = 90_000;
let burstUntil = 0;
let previousPassWatts: number | undefined;
function readMilliCelsius({ file }: { file: string }): string {
  return existsSync(file) ? (Number(readFileSync(file, 'utf8')) / 1000).toFixed(1) : '';
}

function pruneSamples(): void {
  const cutoff = Date.now() - sampleRetentionDays * 86_400_000;
  for (const name of readdirSync(sampleDir)) {
    const day = /^(\d{4}-\d{2}-\d{2})\.csv$/.exec(name)?.[1];
    if (day !== undefined && Date.parse(`${day}T00:00:00`) < cutoff) rmSync(join(sampleDir, name));
  }
}

async function writeSample({ cap }: { cap: string }): Promise<void> {
  const today = new Date().toLocaleDateString('sv');
  mkdirSync(sampleDir, { recursive: true });
  const file = join(sampleDir, `${today}.csv`);
  if (today !== sampleDay) {
    sampleDay = today;
    pruneSamples();
  }
  if (!existsSync(file)) {
    appendFileSync(file, sampleHeader);
  } else {
    // Rows written before the fan columns existed keep their length; only the header line is brought up to date.
    const lines = readFileSync(file, 'utf8').split('\n');
    if (`${lines[0]}\n` !== sampleHeader) writeFileSync(file, [sampleHeader.trimEnd(), ...lines.slice(1)].join('\n'));
  }
  const corsairFields = await readCorsairFields();
  const tempDir = temperatureFile === undefined ? undefined : dirname(temperatureFile);
  const fields = [
    new Date().toISOString(),
    tempDir === undefined ? '' : readMilliCelsius({ file: join(tempDir, 'temp1_input') }),
    tempDir === undefined ? '' : readMilliCelsius({ file: join(tempDir, 'temp3_input') }),
    tempDir === undefined ? '' : readMilliCelsius({ file: join(tempDir, 'temp4_input') }),
    lastWatts === undefined ? '' : lastWatts.toFixed(1),
    lastMhz === undefined ? '' : String(lastMhz),
    readPressure({ file: '/proc/pressure/cpu', kind: 'some' }).toFixed(1),
    readFileSync('/proc/loadavg', 'utf8').split(' ')[0] ?? '',
    cap,
    ...corsairFields,
    lastChipletWatts === undefined ? '' : lastChipletWatts[0].toFixed(1),
    lastChipletWatts === undefined ? '' : lastChipletWatts[1].toFixed(1),
    // Unlabeled motherboard sensors are logged raw; which of them tracks case or CPU-socket temperature is for the data to show.
    ...[1, 2, 3, 4, 5, 6].map((index) => (boardDir === undefined ? '' : readMilliCelsius({ file: join(boardDir, `temp${index}_input`) }))),
    acpiDir === undefined ? '' : readMilliCelsius({ file: join(acpiDir, 'temp1_input') }),
    nvmeDir === undefined ? '' : readMilliCelsius({ file: join(nvmeDir, 'temp1_input') }),
    performance.now() < burstUntil ? '1' : '0',
    gpuDir === undefined ? '' : readMilliCelsius({ file: join(gpuDir, 'temp1_input') }),
    gpuDir === undefined ? '' : readMicroWatts({ file: join(gpuDir, 'power1_average') }),
    igpuDir === undefined ? '' : readMilliCelsius({ file: join(igpuDir, 'temp1_input') }),
    igpuDir === undefined ? '' : readMicroWatts({ file: join(igpuDir, 'power1_input') }),
  ];
  appendFileSync(file, `${fields.join(',')}\n`);
}

let hardwareDetail = '';
const streak = new Map<Metric, { bad: number; good: number; alerting: boolean }>();
function update({ metric, value, cap }: { metric: Metric; value: number; cap: string }): void {
  const state = streak.get(metric) ?? { bad: 0, good: 0, alerting: false };
  const isBad = value >= limits[metric];
  state.bad = isBad ? state.bad + 1 : 0;
  state.good = isBad ? 0 : state.good + 1;
  if (!state.alerting && state.bad >= badAfterSamples) {
    state.alerting = true;
    console.log(
      `ALERT ${metric}=${value.toFixed(1)} (limit ${limits[metric]}), cap ${cap} threads; ` +
        `${hardwareDetail}; to tone down write ${Math.max(1, Number(cap) - 2)} to ${capFile}`,
    );
  } else if (state.alerting && state.good >= clearAfterSamples) {
    state.alerting = false;
    console.log(`CLEAR ${metric}=${value.toFixed(1)} (limit ${limits[metric]}), cap ${cap} threads`);
  }
  streak.set(metric, state);
}

process.on('SIGTERM', () => {
  console.log('WATCHER-STOPPED claude-cpu-watch received SIGTERM; no alerts until it restarts');
  process.exit(0);
});

const temperatureFile = findTemperatureFile();
console.log(`WATCHER-STARTED limits ${JSON.stringify(limits)} temperature ${temperatureFile ?? 'unavailable'}`);
let previous = performance.now();
let iteration = 0;
for (;;) {
  await sleep(intervalMs);
  iteration += 1;
  const now = performance.now();
  const lagMs = Math.max(0, now - previous - intervalMs);
  previous = now;
  try {
    const cap = reconcileCap();
    hardwareDetail = describeHardware();
    update({ metric: 'scheduler-lag-ms', value: lagMs, cap });
    update({ metric: 'cpu-pressure-some-avg10', value: readPressure({ file: '/proc/pressure/cpu', kind: 'some' }), cap });
    update({ metric: 'memory-pressure-some-avg10', value: readPressure({ file: '/proc/pressure/memory', kind: 'some' }), cap });
    // IO pressure is deliberately not watched: the user's drives are slow and nothing can be done about it (2026-10-13).
    if (temperatureFile !== undefined && lastMhz !== undefined) {
      const celsius = Number(readFileSync(temperatureFile, 'utf8')) / 1000;
      // Shortfall counts only while Tctl is at the target, so idle cores' low clocks never raise the alert.
      const shortfallMhz = celsius >= thermalTargetCelsius ? Math.max(0, boostOffMhz - lastMhz) : 0;
      hardwareDetail = `Tctl ${celsius.toFixed(1)}, ${hardwareDetail}`;
      update({ metric: 'cpu-thermal-throttle-mhz', value: shortfallMhz, cap });
    }
    if (lastWatts !== undefined) {
      if (previousPassWatts !== undefined && Math.abs(lastWatts - previousPassWatts) > burstStepWatts) burstUntil = performance.now() + burstMs;
      previousPassWatts = lastWatts;
    }
    if (iteration % sampleEveryIterations === 0 || performance.now() < burstUntil) await writeSample({ cap });
  } catch (error) {
    console.log(`WATCHER-ERROR ${String(error)} (cap last seen ${lastReportedCap})`);
  }
}
