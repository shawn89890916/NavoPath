const SUPABASE_ORIGIN = "https://qplymrkgsnaaamxggwxw.supabase.co";
const ALLOWED_ROOTS = new Set(["auth", "rest"]);
const ALLOWED_AUTH_ENDPOINTS = new Set(["token", "signup", "logout", "recover", "verify", "user", "resend"]);

type FunctionContext = {
  request: Request;
  params: { path?: string | string[] };
};

export async function onRequest({ request, params }: FunctionContext) {
  const segments = Array.isArray(params.path) ? params.path : [params.path || ""];
  if (!ALLOWED_ROOTS.has(segments[0])
    || segments[1] !== "v1"
    || (segments[0] === "auth" && !ALLOWED_AUTH_ENDPOINTS.has(segments[2]))) {
    return new Response("Not found", { status: 404 });
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`/${segments.map(encodeURIComponent).join("/")}`, SUPABASE_ORIGIN);
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("cookie");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("x-forwarded-for");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");

  const method = request.method.toUpperCase();
  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
    redirect: "manual",
  });
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.delete("set-cookie");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
