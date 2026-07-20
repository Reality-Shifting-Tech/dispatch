import { loadEnv } from "@dispatch/config";
import { Queue } from "bullmq";
import { Redis } from "ioredis";

const env = loadEnv();

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Queue registration only — processors and jobs arrive in later milestones.
const outboundQueue = new Queue("outbound", { connection });

const HEARTBEAT_MS = 30_000;
const heartbeat = setInterval(() => {
  console.log(`worker heartbeat ${new Date().toISOString()}`);
}, HEARTBEAT_MS);

console.log("worker started, connected to redis");

async function shutdown(signal: string) {
  console.log(`received ${signal}, shutting down`);
  clearInterval(heartbeat);
  await outboundQueue.close();
  connection.disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
