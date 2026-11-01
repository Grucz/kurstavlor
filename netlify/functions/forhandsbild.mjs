/*
  Kurstavlor: hämtar en förhandsbild för en länk.
  Anropas bara av tavelbyggaren, aldrig av deltagarna.

  1. YouTube: videons miniatyrbild.
  2. Sidans egen delningsbild (og:image, twitter:image).
  3. Reserv: skärmdump via Microlink (gratisnivå, begränsat antal per dag).

  Svar: själva bilden (Content-Type image/...) och rubriken X-Kalla
  (youtube, delningsbild eller skarmdump), eller JSON { fel } vid misslyckande.
*/

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-expose-headers": "x-kalla"
};
const UA = "Mozilla/5.0 (compatible; Kurstavlor/1.0; +https://kurstavlor.netlify.app)";
const MAX_BILD = 6 * 1024 * 1024;
const MAX_SIDA = 1.5 * 1024 * 1024;
const TIDSBUDGET = 9000; // Netlifys funktioner avbryts efter cirka 10 sekunder

const fel = (meddelande, status = 404) =>
  new Response(JSON.stringify({ fel: meddelande }), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" }
  });

// Stoppa anrop mot det egna nätverket (localhost, privata adresser).
function tillatenAdress(u) {
  if (!/^https?:$/.test(u.protocol)) return false;
  if (process.env.KURSTAVLOR_TILLAT_LOKALT === "1") return true;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^\[?[0-9a-f:]+\]?$/.test(h) && h.includes(":")) return false; // IPv6-literaler
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  return true;
}

function youtubeId(url) {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}

function avkoda(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// Letar upp delningsbilden i sidans HTML.
function hittaDelningsbild(html) {
  const huvud = html.slice(0, 400000);
  const kandidater = {};
  for (const tagg of huvud.match(/<meta\b[^>]*>/gi) || []) {
    const nyckel = (tagg.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const varde = (tagg.match(/\bcontent\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (nyckel && varde && !kandidater[nyckel.toLowerCase()]) kandidater[nyckel.toLowerCase()] = avkoda(varde.trim());
  }
  for (const tagg of huvud.match(/<link\b[^>]*>/gi) || []) {
    if (/\brel\s*=\s*["']image_src["']/i.test(tagg)) {
      const href = (tagg.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1];
      if (href && !kandidater.image_src) kandidater.image_src = avkoda(href.trim());
    }
  }
  return kandidater["og:image:secure_url"] || kandidater["og:image"] || kandidater["og:image:url"] ||
    kandidater["twitter:image"] || kandidater["twitter:image:src"] || kandidater.image_src || "";
}

async function lasBegransat(svar, max) {
  const reader = svar.body.getReader();
  const delar = [];
  let totalt = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalt += value.length;
    if (totalt > max) { reader.cancel(); return null; }
    delar.push(value);
  }
  const ut = new Uint8Array(totalt);
  let pos = 0;
  for (const d of delar) { ut.set(d, pos); pos += d.length; }
  return ut;
}

async function hamtaBild(url, ms) {
  const u = new URL(url);
  if (!tillatenAdress(u)) return null;
  const svar = await fetch(u, { headers: { "user-agent": UA, accept: "image/*" }, redirect: "follow", signal: AbortSignal.timeout(ms) });
  const typ = (svar.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!svar.ok || !/^image\/(jpeg|png|webp|gif|avif)$/.test(typ)) return null;
  const data = await lasBegransat(svar, MAX_BILD);
  return data && data.length > 500 ? { data, typ } : null;
}

const bildsvar = (bild, kalla) =>
  new Response(bild.data, { status: 200, headers: { ...CORS, "content-type": bild.typ, "cache-control": "no-store", "x-kalla": kalla } });

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const start = Date.now();
  const kvar = () => Math.max(500, TIDSBUDGET - (Date.now() - start));

  let mal;
  try { mal = new URL(new URL(req.url).searchParams.get("url") || ""); } catch { return fel("Ogiltig adress.", 400); }
  if (!tillatenAdress(mal)) return fel("Adressen är inte tillåten.", 400);

  // 1. YouTube
  const yt = youtubeId(mal.href);
  if (yt) {
    for (const storlek of ["maxresdefault", "hqdefault"]) {
      try {
        const b = await hamtaBild(`https://i.ytimg.com/vi/${yt}/${storlek}.jpg`, Math.min(4000, kvar()));
        if (b) return bildsvar(b, "youtube");
      } catch { /* prova nästa */ }
    }
  }

  // 2. Sidans delningsbild
  if (!yt) {
    try {
      const sida = await fetch(mal, {
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5", "accept-language": "sv,en;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(Math.min(4000, kvar()))
      });
      const typ = (sida.headers.get("content-type") || "").toLowerCase();
      if (sida.ok && typ.startsWith("image/")) {
        // Länken går direkt till en bild.
        const b = await hamtaBild(sida.url || mal.href, Math.min(4000, kvar()));
        if (b) return bildsvar(b, "delningsbild");
      } else if (sida.ok && typ.includes("html")) {
        const data = await lasBegransat(sida, MAX_SIDA);
        const bildUrl = data ? hittaDelningsbild(new TextDecoder().decode(data)) : "";
        if (bildUrl) {
          const b = await hamtaBild(new URL(bildUrl, sida.url || mal.href).href, Math.min(4000, kvar()));
          if (b) return bildsvar(b, "delningsbild");
        }
      } else if (sida.body) {
        sida.body.cancel();
      }
    } catch { /* gå vidare till skärmdump */ }
  }

  // 3. Skärmdump via Microlink
  if (kvar() < 2500) return fel("Det tog för lång tid. Försök igen.", 504);
  try {
    const api = "https://api.microlink.io/?screenshot=true&meta=false&url=" + encodeURIComponent(mal.href);
    const svar = await fetch(api, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(Math.min(7000, kvar() - 1000)) });
    if (svar.status === 429) return fel("Dagens gräns för gratis skärmdumpar är nådd. Försök i morgon eller ladda upp en egen bild.", 429);
    const json = await svar.json();
    const skarmUrl = json && json.status === "success" && json.data && json.data.screenshot && json.data.screenshot.url;
    if (skarmUrl) {
      const b = await hamtaBild(skarmUrl, Math.min(4000, kvar()));
      if (b) return bildsvar(b, "skarmdump");
    }
  } catch { /* ingen bild */ }

  return fel("Ingen förhandsbild hittades för den här länken.");
};

export const config = { path: "/bygg/api/forhandsbild" };
