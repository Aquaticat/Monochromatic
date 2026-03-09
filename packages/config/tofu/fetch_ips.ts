import { file, write } from "bun";
import { join } from "node:path";

// 1. Parse OpenTofu Input (from stdin)
const input = await Bun.stdin.json();
const TARGET_ASN = input.asn?.toUpperCase();

if (!TARGET_ASN) {
  throw new Error("No ASN provided");
}

const CACHE_FILE = join(import.meta.dir, `cache_${TARGET_ASN}.json`);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1_000;
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
    if (response.body === null) throw new Error("Response body is null");
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const ips: string[] = [];
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

  } catch {
    // Fallback to expired cache if download fails
    if (await cacheFile.exists()) {
      process.stdout.write(JSON.stringify({ ips: await cacheFile.text() }));
    } else {
      throw new Error("Download failed and no cached data available");
    }
  }
}

run();
