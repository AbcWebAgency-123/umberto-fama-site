#!/usr/bin/env python3
"""Riporta nelle pagine statiche il numero di recensioni MioDottore e la data di rilevazione
letti da dist/data/miodottore.json (scritto da tools/aggiorna-miodottore.php).

HTML: elementi con data-md="recensioni" (testo e data-count) e data-md="data".
Markdown (versioni per motori di ricerca e AI): index.md e recensioni/index.md.

Uso: python3 tools/applica-recensioni.py [cartella-dist]
Esce senza toccare nulla se il JSON manca o non è valido.
"""
import json
import pathlib
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
        "agosto", "settembre", "ottobre", "novembre", "dicembre"]

dist = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent / "dist")
try:
    dati = json.loads((dist / "data" / "miodottore.json").read_text(encoding="utf-8"))
    n = int(dati["reviewCount"])
    quando = datetime.fromisoformat(dati["updatedAt"]).astimezone(ZoneInfo("Europe/Rome"))
except (OSError, ValueError, KeyError, TypeError) as e:
    print(f"miodottore.json assente o non valido ({e}): pagine invariate")
    sys.exit(0)
if n < 1:
    print("Numero di recensioni non valido: pagine invariate")
    sys.exit(0)

num = str(n)
data = f"{quando.day} {MESI[quando.month - 1]} {quando.year}"
DATA_RE = r"\d{1,2} (?:%s) \d{4}" % "|".join(MESI)

def html(t: str) -> str:
    # <tag ... data-md="recensioni" ...>932</tag>: numero nel testo e in data-count
    def tag(m):
        apertura = re.sub(r'data-count="\d+"', f'data-count="{num}"', m.group(1))
        return f"{apertura}{num}{m.group(2)}"
    t = re.sub(r'(<[^<>]*\bdata-md="recensioni"[^<>]*>)\d+(<)', tag, t)
    t = re.sub(r'(<[^<>]*\bdata-md="data"[^<>]*>)[^<]*(<)', lambda m: f"{m.group(1)}{data}{m.group(2)}", t)
    return t

MD = {
    "index.md": [
        (r"(- \*\*)\d+(\*\* recensioni su MioDottore)", rf"\g<1>{num}\g<2>"),
        (r"(- MioDottore \*\*)\d+(\*\* recensioni dei pazienti)", rf"\g<1>{num}\g<2>"),
        (rf"(Dati rilevati il ){DATA_RE}", rf"\g<1>{data}"),
    ],
    "recensioni/index.md": [
        (r"(^\*\*)\d+(\*\*\s*\n\s*\nrecensioni dei pazienti sul profilo MioDottore)", rf"\g<1>{num}\g<2>"),
        (rf"(Dato aggiornato al ){DATA_RE}", rf"\g<1>{data}"),
    ],
}

cambiati = []
for p in sorted(dist.rglob("*.html")):
    t = p.read_text(encoding="utf-8")
    if 'data-md="' in t:
        nuovo = html(t)
        if nuovo != t:
            p.write_text(nuovo, encoding="utf-8")
            cambiati.append(p)
for nome, regole in MD.items():
    p = dist / nome
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    nuovo = t
    for patt, sost in regole:
        nuovo, k = re.subn(patt, sost, nuovo, flags=re.M)
        if k == 0:
            print(f"Attenzione: in {nome} non trovato {patt!r}")
    if nuovo != t:
        p.write_text(nuovo, encoding="utf-8")
        cambiati.append(p)

print(f"{num} recensioni, rilevate il {data}: {len(cambiati)} file aggiornati")
