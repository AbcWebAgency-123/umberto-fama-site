# Sito Dott. Umberto Fama

Sito statico pronto per l'hosting Aruba (Apache + PHP), esportato dalla preview Railway
(https://sito-production-fc43.up.railway.app).

## Struttura

| Cartella | Contenuto |
|---|---|
| `dist/` | **Il sito da pubblicare**: pagine HTML, versioni Markdown (`index.md`), CSS, JS, font, immagini, `.htaccess`, `robots.txt`, `sitemap.xml`, `llms.txt`, `ai-catalog.json`, `webmcp.js`, `.well-known/mcp/server-card.json`, `mcp.php` |
| `tools/esporta_preview.py` | Script che rigenera `dist/` scaricando la preview Railway e sostituendo gli indirizzi con `https://www.dottorfamaumberto.it` |
| `preview-railway/` | Solo riferimento: codice del server Bun della preview e registro delle modifiche. Non viene pubblicato su Aruba |

Non serve nessuna build: `dist/` va caricata così com'è (vedi `.github/workflows/deploy-aruba.yml`, da aggiungere).

## Equivalenze preview → Aruba

- Markdown per agenti (`Accept: text/markdown`) → regola in `dist/.htaccess` che serve `index.md`
- Intestazioni `Link` e `Vary` sulla home → `dist/.htaccess` (mod_headers)
- Endpoint MCP `/mcp` → `dist/mcp.php` (PHP 8.1 o superiore)
- `X-Robots-Tag: noindex` e robots.txt della preview → **non** presenti: in produzione il sito è indicizzabile
- 301 `/chi-siamo/` → `/chi-sono/` e barra finale → `dist/.htaccess`

## Da completare prima della messa online

1. `invia.php`: il modulo contatti invia a `/invia.php`, che non esiste ancora; togliere anche la nota «Versione di anteprima» nella pagina Contatti.
2. Alcune immagini restano sul vecchio WordPress (`/wp-content/uploads/...`): non cancellare quella cartella dal server, oppure copiare le immagini nel repository.
3. Attivare in `dist/.htaccess` il redirect a https/www dopo aver verificato il certificato SSL.
4. Su Aruba impostare PHP 8.1 o superiore (per `mcp.php`).

## Rigenerare dist/

```bash
python3 tools/esporta_preview.py https://sito-production-fc43.up.railway.app dist
```
Dopo l'esportazione vanno ripristinati i file specifici di produzione (`.htaccess`, `robots.txt`, `mcp.php`, immagini in `static/img/`).
