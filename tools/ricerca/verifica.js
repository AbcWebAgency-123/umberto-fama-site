// Verifica del motore di ricerca: node tools/ricerca/verifica.js [--tutto]
// Per ogni ricerca: «primo» = pagina attesa in prima posizione; «contiene» = pagine che devono comparire;
// «non» = pagine che non devono comparire. Esce con codice 1 se qualcosa non va.
const fs = require("fs"), path = require("path");
const dist = path.join(__dirname, "../../dist");
global.window = {};
eval(fs.readFileSync(path.join(dist, "static/js/cerca.js"), "utf8"));
const C = window.CERCA;
C.usa(JSON.parse(fs.readFileSync(path.join(dist, "static/js/cerca-indice.json"), "utf8")));

const P = s => "/" + s + "/";
const casi = [
  // --- i 12 esempi della home ---
  { q: "Rughe", primo: "rughe-ringiovanimento-cutaneo-laser-skin-resurfacing-roma-aprilia", contiene: ["tossina-botulinica-roma-aprilia", "specialista-trattamento-fillers-riassorbibili-roma-aprilia", "laser-frazionato-roma-aprilia", "lifting-facciale-roma", "tecnologie", "fraxel-laser-cura-pelle"], non: ["specialista-addominoplastica-roma-aprilia"] },
  { q: "Macchie", primo: "trattamento-laser-iperpigmentazioni-macchie-pelle-roma-aprilia", contiene: ["fotoringiovanimento-roma-aprilia", "angiomi-capillari-roma-aprilia", "come-eliminare-capillari-macchie-rosse-viso-laser-ktp"], non: ["mastoplastica-additiva-roma-parioli-aprilia"] },
  { q: "Nei", primo: "asportazione-nevi-roma-aprilia", contiene: ["nevi-verruche-cisti-fibromi-condilomi-roma-aprilia", "chirurgia-del-melanoma", "chirurgia-dermatologica-roma-aprilia", "melanoma-riconoscerlo-curarlo-in-tempo"], non: ["rinoplastica-aprilia-roma"] },
  { q: "Cicatrici", primo: "cicatrici-cheloidi-esiti-acne-roma-aprilia", contiene: ["laser-frazionato-roma-aprilia", "come-curare-cicatrici-patologiche", "come-eliminare-cicatrici-acne-laser-ultrapulse-lumenis", "lipofilling"], non: [] },
  { q: "Seno", primo: "mastoplastica-additiva-roma-parioli-aprilia", contiene: ["specialista-mastopessi-roma-aprilia", "mastoplastica-riduttiva-aprilia-roma", "ginecomastia-roma-aprilia", "come-proteggere-seno-dalle-protesi-bia-alcl", "prevenire-curare-contrattura-capsulare-dopo-mastoplastica-additiva"], non: ["rinoplastica-aprilia-roma"] },
  { q: "Pancia", primo: "specialista-addominoplastica-roma-aprilia", contiene: ["miniaddominoplastica-roma", "liposuzione-specialista-trattamento-liposcultura-roma-aprilia", "liposcultura-non-chirurgica-roma-aprilia"], non: ["mastoplastica-additiva-roma-parioli-aprilia"] },
  { q: "Palpebre", primo: "blefaroplastica-roma-aprilia", contiene: ["ringiovanire-sguardo-senza-bisturi-il-laser-resurfacing-palpebra-inferiore"], non: ["specialista-addominoplastica-roma-aprilia"] },
  { q: "Naso", primo: "rinoplastica-aprilia-roma", contiene: ["rinofiller-roma"], non: ["mastoplastica-additiva-roma-parioli-aprilia"] },
  { q: "Orecchie", primo: "specialista-otoplastica-roma-aprilia", contiene: ["chirurgia-riparativa-lobo-auricolare-roma-aprilia"], non: [] },
  { q: "Capelli", primo: "trattamento-prp-roma-cuoio-capelluto-terapia-alopecia", contiene: ["trattamento-prp-roma-soluzione-alopecia", "come-scegliere-centro-giusto-trattamento-prp-calvizie", "medicina-rigenerativa"], non: ["depilazione-laser-roma-aprilia"] },
  { q: "Smagliature", primo: "trattamento-smagliature-roma", contiene: ["trattamento-laser-smagliature-roma-aprilia", "laser-frazionato-roma-aprilia"], non: [] },
  { q: "Tumori cutanei", primo: "asportazione-tumori-cutanei-roma-aprilia", contiene: ["chirurgia-micrografica-di-mohs", "chirurgia-del-melanoma", "chirurgia-dermatologica-roma-aprilia", "carcinoma-basocellulare-metatipico-revisione-clinica", "chirurgia-mohs-soluzione-tumori-cutanei-roma", "melanoma-riconoscerlo-curarlo-in-tempo"], non: ["mastoplastica-additiva-roma-parioli-aprilia"] },
  // --- tabella dei termini dei pazienti ---
  { q: "Orecchie a sventola", primo: "specialista-otoplastica-roma-aprilia" },
  { q: "Buco dell'orecchio allargato", primo: "chirurgia-riparativa-lobo-auricolare-roma-aprilia" },
  { q: "Borse sotto gli occhi", primo: "blefaroplastica-roma-aprilia" },
  { q: "Palpebre cadenti", primo: "blefaroplastica-roma-aprilia" },
  { q: "Sudorazione eccessiva", primo: "trattamento-iperidrosi-roma-sudorazione-eccessiva", contiene: ["trattamento-iperidrosi-roma-cura-tossina-botulinica"] },
  { q: "Capillari", primo: "angiomi-capillari-roma-aprilia", contiene: ["teleangectasie-varici-roma-aprilia", "couperose-rosacea-roma-aprilia", "come-eliminare-capillari-macchie-rosse-viso-laser-ktp"] },
  { q: "Couperose", primo: "couperose-rosacea-roma-aprilia", contiene: ["angiomi-capillari-roma-aprilia", "come-eliminare-capillari-macchie-rosse-viso-laser-ktp"] },
  { q: "Tatuaggi", primo: "rimozione-laser-tatuaggi-roma-aprilia" },
  { q: "Labbra sottili", primo: "rimodellamento-labbra-roma", contiene: ["specialista-trattamento-fillers-riassorbibili-roma-aprilia"], non: ["chirurgia-genitali-esterni-femminili-roma-aprilia"] },
  { q: "Perdita di capelli", primo: "trattamento-prp-roma-cuoio-capelluto-terapia-alopecia", contiene: ["trattamento-prp-roma-soluzione-alopecia"] },
  { q: "Cisti e lipomi", primo: "asportazione-cisti-roma-aprilia", contiene: ["nevi-verruche-cisti-fibromi-condilomi-roma-aprilia", "chirurgia-dermatologica-roma-aprilia"] },
  { q: "Epitelioma", primo: "asportazione-tumori-cutanei-roma-aprilia", contiene: ["chirurgia-micrografica-di-mohs", "carcinoma-basocellulare-metatipico-revisione-clinica"] },
  { q: "Pelle in eccesso", primo: "specialista-addominoplastica-roma-aprilia", contiene: ["miniaddominoplastica-roma", "lifting-delle-braccia", "lifting-cosce-braccia-aprilia-roma", "brachioplastica-rimodellare-braccia-dopo-dimagrimento"] },
  { q: "Labbra genitali", primo: "chirurgia-genitali-esterni-femminili-roma-aprilia", non: ["rimodellamento-labbra-roma"] },
  { q: "Acne", primo: "cicatrici-cheloidi-esiti-acne-roma-aprilia", contiene: ["come-eliminare-cicatrici-acne-laser-ultrapulse-lumenis", "luce-pulsata-alta-intensita-soluzione-per-acne-rosacea"] },
  { q: "Doppio mento", primo: "lifting-facciale-roma", contiene: ["liposcultura-non-chirurgica-roma-aprilia", "liposuzione-specialista-trattamento-liposcultura-roma-aprilia"] },
  { q: "Peli superflui", primo: "depilazione-laser-roma-aprilia" },
  { q: "Viso cadente", primo: "lifting-facciale-roma", contiene: ["lipofilling", "specialista-trattamento-fillers-riassorbibili-roma-aprilia"] },
  // --- plurali, singolari, refusi, modi di dire ---
  { q: "ruga", primo: "rughe-ringiovanimento-cutaneo-laser-skin-resurfacing-roma-aprilia" },
  { q: "macchia", primo: "trattamento-laser-iperpigmentazioni-macchie-pelle-roma-aprilia" },
  { q: "neo", primo: "asportazione-nevi-roma-aprilia" },
  { q: "cicatrice", primo: "cicatrici-cheloidi-esiti-acne-roma-aprilia" },
  { q: "palpebra", primo: "blefaroplastica-roma-aprilia" },
  { q: "orecchio", primo: "specialista-otoplastica-roma-aprilia" },
  { q: "capello", primo: "trattamento-prp-roma-cuoio-capelluto-terapia-alopecia" },
  { q: "smagliatura", primo: "trattamento-smagliature-roma" },
  { q: "tumore della pelle", primo: "asportazione-tumori-cutanei-roma-aprilia" },
  { q: "rughhe", primo: "rughe-ringiovanimento-cutaneo-laser-skin-resurfacing-roma-aprilia" },
  { q: "machie", primo: "trattamento-laser-iperpigmentazioni-macchie-pelle-roma-aprilia" },
  { q: "cicatrcii", primo: "cicatrici-cheloidi-esiti-acne-roma-aprilia" },
  { q: "smagliatrue", primo: "trattamento-smagliature-roma" },
  { q: "blefaroplasica", primo: "blefaroplastica-roma-aprilia" },
  { q: "rinoplatica", primo: "rinoplastica-aprilia-roma" },
  { q: "orecchie a sventla", primo: "specialista-otoplastica-roma-aprilia" },
  { q: "melanona", primo: "chirurgia-del-melanoma" },
  { q: "basalioma", primo: "asportazione-tumori-cutanei-roma-aprilia" },
  { q: "carcinoma basocellulare", contiene: ["asportazione-tumori-cutanei-roma-aprilia", "carcinoma-basocellulare-metatipico-revisione-clinica", "chirurgia-micrografica-di-mohs"] },
  { q: "neo sospetto", primo: "asportazione-nevi-roma-aprilia", contiene: ["chirurgia-del-melanoma"] },
  { q: "mohs", primo: "chirurgia-micrografica-di-mohs" },
  { q: "chirurgia ricostruttiva", primo: "chirurgia-dermatologica-roma-aprilia", contiene: ["asportazione-tumori-cutanei-roma-aprilia", "chirurgia-micrografica-di-mohs"] },
  { q: "lipoma", primo: "asportazione-cisti-roma-aprilia" },
  { q: "verruche", primo: "nevi-verruche-cisti-fibromi-condilomi-roma-aprilia" },
  { q: "botox", primo: "tossina-botulinica-roma-aprilia" },
  { q: "calvizie", primo: "trattamento-prp-roma-cuoio-capelluto-terapia-alopecia" },
  { q: "vene varicose", primo: "teleangectasie-varici-roma-aprilia" },
  { q: "rifare il seno", primo: "mastoplastica-additiva-roma-parioli-aprilia" },
  { q: "seno cadente", primo: "specialista-mastopessi-roma-aprilia" },
  { q: "gobba sul naso", primo: "rinoplastica-aprilia-roma" },
  { q: "depilazione", primo: "depilazione-laser-roma-aprilia" },
  { q: "laser co2", contiene: ["tecnologie"] },
  { q: "lobo strappato", primo: "chirurgia-riparativa-lobo-auricolare-roma-aprilia" },
  { q: "labioplastica", primo: "chirurgia-genitali-esterni-femminili-roma-aprilia" },
  { q: "dieta", primo: "dietologia-percorsi-detox-roma-aprilia" },
  { q: "ginecomastia", primo: "ginecomastia-roma-aprilia" },
  { q: "addominoplastica", primo: "specialista-addominoplastica-roma-aprilia" },
  { q: "cellulite", primo: "specialista-trattamento-cellulite-roma-aprilia" },
  { q: "sudo tanto sotto le ascelle", primo: "trattamento-iperidrosi-roma-sudorazione-eccessiva" },
];

let errori = 0;
const tutto = process.argv.includes("--tutto");
for (const c of casi) {
  const r = C.cerca(c.q), urls = r.map(x => x.u), msg = [];
  if (c.primo && urls[0] !== P(c.primo)) msg.push(`primo atteso ${c.primo}, trovato ${urls[0] || "(nessuno)"}`);
  for (const s of c.contiene || []) if (!urls.includes(P(s))) msg.push(`manca ${s}`);
  for (const s of c.non || []) if (urls.includes(P(s))) msg.push(`non dovrebbe esserci ${s}`);
  if (msg.length) errori++;
  if (msg.length || tutto) {
    console.log(`${msg.length ? "✗" : "✓"} «${c.q}» → ${r.length} risultati${msg.length ? ": " + msg.join("; ") : ""}`);
    if (tutto || msg.length) r.slice(0, tutto ? 40 : 8).forEach((x, i) => console.log(`     ${String(i + 1).padStart(2)}. [${x.k}] ${x.t}  (${x.s})`));
  }
}
console.log(`\n${casi.length - errori}/${casi.length} ricerche corrette`);
process.exit(errori ? 1 : 0);
