/* WebMCP: strumenti in sola lettura per agenti AI nel browser (navigator.modelContext) */
(function () {
  var mc = navigator.modelContext;
  if (!mc) return;
  var testo = function (t) { return { content: [{ type: "text", text: String(t) }] }; };
  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); };
  var catalogo = null;
  function cat() { return catalogo || (catalogo = fetch("/ai-catalog.json", { headers: { accept: "application/json" } }).then(function (r) { return r.json(); })); }
  function percorso(p) { var u = new URL(String(p || "/"), location.origin); if (u.origin !== location.origin) throw new Error("Sono ammesse solo pagine di questo sito"); return u.pathname + u.hash; }
  var tools = [
    { name: "cerca_pagine", title: "Cerca nel sito", description: "Cerca tra le pagine del sito (trattamenti, sedi, blog, informazioni) per parole chiave nel titolo e nella descrizione. Restituisce titolo, indirizzo e descrizione delle pagine trovate.", inputSchema: {"type":"object","properties":{"query":{"type":"string","description":"Parole da cercare, ad esempio: blefaroplastica, Aprilia, laser"},"max":{"type":"integer","minimum":1,"maximum":30,"description":"Numero massimo di risultati (predefinito 10)"}},"required":["query"],"additionalProperties":false}, annotations: { readOnlyHint: true },
      execute: function (a) { return cat().then(function (c) { var w = norm(a && a.query).split(/\s+/).filter(Boolean), out = []; c.sections.forEach(function (s) { s.pages.forEach(function (p) { var t = norm(p.title + " " + p.description + " " + s.name + " " + p.url); if (w.length && w.every(function (x) { return t.indexOf(x) >= 0; })) out.push("- [" + p.title + "](" + p.url + ") (" + s.name + ")" + (p.description ? ": " + p.description : "")); }); }); return testo(out.slice(0, (a && a.max) || 10).join("\n") || "Nessuna pagina trovata"); }); } },
    { name: "leggi_pagina", title: "Leggi una pagina", description: "Restituisce il contenuto di una pagina del sito in formato Markdown, dato il suo percorso (ad esempio /blefaroplastica-roma-aprilia/ o /contatti/).", inputSchema: {"type":"object","properties":{"path":{"type":"string","description":"Percorso della pagina sul sito, che inizia con /"}},"required":["path"],"additionalProperties":false}, annotations: { readOnlyHint: true },
      execute: function (a) { return fetch(percorso(a && a.path), { headers: { accept: "text/markdown" } }).then(function (r) { if (!r.ok) throw new Error("Pagina non trovata"); return r.text(); }).then(testo); } },
    { name: "elenco_sezioni", title: "Sezioni del sito", description: "Elenca le sezioni del sito (aree di trattamento, sedi, blog, pagine informative) con le relative pagine.", inputSchema: {"type":"object","properties":{},"additionalProperties":false}, annotations: { readOnlyHint: true },
      execute: function () { return cat().then(function (c) { return testo(c.sections.map(function (s) { return "## " + s.name + "\n" + s.pages.map(function (p) { return "- [" + p.title + "](" + p.url + ")"; }).join("\n"); }).join("\n\n")); }); } },
    { name: "apri_pagina", title: "Apri una pagina del sito", description: "Porta l’utente su una pagina di questo sito, ad esempio /contatti/ per prenotare una visita o una scheda di trattamento. Non invia moduli e non inserisce dati.", inputSchema: { type: "object", properties: { path: { type: "string", description: "Percorso della pagina sul sito, che inizia con /" } }, required: ["path"], additionalProperties: false },
      execute: function (a) { var p = percorso(a && a.path); location.assign(p); return testo("Apertura di " + location.origin + p); } }
  ];
  try {
    if (typeof mc.provideContext === "function") mc.provideContext({ tools: tools });
    else if (typeof mc.registerTool === "function") tools.forEach(function (t) { mc.registerTool(t); });
  } catch (e) { if (window.console) console.warn("WebMCP non disponibile:", e); }
})();
