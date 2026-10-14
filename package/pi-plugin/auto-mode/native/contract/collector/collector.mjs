import { createHash } from 'node:crypto';

/** Collection errors describe admission evidence, not instruction meaning. */
export class SourceCollectionError extends Error {
  constructor(message) { super(message);
  this.name = 'SourceCollectionError'; }
}
/** Bindings can be made by bootstrap code, never by serialized action metadata. */
const bindings = new WeakMap();
/** Bound the private fixture profile without truncating source content. */
const limits = Object.freeze({
  sourceBytes: 65_536,
  totalBytes: 524_288,
  files: 64,
  appendTexts: 32
});
/** Hash exact captured text, not rendered source labels. */
function digest(value) { return createHash('sha256')
  .update(value)
  .digest('hex'); }
/** Require immutable primitives before retaining a borrowed value. */
function text(
  value,
  label
) {
  if ((typeof value) !== 'string') throw new SourceCollectionError(`${label} must provide text`);
  if (Buffer.byteLength(value) > limits.sourceBytes) throw new SourceCollectionError(`${label} exceeds source byte cap`);
  return value;
}
/** A source path remains metadata; it confers no authority. */
function path(value) {
  if ((value === undefined) || (value === null)) return null;
  return text(
    value.path,
    'Source path'
  );
}
/** Ordinary contexts expose rendered text; arbitrary extra properties are deliberately not inspected. */
export function bindOrdinaryContext(context) {
  if ((typeof context?.getSystemPrompt) !== 'function') throw new SourceCollectionError('Ordinary context has no prompt reader');
  const token = Object.freeze({});
  bindings.set(
    token,
    {
      render: () => context.getSystemPrompt(),
      owner: undefined,
      kind: 'ordinary-context'
    }
  );
  return token;
}
/** Only trusted construction code supplies the resource owner; this is not human authentication. */
export function bindConstructionOwner({
  context,
  owner
}) {
  const token = bindOrdinaryContext(context);
  const names = [
    'getAgentsFiles',
    'getSystemPrompt',
    'getSystemPromptSource',
    'getAppendSystemPrompt',
    'getAppendSystemPromptSources'
  ];
  if (!names.every(name => (typeof owner?.[name]) === 'function')) throw new SourceCollectionError('Construction owner does not expose the required readers');
  bindings.set(
    token,
    {
      render: () => context.getSystemPrompt(),
      owner,
      kind: 'construction-owner'
    }
  );
  return token;
}
/** Copy bounded owner data; do not pair append paths with text by an invented index convention. */
function inventory(owner) {
  if (owner === undefined) return Object.freeze({ availability: 'unavailable' });
  const agents = owner.getAgentsFiles()
    .agentsFiles;
  const appendTexts = owner.getAppendSystemPrompt();
  const appendSources = owner.getAppendSystemPromptSources();
  if ((!Array.isArray(agents)) || (agents.length > limits.files)) throw new SourceCollectionError('Resource file inventory exceeds its profile');
  if ((!Array.isArray(appendTexts)) || (appendTexts.length > limits.appendTexts)) throw new SourceCollectionError('Append text inventory exceeds its profile');
  if ((!Array.isArray(appendSources)) || (appendSources.length > limits.appendTexts)) throw new SourceCollectionError('Append path inventory exceeds its profile');
  const files = Object.freeze(agents.map(file => {
    const content = text(
      file.content,
      'Resource file'
    );
    return Object.freeze({
      path: text(
        file.path,
        'Resource file path'
      ),
      content,
      sha256: digest(content)
    });
  }));
  const system = owner.getSystemPrompt();
  const inline = Object.freeze({
    content: system === undefined ? null : text(
      system,
      'Base prompt'
    ),
    path: path(owner.getSystemPromptSource())
  });
  return Object.freeze({
    availability: 'observed',
    files,
    inline,
    appendTexts: Object.freeze(appendTexts.map(value => text(
      value,
      'Append text'
    ))),
    appendSourcePaths: Object.freeze(appendSources.map(value => path(value))),
    appendTextPathLinks: 'not-established',
  });
}
/** A collector owns copying, bounds, stage distinctions and scoped freshness behind its interface. */
export function createCollector({
  binding,
  readPolicy
}) {
  const adapter = bindings.get(binding);
  if (!adapter) throw new SourceCollectionError('Unrecognized collection binding; data cannot declare capabilities');
  if ((typeof readPolicy) !== 'function') throw new SourceCollectionError('Mandatory policy reader is missing');
  const checkpoints = new WeakMap();
  function observe(signal) {
    if (signal?.aborted) throw new SourceCollectionError('Collection cancelled');
    const policy = readPolicy();
    const policyText = text(
      policy.content,
      'Complete mandatory policy'
    );
    const policyIdentity = text(
      policy.identity,
      'Mandatory policy identity'
    );
    const resources = inventory(adapter.owner);
    const rendered = text(
      adapter.render(),
      'Current rendered prompt'
    );
    const gaps = [
      'run-producer-inventory',
      'final-request-transformations',
      'provider-native-payload'
    ];
    if (resources.availability === 'unavailable') gaps.unshift('base-resource-owner');
    const data = Object.freeze({
      adapter: adapter.kind,
      mandatoryPolicy: Object.freeze({
        identity: policyIdentity,
        content: policyText,
        sha256: digest(policyText)
      }),
      resourceInventory: resources,
      renderedObservation: Object.freeze({
        stage: 'ordinary-context-getter',
        content: rendered,
        sha256: digest(rendered)
      }),
      unqualifiedCoverage: Object.freeze(gaps),
      instructionAuthority: 'not-established',
      humanWitness: 'not-established',
    });
    const serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized) > limits.totalBytes) throw new SourceCollectionError('Collected source evidence exceeds total byte cap');
    if (signal?.aborted) throw new SourceCollectionError('Collection cancelled');
    return {
      data,
      fingerprint: digest(serialized)
    };
  }
  /** The only caller option is cancellation; authority/completeness inputs are rejected. */
  function capture(options = {}) {
    if ((options === null) || ((typeof options) !== 'object')
      || Array.isArray(options)) throw new SourceCollectionError('Collection options must contain only cancellation');
    if ((options.signal !== undefined) && (!(options.signal instanceof AbortSignal))) throw new SourceCollectionError('Cancellation requires an AbortSignal');
    if (Object.keys(options)
      .some(key => key !== 'signal')) throw new SourceCollectionError('Caller cannot supply source authority, inventory or completeness');
    const {
      data,
      fingerprint
    } = observe(options.signal);
    checkpoints.set(
      data,
      fingerprint
    );
    return data;
  }
  /** Recheck only observed inputs. This never removes the recorded coverage gaps. */
  function assertObservedFresh(snapshot) {
    const expected = checkpoints.get(snapshot);
    if (expected === undefined) throw new SourceCollectionError('Snapshot is not owned by this collector');
    if (observe()
      .fingerprint
      !== expected) throw new SourceCollectionError('Observed instruction source changed');
  }
  return Object.freeze({
    capture,
    assertObservedFresh
  });
}
