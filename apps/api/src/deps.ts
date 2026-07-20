import type { Env } from "@dispatch/config";

/**
 * External services the API depends on. Injected into the app factory so
 * health routes and tests never touch real infrastructure implicitly.
 */
export interface Deps {
  env: Env;
  checkDatabase: () => Promise<void>;
  checkRedis: () => Promise<void>;
  close: () => Promise<void>;
}
