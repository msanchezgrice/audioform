import { TALKFORM_MCP_RESOURCE, TALKFORM_MCP_SCOPES } from "../../../../../lib/platform/mcp-oauth";

const headers = { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" };

export async function GET() {
  return Response.json({
    resource: TALKFORM_MCP_RESOURCE,
    authorization_servers: ["https://clerk.talkform.ai"],
    scopes_supported: [...TALKFORM_MCP_SCOPES],
    resource_documentation: "https://www.talkform.ai/docs/mcp",
    bearer_methods_supported: ["header"],
  }, { headers });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...headers, "access-control-allow-methods": "GET, OPTIONS" } });
}
