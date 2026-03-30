// oxlint-disable no-magic-numbers -- comparison script with dimensional constants
/**
 * AI-based perceptual comparison using multimodal embedding models.
 *
 * Runs Voyage and Gemini providers to compute embedding-based
 * similarity between reference and composite images.
 *
 * @module
 */

/**
 * Runs AI perceptual comparison between two images using available providers.
 * Providers are attempted sequentially; each requires its API key env var.
 *
 * @param refPath - path to reference image
 *
 * @param cmpPath - path to composite image
 */
export async function runAiMetrics(
  {
    refPath,
    cmpPath,
  }: {
    refPath: string;
    cmpPath: string;
  },
): Promise<void> {
  console.error('',);
  console.error('--- AI perceptual metrics ---',);

  try {
    const { compare: aiCompare, } = await import('@monochromatic-dev/module-image-diff');

    const refInput = { path: refPath, };
    const cmpInput = { path: cmpPath, };

    /**
     * Providers to try, with their env var keys.
     * Only attempt providers whose API key is present.
     */
    const providers = [
      {
        name: 'voyage',
        envKey: 'IMAGE_DIFF_VOYAGE_API_KEY',
      },
      {
        name: 'gemini',
        envKey: 'IMAGE_DIFF_GEMINI_API_KEY',
      },
    ] as const;

    let anyRan = false;

    for (const {
      name,
      envKey,
    } of providers) {
      if (process.env[envKey] === undefined || process.env[envKey] === '') {
        console.error(`${name}:  skipped (${envKey} not set)`,);
        continue;
      }

      try {
        // oxlint-disable-next-line no-await-in-loop -- sequential provider fallback; later providers only run if earlier ones fail
        const result = await aiCompare(
          refInput,
          cmpInput,
          { provider: name, },
        );
        console.error(
          `${name}:  similarity=${result.similarity.toFixed(4,)}  distance=${
            result
              .distance
              .toFixed(4,)
          }  (1.0 = identical)`,
        );
        anyRan = true;
      }
      catch (providerError) {
        console.error(
          `${name}:  failed - ${
            providerError instanceof Error
              ? providerError.message
              : String(providerError,)
          }`,
        );
      }
    }

    if (!anyRan) {
      console.error(
        'Set IMAGE_DIFF_VOYAGE_API_KEY or IMAGE_DIFF_GEMINI_API_KEY to enable AI comparison.',
      );
    }
  }
  catch (importError) {
    console.error(
      `AI comparison unavailable: ${
        importError instanceof Error
          ? importError.message
          : String(importError,)
      }`,
    );
  }
}
