// Entry point: Bun.build() at startup + Bun.serve().
// In dev (bun --watch), server restarts on any file change -> rebuild is automatic.
const buildResult = await Bun.build({
  entrypoints: [
    "./src/client/decks.ts",
    "./src/client/quiz.ts",
  ],
  outdir: "./dist/client",
  target: "browser",
  minify: process.env.NODE_ENV === "production",
});

if (!buildResult.success) {
  console.error("Client build failed:", buildResult.logs);
  process.exit(1);
}

console.log(
  `Built ${buildResult.outputs.length} client bundles:`,
  buildResult.outputs.map((o) => o.path)
);

// CSS is imported as text by client entrypoints and injected at runtime.
// No separate CSS file to copy -- Bun.build() inlines it into the JS bundles.

// DB module import triggers schema creation (in-memory, fresh each restart)
await import("./lib/db");

const { router } = await import("./server/router");

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req) {
    return router(req);
  },
});

console.log(`Listening on http://localhost:${server.port}`);
