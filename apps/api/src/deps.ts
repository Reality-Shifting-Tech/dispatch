import type { Env } from "@mailpelican/config";
import type { Database } from "@mailpelican/db";
import type { ApiKeyScope } from "@mailpelican/db";
import type { DnsResolver } from "@mailpelican/domain";
import type { RelayProvider } from "@mailpelican/relays";

/** Authenticated caller attached to every /v1 request after auth middleware. */
export interface Principal {
  workspaceId: string;
  actorType: "api_key" | "owner";
  actorId: string;
  scopes: ApiKeyScope[];
}

/**
 * External services the API depends on. Injected into the app factory so
 * health routes and tests never touch real infrastructure implicitly.
 */
export interface Deps {
  env: Env;
  db: Database;
  checkDatabase: () => Promise<void>;
  checkRedis: () => Promise<void>;
  close: () => Promise<void>;
  /** Lazily build a RelayProvider for a stored relay row. */
  createProvider: (relayId: string) => Promise<RelayProvider>;
  /** Live DNS lookups for sender-identity verification. */
  resolveDns: DnsResolver;
}
