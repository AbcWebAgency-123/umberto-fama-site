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

- **Modulo contatti**: `dist/invia.php` riceve il modulo della pagina Contatti e lo invia con `mail()` a
  `umbertofama65@gmail.com`, con mittente `noreply@dottorfamaumberto.it` e risposta diretta al paziente (Reply-To).
  Indirizzi e limite anti-spam (5 invii/ora per IP, più un campo trappola `sito_web`) si cambiano in cima al file.
- **Immagini del vecchio WordPress** (`/wp-content/uploads/...`): la cartella viene caricata a parte sul server;
  il deploy non la tocca.
- **https e www**: `dist/.htaccess` reindirizza `http://` e `dottorfamaumberto.it` a `https://www.dottorfamaumberto.it`.
- **PHP**: su Aruba è attivo PHP 8.3 (servono almeno 8.1 per `mcp.php` e `invia.php`).

## Rigenerare dist/

```bash
python3 tools/esporta_preview.py https://sito-production-fc43.up.railway.app dist
```
Dopo l'esportazione vanno ripristinati i file specifici di produzione (`.htaccess`, `robots.txt`, `mcp.php`, `invia.php`, immagini in `static/img/`)
e la pagina `contatti/index.html` senza la nota «Versione di anteprima» e con il campo trappola `sito_web`.
