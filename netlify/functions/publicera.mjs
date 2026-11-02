/*
  Kurstavlor: publicerar och tar bort tavlor direkt i GitHub-repot.
  Ligger under /bygg/ och skyddas därför av samma lösenord som byggaren.

  Miljövariabler i Netlify:
    KURSTAVLOR_GITHUB_TOKEN  Fine-grained token med åtkomst till enbart repot kurstavlor
                             (Repository permissions: Contents = Read and write).
    KURSTAVLOR_REPO          Repots namn med ägare, till exempel Grucz/kurstavlor.
    KURSTAVLOR_GREN          Valfri. Grenen som publiceras, standard main.

  Steg (anropas av byggaren):
    POST ?steg=fil                Kropp: filens innehåll. Svar: { sha }. Ändrar inget i repot ännu.
    POST ?steg=publicera          Kropp: JSON { slug, filer: [{ sokvag, sha }], text: { "index.html": "...", "tavla.json": "..." }, meddelande }
                                  Skapar en enda commit med alla filer i tavlans mapp.
    POST ?steg=tabort             Kropp: JSON { slug }. Tar bort hela tavlans mapp i en commit.

  Funktionen skriver aldrig utanför tavlans egen mapp.
*/

const API = process.env.KURSTAVLOR_GITHUB_API || "https://api.github.com";
const RESERVERADE = new Set(["mall", "bygg", "netlify", "verktyg", "node_modules"]);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SOKVAG = /^[a-z0-9]+(-[a-z0-9]+)*\/(index\.html|tavla\.json|filer\/[A-Za-z0-9][A-Za-z0-9._-]{0,120})$/;

const svar = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const fel = (meddelande, status = 400) => svar({ fel: meddelande }, status);

function installningar() {
  const token = process.env.KURSTAVLOR_GITHUB_TOKEN;
  const repo = process.env.KURSTAVLOR_REPO;
  const gren = process.env.KURSTAVLOR_GREN || "main";
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  return { token, repo, gren };
}

async function gh(inst, metod, sokvag, kropp) {
  const r = await fetch(`${API}/repos/${inst.repo}${sokvag}`, {
    method: metod,
    headers: {
      authorization: `Bearer ${inst.token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "kurstavlor",
      ...(kropp ? { "content-type": "application/json" } : {})
    },
    body: kropp ? JSON.stringify(kropp) : undefined
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!r.ok) {
    const e = new Error(data.message || `GitHub svarade ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return data;
}

function giltigSlug(slug) {
  return typeof slug === "string" && SLUG.test(slug) && !RESERVERADE.has(slug) && slug.length <= 80;
}

// Hämtar senaste commit och dess träd på grenen.
async function senaste(inst) {
  const ref = await gh(inst, "GET", `/git/ref/heads/${inst.gren}`);
  const commit = await gh(inst, "GET", `/git/commits/${ref.object.sha}`);
  return { commitSha: ref.object.sha, tradSha: commit.tree.sha };
}

// Skapar commit med de givna ändringarna och flyttar grenen dit.
async function committa(inst, bas, poster, meddelande) {
  const trad = await gh(inst, "POST", "/git/trees", { base_tree: bas.tradSha, tree: poster });
  const commit = await gh(inst, "POST", "/git/commits", { message: meddelande, tree: trad.sha, parents: [bas.commitSha] });
  await gh(inst, "PATCH", `/git/refs/heads/${inst.gren}`, { sha: commit.sha, force: false });
  return commit.sha;
}

function githubFel(e) {
  if (e.status === 401) return fel("GitHub godkände inte nyckeln. Kontrollera KURSTAVLOR_GITHUB_TOKEN, den kan ha gått ut.", 502);
  if (e.status === 403 || e.status === 404) return fel("Nyckeln saknar behörighet till repot, eller så är KURSTAVLOR_REPO fel stavat.", 502);
  if (e.status === 422) return fel("Repot ändrades samtidigt. Försök publicera igen.", 409);
  return fel("GitHub svarade med ett fel: " + e.message, 502);
}

export default async (req) => {
  if (req.method !== "POST") return fel("Endast POST.", 405);
  const inst = installningar();
  if (!inst) return fel("Publicering är inte inställd: KURSTAVLOR_GITHUB_TOKEN och KURSTAVLOR_REPO saknas i Netlifys inställningar.", 503);
  const steg = new URL(req.url).searchParams.get("steg");

  try {
    /* 1. En fil i taget, som blob. Syns inte i repot förrän commit görs. */
    if (steg === "fil") {
      const data = new Uint8Array(await req.arrayBuffer());
      if (!data.length) return fel("Tom fil.");
      const blob = await gh(inst, "POST", "/git/blobs", { content: Buffer.from(data).toString("base64"), encoding: "base64" });
      return svar({ sha: blob.sha });
    }

    const kropp = await req.json().catch(() => null);
    if (!kropp || !giltigSlug(kropp.slug)) return fel("Ogiltig adress för tavlan.");
    const slug = kropp.slug;

    /* 2. Publicera: textfiler och tidigare uppladdade filer i en commit. */
    if (steg === "publicera") {
      const poster = [];
      for (const [namn, innehall] of Object.entries(kropp.text || {})) {
        const sokvag = `${slug}/${namn}`;
        if (!SOKVAG.test(sokvag) || typeof innehall !== "string") return fel("Ogiltig fil: " + namn);
        poster.push({ path: sokvag, mode: "100644", type: "blob", content: innehall });
      }
      for (const f of kropp.filer || []) {
        if (!f || typeof f.sokvag !== "string" || !SOKVAG.test(f.sokvag) || !f.sokvag.startsWith(slug + "/") || !/^[0-9a-f]{40}$/.test(f.sha || "")) {
          return fel("Ogiltig fil: " + (f && f.sokvag));
        }
        poster.push({ path: f.sokvag, mode: "100644", type: "blob", sha: f.sha });
      }
      if (!poster.some((p) => p.path === `${slug}/tavla.json`)) return fel("tavla.json saknas.");
      const bas = await senaste(inst);
      const meddelande = String(kropp.meddelande || `Publicera tavla: ${slug}`).slice(0, 200);
      const sha = await committa(inst, bas, poster, meddelande);
      return svar({ ok: true, commit: sha });
    }

    /* 3. Ta bort hela tavlans mapp. */
    if (steg === "tabort") {
      const bas = await senaste(inst);
      const trad = await gh(inst, "GET", `/git/trees/${bas.tradSha}?recursive=1`);
      const filer = (trad.tree || []).filter((t) => t.type === "blob" && t.path.startsWith(slug + "/"));
      if (!filer.length) return fel("Tavlan finns inte i repot.", 404);
      const poster = filer.map((t) => ({ path: t.path, mode: "100644", type: "blob", sha: null }));
      const sha = await committa(inst, bas, poster, `Ta bort tavla: ${slug}`);
      return svar({ ok: true, commit: sha, borttagna: filer.length });
    }

    return fel("Okänt steg.");
  } catch (e) {
    return githubFel(e);
  }
};

export const config = { path: "/bygg/api/publicera" };
