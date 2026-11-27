# Sito Dott. Umberto Fama

Sito statico pronto per l'hosting Aruba (Apache + PHP), esportato dalla preview Railway
(https://sito-production-fc43.up.railway.app).

## Struttura

| Cartella | Contenuto |
|---|---|
| `dist/` | **Il sito da pubblicare**: pagine HTML, versioni Markdown (`index.md`), CSS, JS, font, immagini, `.htaccess`, `robots.txt`, `sitemap.xml`, `llms.txt`, `ai-catalog.json`, `webmcp.js`, `.well-known/mcp/server-card.json`, `mcp.php` |
| `tools/esporta_preview.py` | Script che rigenera `dist/` scaricando la preview Railway e sostituendo gli indirizzi con `https://www.dottorfamaumberto.it` |
| `preview-railway/` | Solo riferimento: codice del server Bun della preview e registro delle modifiche. Non viene pubblicato su Aruba |

Non serve nessuna build: `dist/` va caricata così com'è tramite il workflow `.github/workflows/deploy-aruba.yml` (FTP verso Aruba; segreti `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`).

## Equivalenze preview → Aruba

- Markdown per agenti (`Accept: text/markdown`) → regola in `dist/.htaccess` che serve `index.md`
- Intestazioni `Link` e `Vary` sulla home → `dist/.htaccess` (mod_headers)
- Endpoint MCP `/mcp` → `dist/mcp.php` (PHP 8.1 o superiore)
- `X-Robots-Tag: noindex` e robots.txt della preview → **non** presenti: in produzione il sito è indicizzabile
- 301 dai vecchi indirizzi WordPress (`/chi-siamo/`, `/category/...`, `/author/wp-backend/...`, `/servizi/`, `/project/`, ecc.) e barra finale → `dist/.htaccess`

## Configurazione di produzione

- **Visita gratuita** (novembre 2026, `tools/prenota-gratuita.py`, rilanciabile): i pulsanti dicono «Prenota una visita
  gratuita» tranne nella pagina Dietologia (la visita nutrizionale non è gratuita); Contatti è la pagina di arrivo
  («Prenoti una visita gratuita», blocco «Come desidera contattarmi?» con agenda, WhatsApp e telefono); lo stesso blocco
  è nella sezione prenotazioni della home; barra mobile Prenota · WhatsApp · Chiama. Moduli di contatto tolti:
  copia in `tools/modulo-contatti-backup.html`.
- **Pagina Contatti**: a destra di «Chieda una visita» c'è il widget ufficiale di MioDottore (`umberto-fama-2`),
  trattato come «Contenuto esterno»: si carica se il visitatore ha accettato i contenuti esterni o se preme
  «Mostra l'agenda di MioDottore». Il modulo non ha più i menu Trattamento e Sede e si intitola «Scrivi al Dottore».
- **Recensioni MioDottore**: ogni giorno `.github/workflows/aggiorna-recensioni.yml` esegue
  `tools/aggiorna-miodottore.php`, che legge il numero di recensioni (`aggregateRating.reviewCount`) dal profilo
  MioDottore e scrive `dist/data/miodottore.json` solo se è cambiato; poi `tools/applica-recensioni.py` riporta
  numero e data nelle pagine HTML (elementi `data-md="recensioni"` e `data-md="data"`) e in `index.md` e
  `recensioni/index.md`. Se qualcosa cambia, il workflow fa il commit e pubblica con il deploy.
  `static/js/site.js` legge comunque il JSON, per le pagine rimaste in cache nel browser.
- **Modulo contatti**: `dist/invia.php` riceve il modulo della pagina Contatti e lo invia con `mail()` a
  `umbertofama65@gmail.com`, con mittente `noreply@dottorfamaumberto.it` e risposta diretta al paziente (Reply-To).
  Indirizzi e limite anti-spam (5 invii/ora per IP, più un campo trappola `sito_web`) si cambiano in cima al file.
- **Immagini del vecchio WordPress** (`/wp-content/uploads/...`): la cartella viene caricata a parte sul server;
  il deploy non la tocca.
- **https e www**: `dist/.htaccess` reindirizza `http://` e `dottorfamaumberto.it` a `https://www.dottorfamaumberto.it`.
- **Google Analytics** (snippet di Google `gtm.js?id=GTM-NCCVDKGP`, invariato): in ogni pagina, subito dopo i valori predefiniti di Consent Mode v2,
  con `type="text/plain" data-cc="statistiche"`. Il banner lo attiva solo dopo il consenso alle Statistiche
  (anche senza ricaricare la pagina); al dataLayer arriva anche l'evento `fama_consenso` con le scelte del visitatore.
  La cookie policy (`web-policy-privacy/`) elenca Google Analytics.
- **PHP**: su Aruba è attivo PHP 8.3 (servono almeno 8.1 per `mcp.php` e `invia.php`).

## Rigenerare dist/

```bash
python3 tools/esporta_preview.py https://sito-production-fc43.up.railway.app dist
```
Dopo l'esportazione vanno ripristinati i file specifici di produzione (`.htaccess`, `robots.txt`, `mcp.php`, `invia.php`, immagini in `static/img/`)
lo snippet GTM in tutte le pagine con il testo aggiornato del banner e della cookie policy,
gli attributi `data-md` sui numeri delle recensioni, e la pagina `contatti/index.html` con il widget di MioDottore, il modulo semplificato, senza la nota «Versione di anteprima» e con il campo trappola `sito_web`.
