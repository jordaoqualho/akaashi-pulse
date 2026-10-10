import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp';
import { createServer } from '@/lib/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MCP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(MCP_HEADERS)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function errorResponse(message: string, status = 500): Response {
  return withCors(
    Response.json(
      {
        jsonrpc: '2.0',
        error: { code: -32603, message },
        id: null,
      },
      { status },
    ),
  );
}

async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));

  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return withCors(await transport.handleRequest(request));
  } catch (error) {
    console.error('[akaashi-mcp-http] request failed', error);
    return errorResponse('MCP request failed');
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

export async function OPTIONS(): Promise<Response> {
  return handleMcpRequest(new Request('http://localhost/api/mcp', { method: 'OPTIONS' }));
}

export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}
