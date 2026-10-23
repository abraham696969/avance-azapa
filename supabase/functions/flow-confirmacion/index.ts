// Divertí Kids · integración con Flow (https://www.flow.cl). Sin dependencias externas.
// Secretos necesarios (Supabase > Edge Functions > Secrets): FLOW_API_KEY, FLOW_SECRET_KEY, SITE_URL
// Opcional: FLOW_API_URL (por defecto el sandbox: https://sandbox.flow.cl/api; producción: https://www.flow.cl/api)
const env = (k: string, d = ""): string => Deno.env.get(k) ?? d;
const FLOW_API = env("FLOW_API_URL", "https://sandbox.flow.cl/api").replace(/\/$/, "");
const API_KEY = env("FLOW_API_KEY");
const SECRET = env("FLOW_SECRET_KEY");
const SB_URL = env("SUPABASE_URL").replace(/\/$/, "");
const SB_KEY = env("SUPABASE_SERVICE_ROLE_KEY");

// Firma de Flow: parámetros ordenados por nombre, "nombre+valor" sin separadores, HMAC-SHA256 con la secretKey (hex)
async function sign(params: Record<string, string>): Promise<string> {
  const toSign = Object.keys(params).sort().map((k) => k + params[k]).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function flowCall(service: string, method: "GET" | "POST", extra: Record<string, string>) {
  const params: Record<string, string> = { apiKey: API_KEY, ...extra };
  params.s = await sign(params);
  const qs = new URLSearchParams(params).toString();
  const res = method === "GET"
    ? await fetch(`${FLOW_API}/${service}?${qs}`)
    : await fetch(`${FLOW_API}/${service}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: qs });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Flow respondió ${res.status}: ${data.message ?? JSON.stringify(data)}`);
  return data;
}
const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
const enc = encodeURIComponent;

// Consulta a Flow el estado REAL del pago (nunca se confía en lo que llegue desde el navegador) y actualiza la reserva
async function procesarToken(token: string): Promise<{ folio: string; resultado: string }> {
  const st = await flowCall("payment/getStatus", "GET", { token });
  const r = await rest("rpc/marcar_pago", {
    method: "POST",
    body: JSON.stringify({ p_folio: String(st.commerceOrder), p_status: Number(st.status), p_flow_orden: Number(st.flowOrder), p_monto: Math.round(Number(st.amount)) }),
  });
  if (!r.ok) throw new Error("No se pudo actualizar la reserva: " + await r.text());
  return { folio: String(st.commerceOrder), resultado: String(await r.json()) };
}
async function leerToken(req: Request): Promise<string> {
  let token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token && req.method === "POST") {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("json")) token = String((await req.json().catch(() => ({}))).token ?? "");
    else { const f = await req.formData().catch(() => null); token = String(f?.get("token") ?? ""); }
  }
  return token;
}

// Flow llama aquí (POST con "token") cuando cambia el estado de un pago. Debe responder 200.
Deno.serve(async (req: Request) => {
  try {
    const token = await leerToken(req);
    if (!token) return new Response("falta token", { status: 400 });
    const { folio, resultado } = await procesarToken(token);
    console.log("confirmacion", folio, resultado);
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 }); // Flow reintenta si no recibe 200
  }
});
