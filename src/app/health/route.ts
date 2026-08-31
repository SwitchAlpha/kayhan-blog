// Minimal liveness probe (tooling probes /health; /api/health is the real check).
export function GET() { return new Response("ok", { headers: { "Content-Type": "text/plain" } }); }
