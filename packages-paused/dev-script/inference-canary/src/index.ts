/**
 * Library surface for the inference canary: artifact metadata types and
 * read/write helpers ({@link ArtifactMeta}, {@link EnrichedArtifactMeta},
 * {@link artifactDir}, {@link writeEnrichedArtifact}) and runner result types
 * ({@link ConfigSnapshot}, {@link StreamTiming}, {@link StreamUsage},
 * {@link CanaryReport}). The canary executable lives in `./canary.ts`.
 *
 * @module
 */

export * from './linter-artifacts.ts';
export * from './runner-types.ts';
