#!/usr/bin/env python3
"""Esporta la preview Railway del sito del Dott. Umberto Fama in una cartella statica (dist/)
pronta per l'hosting Aruba. Uso: python3 tools/esporta_preview.py [URL_PREVIEW] [CARTELLA_OUT]
Scarica pagine HTML, versioni Markdown, asset statici e risorse per agenti AI;
riscrive gli indirizzi della preview con quelli di produzione."""
import os, re, sys, json, hashlib, urllib.request, urllib.parse

PREVIEW = (sys.argv[1] if len(sys.argv) > 1 else "https://sito-production-fc43.up.railway.app").rstrip("/")
OUT = sys.argv[2] if len(sys.argv) > 2 else "dist"
PROD = "https://www.dottorfamaumberto.it"
UA = {"User-Agent": "esporta-statico/1.0"}

def get(path, accept=None):
    h = dict(UA)
    if accept: h["Accept"] = accept
    req = urllib.request.Request(PREVIEW + path, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.headers.get("content-type", ""), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("content-type", ""), e.read()

def salva(rel, data):
    p = os.path.join(OUT, rel.lstrip("/"))
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    with open(p, "wb") as f: f.write(data)

def prod(txt):
    return txt.replace(PREVIEW, PROD)

pagine, asset, viste = [], set(), set()
st, _, sm = get("/sitemap.xml")
coda = ["/"] + [urllib.parse.urlparse(u).path for u in re.findall(r"<loc>([^<]+)</loc>", sm.decode())]
coda += ["/grazie/", "/404.html"]
while coda:
    p = coda.pop(0)
    if p in viste: continue
    viste.add(p)
    st, ct, b = get(p)
    if st != 200 or "text/html" not in ct:
        if p != "/404.html": print("salto", p, st, ct); continue
        if "text/html" not in ct: continue
    html = b.decode("utf-8")
    pagine.append(p)
    rel = p + "index.html" if p.endswith("/") else p
    for m in re.finditer(r'(?:href|src)="(/[^"#?]*)', html):
        u = m.group(1)
        if u.startswith("//"): continue
        if re.search(r"\.(css|js|png|jpe?g|webp|svg|ico|gif|avif|woff2?|webmanifest|json|xml|txt|pdf)$", u, re.I): asset.add(u)
        elif u.endswith("/") and u not in viste: coda.append(u)
    for m in re.finditer(r'url\((?:&quot;|["\'])?(/[^)"\'&]+)', html): asset.add(m.group(1))
    salva(rel, prod(html).encode("utf-8"))
    if p.endswith("/"):
        st2, ct2, md = get(p, "text/markdown")
        if st2 == 200 and "markdown" in ct2: salva(p + "index.md", prod(md.decode("utf-8")).encode("utf-8"))

# CSS: segue url(...) interni
for a in sorted(asset):
    if a.endswith(".css"):
        st, ct, b = get(a)
        if st == 200:
            for m in re.finditer(r'url\(["\']?(/[^)"\']+)', b.decode("utf-8", "ignore")): asset.add(m.group(1))
asset |= {"/favicon.ico", "/static/img/dottore.jpg", "/static/img/dottore-duo.jpg", "/static/img/dottore-blu.jpg"}
for a in sorted(asset):
    st, ct, b = get(a)
    if st != 200: print("asset mancante", a, st); continue
    if any(x in ct for x in ("text/", "json", "xml", "javascript")):
        b = prod(b.decode("utf-8")).encode("utf-8")
    salva(a, b)

for r, dest in (("/llms.txt", "llms.txt"), ("/ai-catalog.json", "ai-catalog.json"), ("/webmcp.js", "webmcp.js"),
                ("/.well-known/mcp/server-card.json", ".well-known/mcp/server-card.json")):
    st, ct, b = get(r)
    if st == 200: salva(dest, prod(b.decode("utf-8")).encode("utf-8"))
    else: print("risorsa mancante", r, st)

print(json.dumps({"pagine": len(pagine), "asset": len(asset)}, ensure_ascii=False))
