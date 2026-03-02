export default {
  async fetch(request: Request, env: { SUPABASE_HOST: string }): Promise<Response> {
    const url = new URL(request.url);
    url.hostname = env.SUPABASE_HOST;
    url.protocol = "https:";
    const targetUrl = url.toString();

    // Build clean headers — strip CF internals and Host
    const forwardHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (key.startsWith("cf-") || key === "host") continue;
      forwardHeaders.set(key, value);
    }

    // WebSocket upgrade — use fetch with upgrade headers, then bridge via WebSocketPair
    if (request.headers.get("Upgrade") === "websocket") {
      const upstreamResp = await fetch(targetUrl, {
        headers: forwardHeaders,
      });

      const upstream = upstreamResp.webSocket;
      if (!upstream) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      const [client, server] = Object.values(new WebSocketPair());
      upstream.accept();
      server.accept();

      upstream.addEventListener("message", (event) => {
        try { server.send(event.data); } catch {}
      });
      server.addEventListener("message", (event) => {
        try { upstream.send(event.data); } catch {}
      });
      upstream.addEventListener("close", (event) => {
        try { server.close(event.code, event.reason); } catch {}
      });
      server.addEventListener("close", (event) => {
        try { upstream.close(event.code, event.reason); } catch {}
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // Regular HTTP
    const resp = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.body,
      redirect: "follow",
    });

    return new Response(resp.body, {
      status: resp.status,
      headers: resp.headers,
    });
  },
};
