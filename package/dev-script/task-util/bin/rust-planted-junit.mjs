import { strict as assert } from 'node:assert';

//region Retain actual Rust case identities when translating Nextest's JUnit for existing owner parsers
export function parseCases(xml) {
  const cases = [];
  for (const match of xml.matchAll(/<testcase\b([^>]*)(?:\/>|>([\s\S]*?)<\/testcase>)/gu)) {
    const name = /\bname="([^"]+)"/u.exec(match[1])?.[1];
    assert(name && /^[A-Za-z0-9_:]+$/u.test(name), 'Only actual Rust identifier test names may enter the owner parser');
    const body = match[2] ?? '';
    const status = /<(?:failure|error)\b/u.test(body) ? 'FAILED' : /<skipped\b/u.test(body) ? 'ignored' : 'ok';
    cases.push({ name, status });
  }
  return cases;
}
//endregion
