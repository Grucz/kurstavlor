/*
  Kurstavlor: skapar tavlor.json, en förteckning över alla tavlor.
  Körs automatiskt av Netlify vid varje publicering (se netlify.toml).
  Byggaren läser förteckningen och visar tavlorna på startsidan.
  Kräver bara Node, inga paket.
*/
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROT = process.cwd();
const HOPPA_OVER = new Set(["mall", "bygg", "netlify", "verktyg", "node_modules"]);

const tavlor = [];
for (const namn of readdirSync(ROT)) {
  if (namn.startsWith(".") || HOPPA_OVER.has(namn)) continue;
  const mapp = join(ROT, namn);
  const fil = join(mapp, "tavla.json");
  if (!statSync(mapp).isDirectory() || !existsSync(fil)) continue;
  try {
    const d = JSON.parse(readFileSync(fil, "utf8"));
    tavlor.push({
      slug: namn,
      rubrik: d.rubrik || namn,
      underrubrik: d.underrubrik || "",
      profil: d.profil || "sb",
      skapad: d.skapad || "",
      slutdatum: d.slutdatum || "",
      antalPoster: (d.kategorier || []).reduce((n, k) => n + (k.poster || []).length, 0)
    });
  } catch (e) {
    console.warn("Kunde inte läsa " + fil + ": " + e.message);
  }
}

writeFileSync(join(ROT, "tavlor.json"), JSON.stringify({ genererad: new Date().toISOString(), tavlor }, null, 2) + "\n");
console.log("tavlor.json: " + tavlor.length + " tavlor");
