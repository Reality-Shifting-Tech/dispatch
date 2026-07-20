import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDispatchClient } from "./client.js";
import { createDispatchMcpServer } from "./server.js";

const apiKey = process.env.MAILPELICAN_API_KEY;
if (apiKey === undefined || apiKey.length === 0) {
  console.error("MAILPELICAN_API_KEY is required (scoped dispatch API key, dk_...)");
  process.exit(1);
}
const apiUrl = process.env.MAILPELICAN_API_URL ?? "http://localhost:3000";

const server = createDispatchMcpServer(createDispatchClient({ apiUrl, apiKey }));
await server.connect(new StdioServerTransport());
