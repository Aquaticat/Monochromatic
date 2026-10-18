#!/usr/bin/env node
import { writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { evidence, sha } from './reuse-context.mjs';

// Inspect only the experiment's manifest/config. Never retain credentials or arbitrary image environment values.
const origin = 'https://l4zncjjbj5.registry.depot.dev';
const repository = 'research-reuse-20261018';
const tag = process.env.REUSE_IMAGE_TAG ?? 'tools-r1';
assert(['tools-r1', 'tools-r2-git256'].includes(tag));
const expectedDigest = process.env.REUSE_IMAGE_DIGEST ?? 'sha256:9fb974fd32185c8afd5711370869d03e0f28e5b560c928eae324c20151ddeee8';
assert(/^sha256:[a-f0-9]{64}$/u.test(expectedDigest));
const token = process.env.DEPOT_SNAPSHOT_TOKEN;
const proof = { recordedAt: new Date().toISOString(), reference: origin.slice(8) + '/' + repository + ':' + tag, expectedDigest, automaticSnapshotCredentialPresent: Boolean(token), requests: [] };
let manifestVerified = false;

/** Read one named artifact with bounded redirects and no credential forwarding to blob hosts. */
async function get({ path, authorization }) {
  let response = await fetch(origin + path, { headers: { Authorization: authorization, Accept: 'application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json,application/json' }, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  proof.requests.push({ path, status: response.status });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const next = new URL(response.headers.get('location'), origin);
    assert.equal(next.protocol, 'https:');
    assert(next.hostname.endsWith('.amazonaws.com') || next.hostname.endsWith('.cloudflarestorage.com') || next.hostname.endsWith('.depot.dev'));
    response = await fetch(next, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
    proof.requests.push({ redirectedBlobOrigin: next.origin, status: response.status });
  }
  return response;
}

try {
  if (token) {
    const basic = 'Basic ' + Buffer.from('x-token:' + token).toString('base64');
    let authorization = basic;
    const path = '/v2/' + repository + '/manifests/' + tag;
    let response = await get({ path, authorization });
    if (response.status === 401) {
      const challenge = response.headers.get('www-authenticate') ?? '';
      const fields = Object.fromEntries([...challenge.matchAll(/([a-z_]+)="([^"]*)"/gu)].map(match => [match[1], match[2]]));
      assert(challenge.startsWith('Bearer ') && fields.realm && fields.service);
      const realm = new URL(fields.realm);
      assert.equal(realm.protocol, 'https:');
      assert(realm.hostname === 'depot.dev' || realm.hostname.endsWith('.depot.dev'));
      realm.searchParams.set('service', fields.service);
      realm.searchParams.set('scope', 'repository:' + repository + ':pull');
      realm.searchParams.set('client_id', 'monochromatic-reuse-research');
      const exchange = await fetch(realm, { headers: { Authorization: basic }, redirect: 'error', signal: AbortSignal.timeout(30_000) });
      proof.requests.push({ tokenExchangeOrigin: realm.origin, requestedScope: 'repository:' + repository + ':pull', status: exchange.status });
      assert.equal(exchange.status, 200);
      const credentials = await exchange.json();
      const bearer = credentials.token ?? credentials.access_token;
      assert(typeof bearer === 'string' && bearer.length > 0);
      authorization = 'Bearer ' + bearer;
      response = await get({ path, authorization });
    }
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length <= 1024 * 1024);
    proof.digest = 'sha256:' + sha(bytes);
    assert.equal(proof.digest, expectedDigest);
    manifestVerified = true;
    const manifest = JSON.parse(bytes.toString());
    proof.manifest = manifest;
    const configResponse = await get({ path: '/v2/' + repository + '/blobs/' + manifest.config.digest, authorization });
    assert.equal(configResponse.status, 200);
    const configBytes = Buffer.from(await configResponse.arrayBuffer());
    assert(configBytes.length <= 16 * 1024 * 1024);
    assert.equal('sha256:' + sha(configBytes), manifest.config.digest);
    const config = JSON.parse(configBytes.toString());
    proof.config = { digest: manifest.config.digest, bytes: configBytes.length, topLevelKeys: Object.keys(config), unmaskedSyntheticValuePresent: configBytes.includes(Buffer.from('synthetic-public-environment-20261018-r1')), maskedSyntheticValuePresent: configBytes.includes(Buffer.from('synthetic-masked-environment-20261018-r1')) };
  }
} catch (error) {
  proof.failure = String(error);
} finally {
  writeFileSync(join(evidence, 'snapshot-registry-manifest.json'), JSON.stringify(proof, null, 2) + '\n');
  appendFileSync(join(evidence, 'snapshot-registry-manifest.jsonl'), JSON.stringify(proof) + '\n');
  console.log(JSON.stringify({ automaticSnapshotCredentialPresent: proof.automaticSnapshotCredentialPresent, digest: proof.digest ?? null, failure: proof.failure ?? null }));
  assert(manifestVerified, 'The snapshot manifest must match its independent harness-bound digest before consumption');
}
