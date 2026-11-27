#!/usr/bin/env python3
"""Novembre 2026: «Prenota una visita gratuita», blocco «Come desidera contattarmi?» e nuova barra mobile.
Idempotente: si può rilanciare senza duplicare nulla. Uso: python3 tools/prenota-gratuita.py [dist]"""
import pathlib, re, sys

DIST = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent / "dist")
NUTRIZIONE = {"dietologia-percorsi-detox-roma-aprilia"}  # la visita nutrizionale non è gratuita

SVG = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"'
I_CAL = f'<svg {SVG}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M9 15.2l2 2 4-4"/></svg>'
I_WA = f'<svg {SVG}><path d="M4 20.5l1.4-4.1A8.3 8.3 0 1 1 8.4 19.3z"/></svg>'
I_TEL = f'<svg {SVG}><path d="M6.2 3.5h2.9l1.5 4.1-2 1.5a12 12 0 0 0 6.3 6.3l1.5-2 4.1 1.5v2.9a2 2 0 0 1-2.2 2A17 17 0 0 1 4.2 5.7a2 2 0 0 1 2-2.2z"/></svg>'
I_CHEV = f'<svg class="chev" {SVG}><path d="m9.5 6 6 6-6 6"/></svg>'
NT = '<span class="sr-only"> (si apre in una nuova scheda)</span>'
WA = "https://wa.me/393205676353"

def scelte(tag_h: str) -> str:
    return (
        '<div class="scelte">\n'
        f'  <{tag_h} class="scelte-h">Come desidera contattarmi?</{tag_h}>\n'
        '  <p class="scelte-p">Scelga la modalità più adatta alle Sue esigenze.</p>\n'
        '  <ul>\n'
        f'    <li><a class="sc sc-go" href="#prenota">{I_CAL}<span><b>Prenoti una visita gratuita</b><small>Scelga la sede, il giorno e l’orario disponibili.</small></span>{I_CHEV}</a></li>\n'
        f'    <li><a class="sc" href="{WA}" target="_blank" rel="noopener">{I_WA}<span><b>Mi scriva su WhatsApp</b><small>Per informazioni organizzative e sulle prenotazioni.</small></span>{I_CHEV}{NT}</a></li>\n'
        f'    <li><a class="sc" href="tel:+393205676353">{I_TEL}<span><b>Mi contatti telefonicamente</b><small>320 5676353 · per informazioni e appuntamenti.</small></span>{I_CHEV}</a></li>\n'
        '  </ul>\n'
        '  <p class="scelte-n">I canali di contatto non sono destinati alle emergenze sanitarie.</p>\n'
        '</div>'
    )

GRATUITA = ("La visita con il Dott. Umberto Fama è <strong>gratuita</strong> in tutte le sedi, "
            "ad eccezione della visita nutrizionale. Può prenotarla direttamente sull’agenda online di MioDottore, "
            "scrivere su WhatsApp o chiamare la segreteria.")
GRATUITA_MD = GRATUITA.replace("<strong>", "**").replace("</strong>", "**")

def mbar(href: str) -> str:
    return ('<nav class="mbar" aria-label="Contatti rapidi">\n'
            f'  <a class="go" href="{href}">{I_CAL}Prenota</a>\n'
            f'  <a href="{WA}" target="_blank" rel="noopener">{I_WA}WhatsApp{NT}</a>\n'
            f'  <a href="tel:+393205676353">{I_TEL}Chiama</a>\n'
            '</nav>')

MBAR_RE = re.compile(r'<nav class="mbar" aria-label="Contatti rapidi">.*?</nav>', re.S)
conti = {"pulsanti": 0, "mbar": 0}

for p in sorted(DIST.rglob("*.html")):
    rel = p.relative_to(DIST).parent.as_posix()
    s = p.read_text(encoding="utf-8"); o = s
    if rel.split("/")[0] not in NUTRIZIONE:
        s, k = re.subn(r'(<a\b[^>]*>)Prenota una visita(</a>)', r'\1Prenota una visita gratuita\2', s)
        conti["pulsanti"] += k
    if MBAR_RE.search(s):
        s = MBAR_RE.sub(mbar("#prenota" if rel == "contatti" else "/contatti/"), s, count=1)
        conti["mbar"] += 1
    if s != o:
        p.write_text(s, encoding="utf-8")

# --- Contatti: pagina di arrivo ---
p = DIST / "contatti/index.html"; s = p.read_text(encoding="utf-8")
if 'class="scelte"' not in s:
    for a, b in [
        ('<p class="eye">Prenota</p>\n  <h1>Chieda una <em>visita</em></h1>',
         '<p class="eye">Contatti e prenotazioni</p>\n  <h1>Prenoti una visita <em>gratuita</em></h1>'),
        ('<p class="lead">La prenotazione on-line dell’appuntamento avviene sull’agenda digitale di Mio Dottore: scelga data e sede, riceverà una e-mail di conferma. Oppure scriva su WhatsApp o chiami la segreteria.</p>',
         f'<p class="lead">{GRATUITA}</p>'),
    ]:
        assert a in s, a[:50]; s = s.replace(a, b)
    s, k = re.subn(r'\n  <p class="ph-cta">.*?</p>\n', '\n' + scelte("h2") + '\n', s, count=1, flags=re.S); assert k == 1
    s = s.replace('<title>Contatti | Dott. Umberto Fama</title>', '<title>Prenoti una visita gratuita | Dott. Umberto Fama</title>')
    s = s.replace('content="Prenota una visita con il Dott. Umberto Fama: agenda online MioDottore, WhatsApp, telefoni e le quattro sedi di Roma e Aprilia."',
                  'content="Prenoti una visita gratuita con il Dott. Umberto Fama (esclusa la visita nutrizionale): agenda online MioDottore, WhatsApp, telefono e le quattro sedi di Roma e Aprilia."')
    p.write_text(s, encoding="utf-8")

# --- Home: sezione prenotazioni ---
p = DIST / "index.html"; s = p.read_text(encoding="utf-8")
if 'class="scelte"' not in s:
    for a, b in [
        ('<h2 id="h-contatti">Prenoti la Sua <em>visita</em></h2>', '<h2 id="h-contatti">Prenoti una visita <em>gratuita</em></h2>'),
        ('<p>Chiami la segreteria, scriva su WhatsApp oppure scelga giorno, orario e sede sull’agenda online di MioDottore.</p>', f'<p>{GRATUITA}</p>'),
    ]:
        assert a in s, a[:50]; s = s.replace(a, b)
    s, k = re.subn(r'\n    <ul class="ways">.*?</ul>\n', '\n' + scelte("h3") + '\n', s, count=1, flags=re.S); assert k == 1
    s = s.replace('<aside class="zl-box" aria-label="Agenda di MioDottore">', '<aside class="zl-box" id="prenota" aria-label="Agenda di MioDottore">', 1)
    p.write_text(s, encoding="utf-8")

# --- Markdown ---
SC_MD = ("### Come desidera contattarmi?\n\nScelga la modalità più adatta alle Sue esigenze.\n\n"
         "- [Prenoti una visita gratuita](https://www.dottorfamaumberto.it/contatti/#prenota): scelga la sede, il giorno e l’orario disponibili.\n"
         f"- [Mi scriva su WhatsApp]({WA}): per informazioni organizzative e sulle prenotazioni.\n"
         "- [Mi contatti telefonicamente](tel:+393205676353): 320 5676353, per informazioni e appuntamenti.\n\n"
         "I canali di contatto non sono destinati alle emergenze sanitarie.\n")
p = DIST / "contatti/index.md"; m = p.read_text(encoding="utf-8")
if "Come desidera contattarmi" not in m:
    m = m.replace("# Chieda una visita", "# Prenoti una visita gratuita")
    m, k = re.subn(r"La prenotazione on-line dell’appuntamento avviene.*?\n\n\[Prenota su MioDottore[^\n]*\n", GRATUITA_MD + "\n\n" + SC_MD, m, count=1, flags=re.S); assert k == 1
    p.write_text(m, encoding="utf-8")
p = DIST / "index.md"; m = p.read_text(encoding="utf-8")
if "Come desidera contattarmi" not in m:
    m, k = re.subn(r"## Prenoti la Sua visita\n\n.*?\n\n- Segreteria · tutte le sedi.*?\[Apri l’agenda[^\n]*\n",
                   "## Prenoti una visita gratuita\n\n" + GRATUITA_MD + "\n\n" + SC_MD, m, count=1, flags=re.S); assert k == 1
    p.write_text(m, encoding="utf-8")
for p in DIST.rglob("*.md"):
    if p.parent.name in NUTRIZIONE: continue
    m = p.read_text(encoding="utf-8"); n = re.sub(r"\[Prenota una visita\]", "[Prenota una visita gratuita]", m)
    if n != m: p.write_text(n, encoding="utf-8")

print(conti)
