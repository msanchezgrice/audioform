#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTalkformMcpServer } from "./app";

const server = createTalkformMcpServer({ includeLegacyStdioSurface: true });
await server.connect(new StdioServerTransport());
