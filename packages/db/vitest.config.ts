import { defineConfig } from "vitest/config";

// PGlite-backed integration suites slow down under full-repo parallel load;
// the 5s default is the flake source, not the code.
export default defineConfig({
  test: { testTimeout: 15_000 },
});
