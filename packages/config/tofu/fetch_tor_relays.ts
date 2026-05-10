import { existsSync, } from 'node:fs';
import {
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { json, } from 'node:stream/consumers';

// 1. Consume OpenTofu input (data.external sends {}; we ignore it)
await json(process.stdin,);

const CACHE_FILE = join(
  import.meta.dirname,
  'cache_tor_relays.json',
);
const ONE_HOUR_MS = 60 * 60 * 1_000;
// Onionoo's `flag` query accepts only a single value; Guard alone is fine
// because guards must be Stable to earn the flag in the first place.
const URL =
  'https://onionoo.torproject.org/details?type=relay&running=true&flag=Guard&fields=or_addresses&order=-consensus_weight&limit=500';

async function run() {
  // Check cache
  if (existsSync(CACHE_FILE,)) {
    const stats = await stat(CACHE_FILE,);
    if (Date.now() - stats.mtimeMs < ONE_HOUR_MS) {
      process.stdout.write(
        JSON.stringify({ ips: await readFile(
          CACHE_FILE,
          'utf8',
        ), },),
      );
      return;
    }
  }

  // Fetch & filter to ORPort 443 only.
  // Single-port rules keep the firewall's effective-rule count predictable
  // (one rule per IP regardless of port count) and consolidate with the
  // existing port-443 outbound posture.
  try {
    const response = await fetch(URL,);
    const data = await response.json() as { relays: { or_addresses: string[]; }[]; };

    const ips: string[] = [];
    for (const relay of data.relays) {
      for (const addr of relay.or_addresses) {
        if (addr.startsWith('[',) && addr.endsWith(']:443',)) {
          // IPv6: [2001:db8::1]:443
          ips.push(`${
            addr.slice(
              1,
              addr.indexOf(']',),
            )
          }/128`,);
        }
        else if (addr.endsWith(':443',) && !addr.startsWith('[',)) {
          // IPv4: 1.2.3.4:443
          ips.push(`${addr.split(':',)[0]}/32`,);
        }
      }
    }

    const result = ips.join(',',);
    await writeFile(
      CACHE_FILE,
      result,
    );
    process.stdout.write(JSON.stringify({ ips: result, },),);
  }
  catch {
    // Fallback to expired cache if download fails
    if (existsSync(CACHE_FILE,)) {
      process.stdout.write(
        JSON.stringify({ ips: await readFile(
          CACHE_FILE,
          'utf8',
        ), },),
      );
    }
    else {
      throw new Error('fetch failed and no cached fallback available',);
    }
  }
}

run();
