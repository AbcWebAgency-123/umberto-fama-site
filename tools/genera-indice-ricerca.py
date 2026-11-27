#!/usr/bin/env python3
"""Genera dist/static/js/cerca-indice.json per il motore di ricerca interno (static/js/cerca.js).

Per ogni pagina: titolo breve, tipo, area, e le radici delle parole (stem) divise per importanza:
titolo, parole chiave, sottotitoli, descrizione, testo. In più il dizionario di sinonimi
(tools/ricerca/dizionario.json) con le chiavi già ridotte a radice.
La normalizzazione e la radice delle parole sono identiche a quelle di cerca.js: se si cambia una, cambiare l'altra.

Uso: python3 tools/genera-indice-ricerca.py   (poi: node tools/ricerca/verifica.js)
"""
import collections, json, math, pathlib, re, sys, unicodedata

RADICE = pathlib.Path(__file__).resolve().parent.parent
DIST = RADICE / "dist"
OUT = DIST / "static/js/cerca-indice.json"

STOP = set("""a ad al allo alla ai agli alle all anche avere b c che chi ci coi col come con cosa cui d da dal dallo dalla dai dagli dei
dalle dall degli del dello della delle dell di dopo dove e ed fra gli ha hai hanno ho i il in io l la le lei li lo loro lui ma me mi
mia mie miei mio molto ne negli nel nello nella nelle nell no non o od per perche piu po poco puo qual quale quali quando quanto
questa queste questi questo se sei si sia sono sopra sotto su sua sue sui sul sullo sulla sulle sull suo suoi ti tra tu tua tuo
un una uno vi voglio vorrei posso essere fare ho mio miei sua suoi e' x
tanto tanta tanti tante troppo troppa troppi troppe molta molti molte tutto tutta tutti tutte sempre ancora gia cosi davvero proprio
qualcosa qualche avrei avere vedo sento faccio sembra sembrano ogni""".split())

def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def stem(w: str) -> str:
    while len(w) > 2 and w[-1] in "aeiou":
        w = w[:-1]
    if len(w) > 2 and w[-1] == "h" and w[-2] in "cg":
        w = w[:-1]
    return w

def stems(s: str):
    return [stem(w) for w in norm(s).split() if w not in STOP and len(w) > 1]

# ---- pagine escluse e tipi ----
ESCLUSE = {"grazie", "privacy", "web-policy-privacy", "mappa-del-sito", "blog"}
TIPO_EXTRA = {  # pagine assenti dal vecchio indice
    "/carcinoma-basocellulare-metatipico-revisione-clinica/": ("Carcinoma basocellulare metatipico", "Articolo", "Chirurgia dermatologica"),
    "/chirurgia-genitali-esterni-femminili-roma-aprilia/": ("Chirurgia dei genitali esterni femminili (labioplastica)", "Trattamento", "Chirurgia estetica"),
    "/chirurgia-riparativa-lobo-auricolare-roma-aprilia/": ("Chirurgia riparativa del lobo auricolare", "Trattamento", "Chirurgia estetica"),
    "/dove-siamo/": ("Le sedi", "Pagina", ""),
    "/chi-sono/": ("Chi sono", "Pagina", ""),
    "/tecnologie/": ("Tecnologie laser", "Tecnologie", ""),
}
ORDINE_TIPI = ["Trattamento", "Area", "Tecnologie", "Pagina", "Sede", "Articolo"]

# vecchio indice: titoli brevi, tipo, area e parole chiave già scritte a mano
vecchio = {}
f = DIST / "static/js/cerca.js"
src = f.read_text(encoding="utf-8")
if src.startswith("window.CERCA_IDX="):
    vecchio = {i["u"]: i for i in json.loads(src[len("window.CERCA_IDX="):src.find("];") + 1])}
elif (RADICE / "tools/ricerca/indice-base.json").exists():
    vecchio = {i["u"]: i for i in json.loads((RADICE / "tools/ricerca/indice-base.json").read_text(encoding="utf-8"))}
if vecchio and not (RADICE / "tools/ricerca/indice-base.json").exists():
    (RADICE / "tools/ricerca/indice-base.json").write_text(json.dumps(list(vecchio.values()), ensure_ascii=False, indent=1), encoding="utf-8")

def testo_md(md: str):
    md = re.sub(r"^---\n.*?\n---\n", "", md, flags=re.S)
    titoli = " ".join(re.findall(r"^#{1,4} (.+)$", md, flags=re.M))
    corpo = re.sub(r"\]\([^)]*\)", "]", md)          # niente URL
    corpo = re.sub(r"[#*_>\[\]`|]", " ", corpo)
    return titoli, corpo

pagine = sorted(p for p in DIST.rglob("index.html") if p.parent != DIST)
docs = []
for p in pagine:
    rel = p.parent.relative_to(DIST).as_posix()
    if rel.split("/")[0] in ESCLUSE:
        continue
    u = f"/{rel}/"
    h = p.read_text(encoding="utf-8")
    md_path = p.with_name("index.md")
    md = md_path.read_text(encoding="utf-8") if md_path.exists() else ""
    desc = re.search(r'<meta name="description" content="([^"]*)"', h)
    desc = desc.group(1) if desc else ""
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
    h1 = re.sub(r"<[^>]+>", "", h1.group(1)).replace("&nbsp;", " ") if h1 else ""
    v = vecchio.get(u, {})
    t, k, a = TIPO_EXTRA.get(u, (v.get("t") or h1.split(":")[0].strip(), v.get("k") or "Pagina", v.get("a", "")))
    titoli, corpo = testo_md(md) if md else (h1, re.sub(r"<[^>]+>", " ", h))
    docs.append({"u": u, "t": t, "k": k, "a": a,
                 "_titolo": stems(t + " " + h1), "_chiavi": stems(v.get("w", "") + " " + a),
                 "_tit": stems(titoli), "_desc": stems(desc), "_corpo": stems(corpo)})

# radici troppo comuni nel testo (menu, firma, città): non servono a distinguere
df = collections.Counter()
for d in docs:
    df.update(set(d["_corpo"]))
N = len(docs)
comuni = {s for s, n in df.items() if n > 0.55 * N}

for d in docs:
    tf = collections.Counter(s for s in d["_corpo"] if s not in comuni and len(s) > 2)
    corpo = [s for s, n in tf.most_common(70) if n >= 2]
    gia = set()
    campi = []
    for campo in (d["_titolo"], d["_chiavi"], d["_tit"], d["_desc"], corpo):
        nuovi = []
        for s in campo:
            if s not in gia:
                gia.add(s); nuovi.append(s)
        campi.append(" ".join(nuovi))
    d["f"] = campi
    for x in ("_titolo", "_chiavi", "_tit", "_desc", "_corpo"):
        del d[x]

# ---- dizionario ----
diz = json.loads((RADICE / "tools/ricerca/dizionario.json").read_text(encoding="utf-8"))
urls = {d["u"] for d in docs}
voci, errori = [], []
for i, v in enumerate(diz["voci"]):
    pag = []
    for s in v["pagine"]:
        u = f"/{s.strip('/')}/"
        if u not in urls:
            errori.append(f"voce {i+1} ({v['chiavi'][0]}): pagina inesistente o esclusa: {s}")
        else:
            pag.append(u)
    chiavi = []
    for c in v["chiavi"]:
        st = stems(c)
        if st and st not in chiavi:
            chiavi.append(st)
    voci.append({"c": [" ".join(c) for c in chiavi], "p": pag, "x": " ".join(stems(v.get("termini", "")))})
if errori:
    print("\n".join(errori)); sys.exit(1)

out = {"v": 1, "stop": sorted(STOP), "tipi": ORDINE_TIPI, "docs": docs, "diz": voci}
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(docs)} pagine, {len(voci)} voci di dizionario, {OUT.stat().st_size // 1024} KB -> {OUT.relative_to(RADICE)}")
