import { file, write } from "bun";
import { join } from "node:path";
import { json } from "node:stream/consumers";

// 1. Parse OpenTofu Input (from stdin)
const input = await json(process.stdin) as Record<string, string>;
const TARGET_ASN = input.asn?.toUpperCase();

if (!TARGET_ASN) {
  console.error("No ASN provided");
  process.exit(1);
}

const CACHE_FILE = join(import.meta.dirname, `cache_${TARGET_ASN}.json`);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const URL = `https://ipinfo.io/data/ipinfo_lite.json.gz?_src=frontend&token=${process.env.IPINFO_TOKEN}`;

async function run() {
  const cacheFile = file(CACHE_FILE);

  // Check Cache
  if (await cacheFile.exists()) {
    const stats = await cacheFile.lastModified;
    if (Date.now() - stats < THIRTY_DAYS_MS) {
      process.stdout.write(JSON.stringify({ ips: await cacheFile.text() }));
      return;
    }
  }

  // Stream & Filter (Memory-only)
  try {
    const response = await fetch(URL);
    const stream = response.body!.pipeThrough(new DecompressionStream("gzip"));
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    let ips: string[] = [];
    let leftover = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = leftover + decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      leftover = lines.pop() || "";

      for (const line of lines) {
        // Optimized check: string search before JSON.parse
        if (line.includes(`"asn": "${TARGET_ASN}"`)) {
          const entry = JSON.parse(line);
          ips.push(entry.network);
        }
      }
    }

    const result = ips.join(",");
    await write(CACHE_FILE, result);
    process.stdout.write(JSON.stringify({ ips: result }));

  } catch (e) {
    // Fallback to expired cache if download fails
    if (await cacheFile.exists()) {
      process.stdout.write(JSON.stringify({ ips: await cacheFile.text() }));
    } else {
      process.exit(1);
    }
  }
}

run();
