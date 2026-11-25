// Sito Dott. Umberto Fama — anteprima.
// Pagine (generate da build.py) compresse in brotli nelle variabili SITO_1..SITO_N;
// foto del Dottore dal kit su GitHub Pages; font self-hosted (@fontsource 5.3.0) da jsDelivr.
import { brotliDecompressSync } from "zlib";
import { createHash as sha } from "crypto";

let b64 = "";
for (let i = 1; Bun.env["SITO_" + i]; i++) {
  const c = Bun.env["SITO_" + i]!;
  console.log("SITO_" + i, c.length, sha("sha256").update(c).digest("hex").slice(0, 12));
  b64 += c;
}
let FILES: Record<string, { t?: string; b?: string }> = {};
try {
  FILES = b64 ? JSON.parse(brotliDecompressSync(Buffer.from(b64, "base64")).toString("utf-8")) : {};
} catch (e) {
  console.log("ERRORE decompressione:", String(e));
}
const BIN: Record<string, Uint8Array> = {};
for (const k in FILES) if (FILES[k].b) BIN[k] = Buffer.from(FILES[k].b!, "base64");

// File sostituiti o aggiunti al volo: FILE_PATCH = JSON {"percorso": {"t": testo} | {"b": base64}}
const FILE_PATCH = Bun.env.FILE_PATCH || "";
if (FILE_PATCH) {
  try {
    const o: Record<string, { t?: string; b?: string }> = JSON.parse(FILE_PATCH);
    for (const k in o) {
      if (o[k].b) BIN[k] = Buffer.from(o[k].b!, "base64");
      else { FILES[k] = { t: o[k].t }; delete BIN[k]; }
    }
    console.log("file patch:", Object.keys(o).length, "file");
  } catch (e) {
    console.log("file patch non valida:", String(e));
  }
}

// Patch CSS veloce (aggiunta in coda a site.css)
let CSS_PATCH = Bun.env.CSS_PATCH || "";
for (let i = 2; Bun.env["CSS_PATCH" + i]; i++) CSS_PATCH += " " + Bun.env["CSS_PATCH" + i];
if (CSS_PATCH && FILES["static/css/site.css"]?.t) {
  FILES["static/css/site.css"].t += "\n/* patch */\n" + CSS_PATCH;
  console.log("css patch:", CSS_PATCH.length, "caratteri");
}
// Patch testo dagli archivi "patch-fama", "patch-fama-2", ... (rete privata Railway): liste di patch in brotli+base64,
// applicate DOPO quelle nelle variabili TESTO_PATCH* (le variabili hanno raggiunto il limite di dimensione), nell'ordine degli archivi.
const ARCHIVI = (Bun.env.PATCH_URLS || "http://patch-fama.railway.internal:8080/ http://patch-fama-2.railway.internal:8080/").split(/\s+/).filter(Boolean);
const EXTRA: [string, string][] = [];
for (const ARCHIVIO of ARCHIVI) {
  for (let i = 0; i < 15; i++) {
    try {
      const r = await fetch(ARCHIVIO, { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const lista: [string, string][][] = JSON.parse(brotliDecompressSync(Buffer.from(await r.text(), "base64")).toString("utf-8"));
        let c = 0;
        for (const p of lista) { EXTRA.push(...p); c += p.length; }
        console.log("archivio patch", ARCHIVIO, ":", lista.length, "patch,", c, "coppie");
        break;
      }
      console.log("archivio patch", ARCHIVIO, "HTTP", r.status);
    } catch (e) {
      console.log("archivio patch", ARCHIVIO, "tentativo", i + 1, String(e));
    }
    await Bun.sleep(2000);
  }
}
// Patch testo veloce: JSON [[cerca, sostituisci], ...] su tutte le pagine .html
const TESTO_PATCH = Bun.env.TESTO_PATCH || "";
if (TESTO_PATCH || Bun.env.TESTO_PATCH2 || EXTRA.length) {
  try {
    const coppie: [string, string][] = JSON.parse(TESTO_PATCH || "[]");
    for (let i = 2; Bun.env["TESTO_PATCH" + i]; i++) coppie.push(...JSON.parse(Bun.env["TESTO_PATCH" + i]!));
    coppie.push(...EXTRA);
    let n = 0, pagine = 0;
    for (const k in FILES) {
      if (!k.endsWith(".html") || !FILES[k].t) continue;
      let t = FILES[k].t!;
      const prima = t;
      for (const [a, b] of coppie) {
        const parti = t.split(a);
        n += parti.length - 1;
        t = parti.join(b);
      }
      if (t !== prima) { FILES[k].t = t; pagine++; }
    }
    console.log("testo patch:", n, "sostituzioni,", pagine, "pagine toccate");
  } catch (e) {
    console.log("testo patch non valida:", String(e));
  }
}

// Pagine nuove (archivio "pagine-fama"): ogni pagina nasce da una pagina "modello" gia' patchata,
// con sostituzioni [regex, testo, flag]; se indicato aggiunge la voce alla sitemap.
const PAGINE_URL = "http://pagine-fama.railway.internal:8080/";
for (let i = 0; i < 5; i++) {
  try {
    const r = await fetch(PAGINE_URL, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const lista: { percorso: string; modello: string; sost: [string, string, string?][]; sitemap?: string }[] =
        JSON.parse(brotliDecompressSync(Buffer.from(await r.text(), "base64")).toString("utf-8"));
      for (const pg of lista) {
        const m = FILES[pg.modello]?.t;
        if (!m) { console.log("pagina", pg.percorso, ": modello mancante", pg.modello); continue; }
        let t = m, ok = 0;
        for (const [a, b, f] of pg.sost) {
          const re = new RegExp(a, (f || "") + "s");
          if (re.test(t)) { ok++; t = t.replace(new RegExp(a, (f || "") + "s"), () => b); }
          else console.log("pagina", pg.percorso, ": non trovato", a.slice(0, 80));
        }
        FILES[pg.percorso] = { t };
        console.log("pagina aggiunta:", pg.percorso, ok + "/" + pg.sost.length, "sostituzioni");
        const sm = FILES["sitemap.xml"];
        if (pg.sitemap && sm?.t && !sm.t.includes(pg.sitemap)) sm.t = sm.t.replace("</urlset>", pg.sitemap + "\n</urlset>");
      }
      break;
    }
    console.log("archivio pagine HTTP", r.status);
  } catch (e) {
    console.log("archivio pagine tentativo", i + 1, String(e));
  }
  await Bun.sleep(2000);
}

const KIT = Bun.env.KIT_URL || "https://abcwebagency-123.github.io/kit-fama/";
const FOTO: Record<string, number> = { "static/img/dottore.jpg": 60709, "static/img/dottore-duo.jpg": 45348, "static/img/dottore-blu.jpg": 32428 };
async function caricaFoto() {
  try {
    const r = await fetch(KIT + (KIT.includes("?") ? "&" : "?") + "t=" + Date.now());
    const html = await r.text();
    console.log("kit:", r.status, html.length, "caratteri");
    const trovati: Record<number, Buffer> = {};
    for (const m of html.matchAll(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g)) {
      const d = Buffer.from(m[1], "base64");
      trovati[d.length] = d;
    }
    for (const p in FOTO) if (trovati[FOTO[p]]) BIN[p] = trovati[FOTO[p]];
    console.log("foto caricate:", Object.keys(FOTO).filter((p) => BIN[p]).length, "/ 3");
  } catch (e) {
    console.log("foto non caricate:", String(e));
  }
}
const CDN = "https://cdn.jsdelivr.net/npm/@fontsource-variable/";
const FONT: Record<string, string> = {
  "static/fonts/figtree-latin-wght-normal.woff2": CDN + "figtree@5.3.0/files/figtree-latin-wght-normal.woff2",
  "static/fonts/figtree-latin-wght-italic.woff2": CDN + "figtree@5.3.0/files/figtree-latin-wght-italic.woff2",
  "static/fonts/playfair-display-latin-wght-normal.woff2": CDN + "playfair-display@5.3.0/files/playfair-display-latin-wght-normal.woff2",
  "static/fonts/playfair-display-latin-wght-italic.woff2": CDN + "playfair-display@5.3.0/files/playfair-display-latin-wght-italic.woff2",
};
async function caricaFont() {
  await Promise.all(Object.entries(FONT).map(async ([p, url]) => {
    for (const u of [url, url.replace(CDN, "https://unpkg.com/@fontsource-variable/")]) {
      try {
        const r = await fetch(u);
        if (r.ok) { BIN[p] = new Uint8Array(await r.arrayBuffer()); return; }
        console.log("font", u, "HTTP", r.status);
      } catch (e) {
        console.log("font", u, "errore:", String(e));
      }
    }
  }));
  console.log("font caricati:", Object.keys(FONT).filter((p) => BIN[p]).length, "/ 4");
}
await Promise.all([caricaFoto(), caricaFont()]);

// === Risorse per agenti AI: llms.txt, ai-catalog.json, Markdown su richiesta (Accept: text/markdown) ===
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»", middot: "·", egrave: "è", eacute: "é", agrave: "à", ograve: "ò", ugrave: "ù", igrave: "ì", copy: "©", reg: "®", deg: "°", times: "×" };
function decodeEnt(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isNaN(n) ? m : String.fromCodePoint(n); }
    return ENT[e.toLowerCase()] ?? m;
  });
}
function pulisciTesto(s: string) { return decodeEnt(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(); }
function assoluto(href: string, base: string) {
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith("#")) return "";
  try { return new URL(href, base + "/").href; } catch { return href; }
}
function htmlToMd(html: string, base: string) {
  let h = html;
  h = h.replace(/<(template|script|style|noscript|svg|form|button|iframe|select|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  h = h.replace(/<!--[\s\S]*?-->/g, "");
  h = h.replace(/<(span|div|figure|p)\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/gi, "");
  h = h.replace(/<(input|meta|link)\b[^>]*>/gi, "");
  h = h.replace(/(<\/(?:span|small|b|strong|em|i|a|time|abbr)>)(?=\s*<(?:span|small|b|strong|em|i|a|time|abbr)\b)/gi, "$1 ");
  // tabelle
  h = h.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, t) => {
    const righe = [...t.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => [...r[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => pulisciTesto(c[1]).replace(/\|/g, "\\|")));
    if (!righe.length) return "";
    const n = Math.max(...righe.map((r) => r.length));
    const out = righe.map((r) => "| " + [...r, ...Array(n - r.length).fill("")].join(" | ") + " |");
    out.splice(1, 0, "|" + " --- |".repeat(n));
    return "\n\n" + out.join("\n") + "\n\n";
  });
  h = h.replace(/<img\b[^>]*>/gi, (m) => {
    const alt = (m.match(/\balt="([^"]*)"/i) || ["", ""])[1];
    const src = (m.match(/\bsrc="([^"]*)"/i) || ["", ""])[1];
    return alt && src ? `![${decodeEnt(alt)}](${assoluto(src, base)})` : "";
  });
  h = h.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
    const txt = pulisciTesto(t); const u = assoluto(decodeEnt(href), base);
    return txt ? (u ? `[${txt}](${u})` : txt) : "";
  });
  h = h.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l, t) => "\n\n" + "#".repeat(+l) + " " + pulisciTesto(t.replace(/<br\s*\/?>/gi, " ")) + "\n\n");
  h = h.replace(/<summary\b[^>]*>([\s\S]*?)<\/summary>/gi, (_, t) => "\n\n**" + pulisciTesto(t) + "**\n\n");
  h = h.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => { const x = t.replace(/\s+/g, " ").trim(); return x ? "**" + x + "**" : ""; });
  h = h.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => { const x = t.replace(/\s+/g, " ").trim(); return x ? "*" + x + "*" : ""; });
  h = h.replace(/<li\b[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "");
  h = h.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => "\n\n> " + pulisciTesto(t) + "\n\n");
  h = h.replace(/<br\s*\/?>/gi, "\n");
  h = h.replace(/<\/?(p|div|section|article|header|footer|aside|ul|ol|dl|dt|dd|figure|figcaption|details|nav|main|table|tr)\b[^>]*>/gi, "\n\n");
  h = h.replace(/<[^>]+>/g, "");
  h = decodeEnt(h);
  const righe = h.split("\n").map((r) => r.replace(/[ \t ]+/g, " ").trim());
  let md = righe.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\n(- )/g, "\n$1");
  md = md.replace(/\n- *\n+/g, "\n- ");
  md = md.replace(/(\n- [^\n]*)\n\n(?=- )/g, "$1\n");
  return md.trim() + "\n";
}
function metaPagina(t: string) {
  const title = decodeEnt((t.match(/<title>([^<]*)<\/title>/) || ["", ""])[1]).replace(/\s*\|\s*Dott\. Umberto Fama\s*$/, "").trim();
  const desc = decodeEnt((t.match(/<meta name="description" content="([^"]*)"/) || ["", ""])[1]).trim();
  const canon = (t.match(/<link rel="canonical" href="([^"]*)"/) || ["", ""])[1];
  let briciole: string[] = [];
  const bc = t.match(/"@type": "BreadcrumbList", "itemListElement": (\[.*?\])\}/);
  if (bc) { try { briciole = JSON.parse(bc[1]).map((x: any) => String(x.name)); } catch {} }
  return { title, desc, canon, briciole };
}
function chiaveFile(path: string) { return (path.endsWith("/") ? path + "index.html" : path).replace(/^\/+/, ""); }
const ORDINE = ["Pagine principali", "Chirurgia estetica", "Chirurgia dermatologica ricostruttiva", "Medicina estetica", "Trattamenti laser", "Medicina rigenerativa", "Chi sono", "Sedi", "Blog"];
const OPZIONALI = ["/privacy/", "/web-policy-privacy/", "/mappa-del-sito/"];
function elencoPagine(FILES: Record<string, { t?: string }>) {
  const sm = FILES["sitemap.xml"]?.t || "";
  const viste = new Set<string>();
  const gruppi = new Map<string, { title: string; desc: string; path: string }[]>();
  for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    let path = "/";
    try { path = new URL(m[1]).pathname; } catch { continue; }
    if (viste.has(path)) continue; viste.add(path);
    const t = FILES[chiaveFile(path)]?.t; if (!t) continue;
    const { title, desc, briciole } = metaPagina(t);
    const g = OPZIONALI.includes(path) ? "Optional" : briciole.length >= 2 || (briciole.length === 1 && ORDINE.includes(briciole[0])) ? briciole[0] : "Pagine principali";
    if (!gruppi.has(g)) gruppi.set(g, []);
    gruppi.get(g)!.push({ title, desc, path });
  }
  const nomi = [...gruppi.keys()].sort((a, b) => {
    const ia = a === "Optional" ? 999 : ORDINE.indexOf(a) < 0 ? 500 : ORDINE.indexOf(a);
    const ib = b === "Optional" ? 999 : ORDINE.indexOf(b) < 0 ? 500 : ORDINE.indexOf(b);
    return ia - ib;
  });
  return nomi.map((n) => ({ nome: n, pagine: gruppi.get(n)! }));
}
function creaLlms(FILES: Record<string, { t?: string }>, base: string) {
  const home = metaPagina(FILES["index.html"]?.t || "");
  const out: string[] = ["# Dott. Umberto Fama", "", "> " + (home.desc || "Chirurgo plastico a Roma e Aprilia"), ""];
  out.push("Sito del Dott. Umberto Fama, medico chirurgo specialista in Chirurgia Plastica, Ricostruttiva ed Estetica, con sedi a Roma e Aprilia. Ogni pagina è disponibile anche in formato Markdown inviando l’intestazione `Accept: text/markdown`. Catalogo in formato JSON: " + base + "/ai-catalog.json", "");
  for (const g of elencoPagine(FILES)) {
    out.push("## " + g.nome, "");
    for (const p of g.pagine) out.push("- [" + p.title + "](" + base + p.path + ")" + (p.desc ? ": " + p.desc : ""));
    out.push("");
  }
  return out.join("\n");
}
function creaCatalogo(FILES: Record<string, { t?: string }>, base: string) {
  const home = metaPagina(FILES["index.html"]?.t || "");
  return JSON.stringify({
    name: "Dott. Umberto Fama",
    description: home.desc,
    url: base + "/",
    canonical_url: home.canon || undefined,
    language: "it",
    resources: {
      llms_txt: base + "/llms.txt",
      sitemap: base + "/sitemap.xml",
      robots: base + "/robots.txt",
      markdown: { how: "Richiedere qualsiasi pagina con l’intestazione Accept: text/markdown", content_type: "text/markdown; charset=utf-8" },
    },
    sections: elencoPagine(FILES).map((g) => ({ name: g.nome, pages: g.pagine.map((p) => ({ title: p.title, url: base + p.path, description: p.desc })) })),
  }, null, 2);
}
function paginaMd(t: string, base: string, path: string) {
  const { title, desc, canon } = metaPagina(t);
  const i = t.search(/<main[\s>]/); const j = t.lastIndexOf("</main>");
  const corpo = i >= 0 && j > i ? t.slice(i, j + 7) : t;
  const fm = ["---", "title: " + JSON.stringify(title), "description: " + JSON.stringify(desc), "url: " + JSON.stringify(base + path), canon ? "canonical: " + JSON.stringify(canon) : "", "---", ""].filter((x, k, a) => x !== "" || k === a.length - 1);
  return fm.join("\n") + "\n" + htmlToMd(corpo, base);
}

// === MCP (endpoint /mcp, sola lettura) + WebMCP (navigator.modelContext) + Server Card ===
const MCP_VER = "2025-06-18";
const MCP_INFO = { name: "dottorfama-sito", title: "Sito del Dott. Umberto Fama", version: "1.0.0" };
const MCP_TOOLS = [
  { name: "cerca_pagine", title: "Cerca nel sito", description: "Cerca tra le pagine del sito (trattamenti, sedi, blog, informazioni) per parole chiave nel titolo e nella descrizione. Restituisce titolo, indirizzo e descrizione delle pagine trovate.", inputSchema: { type: "object", properties: { query: { type: "string", description: "Parole da cercare, ad esempio: blefaroplastica, Aprilia, laser" }, max: { type: "integer", minimum: 1, maximum: 30, description: "Numero massimo di risultati (predefinito 10)" } }, required: ["query"], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "leggi_pagina", title: "Leggi una pagina", description: "Restituisce il contenuto di una pagina del sito in formato Markdown, dato il suo percorso (ad esempio /blefaroplastica-roma-aprilia/ o /contatti/).", inputSchema: { type: "object", properties: { path: { type: "string", description: "Percorso della pagina sul sito, che inizia con /" } }, required: ["path"], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "elenco_sezioni", title: "Sezioni del sito", description: "Elenca le sezioni del sito (aree di trattamento, sedi, blog, pagine informative) con le relative pagine.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false } },
];
function normTxt(s: string) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
function mcpCerca(query: string, max = 10) {
  const parole = normTxt(String(query || "")).split(/\s+/).filter(Boolean);
  const out: { title: string; path: string; desc: string; sezione: string }[] = [];
  for (const g of elencoPagine(FILES)) for (const p of g.pagine) {
    const t = normTxt(p.title + " " + p.desc + " " + g.nome + " " + p.path);
    if (parole.length && parole.every((w) => t.includes(w))) out.push({ ...p, sezione: g.nome });
  }
  return out.slice(0, Math.max(1, Math.min(30, Number(max) || 10)));
}
function mcpPagina(path: string, base: string) {
  let p = String(path || "/");
  try { p = new URL(p, base + "/").pathname; } catch {}
  if (!p.startsWith("/")) p = "/" + p;
  const k = chiaveFile(p.endsWith("/") || p.endsWith(".html") ? p : p + "/");
  if (!FILES[k]?.t || !k.endsWith(".html")) return null;
  return paginaMd(FILES[k].t!, base, "/" + k.replace(/index\.html$/, ""));
}
function mcpTesto(t: string, err = false) { return { content: [{ type: "text", text: t }], ...(err ? { isError: true } : {}) }; }
function mcpChiama(nome: string, args: any, base: string) {
  if (nome === "cerca_pagine") {
    const r = mcpCerca(args?.query, args?.max);
    return mcpTesto(r.length ? r.map((x) => `- [${x.title}](${base}${x.path}) (${x.sezione})${x.desc ? ": " + x.desc : ""}`).join("\n") : "Nessuna pagina trovata per: " + String(args?.query || ""));
  }
  if (nome === "leggi_pagina") { const md = mcpPagina(args?.path, base); return md ? mcpTesto(md) : mcpTesto("Pagina non trovata: " + String(args?.path || ""), true); }
  if (nome === "elenco_sezioni") return mcpTesto(elencoPagine(FILES).map((g) => `## ${g.nome}\n` + g.pagine.map((p) => `- [${p.title}](${base}${p.path})`).join("\n")).join("\n\n"));
  return null;
}
function mcpRisorse(base: string) {
  return [
    { uri: base + "/llms.txt", name: "llms.txt", title: "Indice del sito per agenti", mimeType: "text/plain", description: "Elenco ragionato delle pagine del sito in formato llms.txt" },
    { uri: base + "/ai-catalog.json", name: "ai-catalog", title: "Catalogo del sito", mimeType: "application/json", description: "Sezioni e pagine del sito in formato JSON" },
  ];
}
function mcpGestisci(m: any, base: string): any {
  if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return { jsonrpc: "2.0", id: m?.id ?? null, error: { code: -32600, message: "Richiesta non valida" } };
  if (m.id === undefined || m.id === null) return undefined; // notifica
  const ok = (result: any) => ({ jsonrpc: "2.0", id: m.id, result });
  const ko = (code: number, message: string) => ({ jsonrpc: "2.0", id: m.id, error: { code, message } });
  switch (m.method) {
    case "initialize": return ok({ protocolVersion: MCP_VER, capabilities: { tools: { listChanged: false }, resources: { listChanged: false } }, serverInfo: MCP_INFO, instructions: "Server in sola lettura sul sito del Dott. Umberto Fama (chirurgo plastico, Roma e Aprilia). Permette di cercare e leggere le pagine pubbliche; non prenota visite e non raccoglie dati personali." });
    case "ping": return ok({});
    case "tools/list": return ok({ tools: MCP_TOOLS });
    case "tools/call": { const r = mcpChiama(m.params?.name, m.params?.arguments || {}, base); return r ? ok(r) : ko(-32602, "Strumento sconosciuto: " + String(m.params?.name)); }
    case "resources/list": return ok({ resources: mcpRisorse(base) });
    case "resources/templates/list": return ok({ resourceTemplates: [] });
    case "prompts/list": return ok({ prompts: [] });
    case "resources/read": {
      const uri = String(m.params?.uri || "");
      if (uri === base + "/llms.txt") return ok({ contents: [{ uri, mimeType: "text/plain", text: creaLlms(FILES, base) }] });
      if (uri === base + "/ai-catalog.json") return ok({ contents: [{ uri, mimeType: "application/json", text: creaCatalogo(FILES, base) }] });
      return ko(-32002, "Risorsa non trovata: " + uri);
    }
    default: return ko(-32601, "Metodo non supportato: " + m.method);
  }
}
const CORS: Record<string, string> = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id", "access-control-expose-headers": "mcp-protocol-version" };
async function mcpHttp(req: Request, base: string) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response("Usare POST con messaggi JSON-RPC (MCP streamable HTTP, senza stream SSE)", { status: 405, headers: { allow: "POST, OPTIONS", ...CORS } });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON non valido" } }, { status: 400, headers: CORS }); }
  const lista = Array.isArray(body) ? body : [body];
  const risposte = lista.map((m) => mcpGestisci(m, base)).filter((x) => x !== undefined);
  if (!risposte.length) return new Response(null, { status: 202, headers: CORS });
  return new Response(JSON.stringify(Array.isArray(body) ? risposte : risposte[0]), { headers: { "content-type": "application/json; charset=utf-8", "mcp-protocol-version": MCP_VER, "cache-control": "no-store", ...CORS } });
}
function serverCard(base: string) {
  return JSON.stringify({
    name: "it.dottorfamaumberto/sito",
    version: MCP_INFO.version,
    title: MCP_INFO.title,
    description: "Server MCP in sola lettura per cercare e leggere le pagine pubbliche del sito del Dott. Umberto Fama, chirurgo plastico a Roma e Aprilia. Non prenota visite e non raccoglie dati personali.",
    websiteUrl: base + "/",
    protocolVersion: MCP_VER,
    serverInfo: MCP_INFO,
    remotes: [{ type: "streamable-http", url: base + "/mcp" }],
    transport: { type: "streamable-http", url: base + "/mcp" },
    authentication: { required: false },
    capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
    tools: MCP_TOOLS,
    resources: mcpRisorse(base),
    prompts: [],
    documentation: base + "/llms.txt",
  }, null, 2);
}
const WEBMCP_JS = `/* WebMCP: strumenti in sola lettura per agenti AI nel browser (navigator.modelContext) */
(function () {
  var mc = navigator.modelContext;
  if (!mc) return;
  var testo = function (t) { return { content: [{ type: "text", text: String(t) }] }; };
  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase(); };
  var catalogo = null;
  function cat() { return catalogo || (catalogo = fetch("/ai-catalog.json", { headers: { accept: "application/json" } }).then(function (r) { return r.json(); })); }
  function percorso(p) { var u = new URL(String(p || "/"), location.origin); if (u.origin !== location.origin) throw new Error("Sono ammesse solo pagine di questo sito"); return u.pathname + u.hash; }
  var tools = [
    { name: "cerca_pagine", title: "Cerca nel sito", description: ${JSON.stringify(MCP_TOOLS[0].description)}, inputSchema: ${JSON.stringify(MCP_TOOLS[0].inputSchema)}, annotations: { readOnlyHint: true },
      execute: function (a) { return cat().then(function (c) { var w = norm(a && a.query).split(/\\s+/).filter(Boolean), out = []; c.sections.forEach(function (s) { s.pages.forEach(function (p) { var t = norm(p.title + " " + p.description + " " + s.name + " " + p.url); if (w.length && w.every(function (x) { return t.indexOf(x) >= 0; })) out.push("- [" + p.title + "](" + p.url + ") (" + s.name + ")" + (p.description ? ": " + p.description : "")); }); }); return testo(out.slice(0, (a && a.max) || 10).join("\\n") || "Nessuna pagina trovata"); }); } },
    { name: "leggi_pagina", title: "Leggi una pagina", description: ${JSON.stringify(MCP_TOOLS[1].description)}, inputSchema: ${JSON.stringify(MCP_TOOLS[1].inputSchema)}, annotations: { readOnlyHint: true },
      execute: function (a) { return fetch(percorso(a && a.path), { headers: { accept: "text/markdown" } }).then(function (r) { if (!r.ok) throw new Error("Pagina non trovata"); return r.text(); }).then(testo); } },
    { name: "elenco_sezioni", title: "Sezioni del sito", description: ${JSON.stringify(MCP_TOOLS[2].description)}, inputSchema: ${JSON.stringify(MCP_TOOLS[2].inputSchema)}, annotations: { readOnlyHint: true },
      execute: function () { return cat().then(function (c) { return testo(c.sections.map(function (s) { return "## " + s.name + "\\n" + s.pages.map(function (p) { return "- [" + p.title + "](" + p.url + ")"; }).join("\\n"); }).join("\\n\\n")); }); } },
    { name: "apri_pagina", title: "Apri una pagina del sito", description: "Porta l’utente su una pagina di questo sito, ad esempio /contatti/ per prenotare una visita o una scheda di trattamento. Non invia moduli e non inserisce dati.", inputSchema: { type: "object", properties: { path: { type: "string", description: "Percorso della pagina sul sito, che inizia con /" } }, required: ["path"], additionalProperties: false },
      execute: function (a) { var p = percorso(a && a.path); location.assign(p); return testo("Apertura di " + location.origin + p); } }
  ];
  try {
    if (typeof mc.provideContext === "function") mc.provideContext({ tools: tools });
    else if (typeof mc.registerTool === "function") tools.forEach(function (t) { mc.registerTool(t); });
  } catch (e) { if (window.console) console.warn("WebMCP non disponibile:", e); }
})();
`;
const TAG_WEBMCP = '<script src="/webmcp.js" defer></script>';
for (const k in FILES) {
  const t = FILES[k].t;
  if (!k.endsWith(".html") || !t || t.includes(TAG_WEBMCP)) continue;
  const i = t.lastIndexOf("</body>");
  if (i >= 0) FILES[k].t = t.slice(0, i) + TAG_WEBMCP + t.slice(i);
}

const CACHE_AG = new Map<string, string>();
const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8",
  xml: "application/xml; charset=utf-8", txt: "text/plain; charset=utf-8", svg: "image/svg+xml",
  jpg: "image/jpeg", png: "image/png", json: "application/json", webp: "image/webp", ico: "image/x-icon",
  pdf: "application/pdf", webmanifest: "application/manifest+json", woff2: "font/woff2",
};
function resp(path: string, status = 200, extra: Record<string, string> = {}) {
  const ext = path.split(".").pop()!.toLowerCase();
  const h: Record<string, string> = { "content-type": TYPES[ext] || "application/octet-stream", "x-robots-tag": "noindex, nofollow", "cache-control": ext === "woff2" ? "public, max-age=31536000, immutable" : "no-cache", ...extra };
  if (BIN[path]) return new Response(BIN[path], { status, headers: h });
  return new Response(FILES[path].t!, { status, headers: h });
}
Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  fetch(req) {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname);
    if (p === "/robots.txt") return new Response(FILES["robots.txt"]?.t || "User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" } });
    const proto = (req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "")).split(",")[0].trim();
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host).split(",")[0].trim();
    const base = proto + "://" + host;
    if (p === "/llms.txt") return new Response(CACHE_AG.get("llms " + base) ?? CACHE_AG.set("llms " + base, creaLlms(FILES, base)).get("llms " + base)!, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache", "x-robots-tag": "noindex, nofollow" } });
    if (p === "/ai-catalog.json") return new Response(CACHE_AG.get("cat " + base) ?? CACHE_AG.set("cat " + base, creaCatalogo(FILES, base)).get("cat " + base)!, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-cache", "x-robots-tag": "noindex, nofollow" } });
    if (p === "/mcp") return mcpHttp(req, base);
    if (p === "/.well-known/mcp/server-card.json" || p === "/.well-known/mcp.json") return new Response(serverCard(base), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-cache", "access-control-allow-origin": "*", "x-robots-tag": "noindex, nofollow" } });
    if (p === "/webmcp.js") return new Response(WEBMCP_JS, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" } });
    if (p === "/__stato") return Response.json({ file: Object.keys(FILES).length, foto: Object.keys(FOTO).filter((k) => BIN[k]), font: Object.keys(FONT).filter((k) => BIN[k]) });
    if (p.endsWith("/")) p += "index.html";
    p = p.replace(/^\/+/, "");
    if (!BIN[p] && FILES[p] && p.endsWith(".html")) {
      const vuoleMd = /text\/markdown(?!\s*;\s*q=0(\.0*)?\s*(,|$))/i.test(req.headers.get("accept") || "");
      const pagina = "/" + p.replace(/index\.html$/, "");
      const link = p === "index.html" ? { link: '</llms.txt>; rel="alternate"; type="text/markdown", </ai-catalog.json>; rel="describedby"; type="application/json", </sitemap.xml>; rel="sitemap"; type="application/xml", </.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"' } : {};
      if (vuoleMd) {
        const k = "md " + base + pagina;
        if (!CACHE_AG.has(k)) CACHE_AG.set(k, paginaMd(FILES[p].t!, base, pagina));
        return new Response(CACHE_AG.get(k)!, { headers: { "content-type": "text/markdown; charset=utf-8", "vary": "Accept", "cache-control": "no-cache", "x-robots-tag": "noindex, nofollow", ...link } });
      }
      return resp(p, 200, { "vary": "Accept", ...link });
    }
    if (BIN[p] || FILES[p]) return resp(p);
    if (FILES[p + "/index.html"]) return Response.redirect(u.pathname + "/", 301);
    if (FILES["404.html"]) return resp("404.html", 404);
    return new Response("Sito non ancora caricato", { status: 503 });
  },
});
console.log("sito pronto:", Object.keys(FILES).length, "file");
// Se le foto non sono arrivate (kit non raggiungibile), riprova ogni minuto per 30 minuti
let tentativi = 0;
const riprova = setInterval(async () => {
  if (Object.keys(FOTO).every((p) => BIN[p]) || ++tentativi > 30) { clearInterval(riprova); return; }
  await caricaFoto();
}, 60000);
