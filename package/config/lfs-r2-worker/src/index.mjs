// Minimal Git LFS Batch API server backed by Cloudflare R2 (binding `BUCKET`).
//
// Downloads are anonymous so public `git clone` / `git lfs pull` work with no
// credentials in the repo. Uploads require the LFS_WRITE_TOKEN secret, supplied
// by git-lfs as HTTP Basic auth (any username, password = the token). Objects
// are stored under their 64-hex sha256 oid as the R2 key, matching the oids
// git-lfs sends in the batch request.
//
// Protocol reference: https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md

const LFS_JSON = 'application/vnd.git-lfs+json';

// region helpers

/**
 * True when `value` is a git-lfs object id: exactly 64 lowercase hex chars.
 * Implemented without a regex so the worker carries no backtracking surface and
 * satisfies the repo's no-unguarded-regex rule.
 * @param value - Candidate path segment to classify.
 * @returns Whether `value` is a well-formed sha256 oid.
 * @example
 * isOid('a'.repeat(64)) // true
 * isOid('objects') // false
 */
function isOid(value) {
  if (value.length !== 64) {
    return false;
  }
  for (const ch of value) {
    const hexDigit = ((ch >= '0') && (ch <= '9')) || ((ch >= 'a') && (ch <= 'f'));
    if (!hexDigit) {
      return false;
    }
  }
  return true;
}

/**
 * Whether the request carries the upload token via HTTP Basic auth.
 * git-lfs sends `Authorization: Basic base64(user:token)`; only the password
 * half is checked against the secret, so the username is free-form.
 * @param request - Inbound request whose Authorization header is inspected.
 * @param env - Worker env; `LFS_WRITE_TOKEN` is the shared upload secret.
 * @returns Whether the caller is allowed to write objects.
 * @example
 * authorized(req, { LFS_WRITE_TOKEN: 's3cr3t' })
 */
function authorized(
  request,
  env
) {
  const token = env.LFS_WRITE_TOKEN;
  if (!token) {
    return false;
  }
  const header = request.headers
    .get('Authorization')
    ?? '';
  if (!header.startsWith('Basic ')) {
    return false;
  }
  const decoded = atob(header.slice('Basic '.length));
  const password = decoded.slice(decoded.indexOf(':') + 1);
  return password === token;
}

/**
 * Build a git-lfs JSON response with the protocol content type.
 * @param body - Value serialized as the batch response payload.
 * @param status - HTTP status code to return.
 * @returns Response carrying `body` as git-lfs JSON.
 * @example
 * lfsJson({ objects: [] }, 200)
 */
function lfsJson(
  body,
  status
) {
  return new Response(
    JSON.stringify(body),
    {
    status,
    headers: { 'Content-Type': LFS_JSON },
  }
  );
}

// endregion

// region handlers

/**
 * Resolve a git-lfs batch request into per-object download or upload actions.
 * Missing objects on download return a per-object 404 error; already-present
 * objects on upload return no action so git-lfs skips re-uploading them.
 * @param request - Batch POST whose JSON body lists the requested objects.
 * @param env - Worker env exposing the R2 `BUCKET` binding and upload secret.
 * @param url - Parsed request URL, used to derive absolute object hrefs.
 * @returns git-lfs batch response enumerating actions for each object.
 * @throws When the body is not valid JSON.
 * @example
 * handleBatch(req, env, new URL(req.url))
 */
async function handleBatch(
  request,
  env,
  url
) {
  const payload = await request.json();
  const {operation} = payload;
  const objects = payload.objects ?? [];

  if ((operation === 'upload') && (!authorized(
    request,
    env
  ))) {
    return new Response(
      'Unauthorized',
      {
      status: 401,
      headers: { 'LFS-Authenticate': 'Basic realm="monochromatic-lfs"' },
    }
    );
  }

  const results = await Promise.all(
    objects.map(async ({
      oid,
      size
    }) => {
      const href = `${url.origin}/${oid}`;
      const head = await env.BUCKET
        .head(oid);
      if (operation === 'upload') {
        if (head) {
          return {
            oid,
            size
          };
        }
        return {
          oid,
          size,
          actions: {
            upload: {
              href,
              header: { Authorization: request.headers
                .get('Authorization') },
            },
          },
        };
      }
      if (!head) {
        return {
          oid,
          size,
          error: {
            code: 404,
            message: 'Object not found'
          }
        };
      }
      return {
        oid,
        size,
        actions: { download: { href } }
      };
    }),
  );

  return lfsJson(
    {
      transfer: 'basic',
      objects: results
    },
    200
  );
}

/**
 * Stream a stored object back to the caller, or 404 when absent.
 * @param oid - sha256 object id used as the R2 key.
 * @param env - Worker env exposing the R2 `BUCKET` binding.
 * @returns Response streaming the object bytes, or a 404.
 * @example
 * getObject('a'.repeat(64), env)
 */
async function getObject(
  oid,
  env
) {
  const object = await env.BUCKET
    .get(oid);
  if (!object) {
    return new Response(
      'Not found',
      { status: 404 }
    );
  }
  return new Response(
    object.body,
    {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(object.size),
    },
  }
  );
}

/**
 * Store an uploaded object under its oid after checking the upload token.
 * @param oid - sha256 object id used as the R2 key.
 * @param request - Upload PUT whose body is the object bytes.
 * @param env - Worker env exposing the R2 `BUCKET` binding and upload secret.
 * @returns Empty 200 on success, or 401 when unauthorized.
 * @example
 * putObject('a'.repeat(64), req, env)
 */
async function putObject(
  oid,
  request,
  env
) {
  if (!authorized(
    request,
    env
  )) {
    return new Response(
      'Unauthorized',
      { status: 401 }
    );
  }
  await env.BUCKET
    .put(
      oid,
      request.body
    );
  return new Response(
    null,
    { status: 200 }
  );
}

// endregion

export default {
  /**
   * Route git-lfs batch, download, and upload requests to R2.
   * @param request - Inbound HTTP request from a git-lfs client.
   * @param env - Worker env exposing the R2 `BUCKET` binding and upload secret.
   * @returns Response for the matched route, or 404 when unmatched.
   * @example
   * export default { fetch }
   */
  async fetch(
    request,
    env
  ) {
    const url = new URL(request.url);

    if ((request.method === 'POST')
      && url.pathname
      .endsWith('/objects/batch')) {
      return handleBatch(
        request,
        env,
        url
      );
    }

    const oid = url.pathname
      .slice(1);
    if (isOid(oid)) {
      if (request.method === 'GET') {
        return getObject(
          oid,
          env
        );
      }
      if (request.method === 'PUT') {
        return putObject(
          oid,
          request,
          env
        );
      }
    }

    return new Response(
      'Not found',
      { status: 404 }
    );
  },
};
