/* Motore di ricerca interno del sito (header «Cerca» e «Da dove desidera partire?» in home).
   L'indice /static/js/cerca-indice.json è generato da tools/genera-indice-ricerca.py, che usa la stessa
   normalizzazione e la stessa radice delle parole: se si cambia qui, cambiare anche lì.
   Riconosce: plurali e varianti (radice comune), piccoli refusi (distanza di modifica), inizio di parola,
   sinonimi ed espressioni dei pazienti (dizionario tools/ricerca/dizionario.json). */
(function (G) {
  "use strict";
  var IDX = null, STOP = {}, VOC = [], VOCSET = {}, SCH = {}, DF = {}, N = 1, carica = null;
  var PESI = [10, 6, 3, 2, 1];                 // titolo, parole chiave, sottotitoli, descrizione, testo

  function norm(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function stem(w) {
    while (w.length > 2 && "aeiou".indexOf(w.charAt(w.length - 1)) > -1) w = w.slice(0, -1);
    if (w.length > 2 && w.charAt(w.length - 1) === "h" && "cg".indexOf(w.charAt(w.length - 2)) > -1) w = w.slice(0, -1);
    return w;
  }
  /* scheletro della parola: senza h e senza lettere doppie (machie/macchie, rughhe/rughe) */
  function sch(s) { return s.replace(/h/g, "").replace(/(.)\1+/g, "$1"); }
  function stems(s) {
    return norm(s).split(" ").filter(function (w) { return w.length > 1 && !STOP[w]; }).map(stem);
  }
  /* distanza di Damerau-Levenshtein (trasposizioni comprese), con uscita anticipata oltre max */
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      var minr = max + 1;
      for (j = 1; j <= b.length; j++) {
        var c = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        if (d[i][j] < minr) minr = d[i][j];
      }
      if (minr > max) return max + 1;
    }
    return d[a.length][b.length];
  }

  function usa(data) {
    IDX = data; STOP = {}; VOCSET = {}; DF = {}; N = data.docs.length;
    data.stop.forEach(function (w) { STOP[w] = 1; });
    data.docs.forEach(function (d) {
      d._f = d.f.map(function (s) { var o = {}; s.split(" ").forEach(function (x) { if (x) o[x] = 1; }); return o; });
      var tutte = {};
      d._f.forEach(function (o) { for (var x in o) tutte[x] = 1; });
      for (var x in tutte) { DF[x] = (DF[x] || 0) + 1; VOCSET[x] = 1; }
    });
    data.diz.forEach(function (v) {
      v._c = v.c.map(function (c) { return c.split(" "); });
      v._c.forEach(function (c) { c.forEach(function (x) { VOCSET[x] = 1; }); });
      v._x = v.x ? v.x.split(" ") : [];
    });
    VOC = Object.keys(VOCSET);
    SCH = {};
    VOC.forEach(function (v) { if (v.length >= 3) (SCH[sch(v)] = SCH[sch(v)] || []).push(v); });
  }

  /* per ogni parola cercata: le radici dell'indice a cui può corrispondere, con un fattore di fiducia */
  function risolvi(q) {
    var out = {};
    if (VOCSET[q]) out[q] = 1;
    if (q.length >= 3) (SCH[sch(q)] || []).forEach(function (v) { if (v !== q) out[v] = Math.max(out[v] || 0, 0.85); });
    if (q.length >= 4) {
      var max = q.length >= 7 ? 2 : 1;
      VOC.forEach(function (v) {
        if (v === q) return;
        if (v.length > q.length && v.indexOf(q) === 0) { out[v] = Math.max(out[v] || 0, 0.7); return; }
        if (v.charAt(0) !== q.charAt(0) && max === 1) return;
        var dd = dist(q, v, max);
        if (dd <= max) out[v] = Math.max(out[v] || 0, dd === 1 ? 0.75 : 0.55);
      });
    }
    return out;
  }

  function cerca(testo) {
    if (!IDX) return [];
    var parole = stems(testo);
    if (!parole.length) return [];
    var ris = parole.map(risolvi);
    // voci del dizionario riconosciute: tutte le parole della chiave presenti nella ricerca
    var attive = [], lmax = 0;
    IDX.diz.forEach(function (v, iv) {
      var best = 0, fid = 1;
      v._c.forEach(function (c) {
        var ok = 1, f = 1;
        c.forEach(function (x) {
          var m = 0;
          ris.forEach(function (r) { if (r[x] && r[x] > m) m = r[x]; });
          if (!m) ok = 0; else f = Math.min(f, m);
        });
        if (ok && (c.length > best || (c.length === best && f > fid))) { best = c.length; fid = f; }
      });
      if (best) { attive.push([v, best, fid]); if (best > lmax) lmax = best; }
    });
    // parole in più suggerite dalle voci riconosciute
    var extra = [];
    attive.forEach(function (a) { a[0]._x.forEach(function (x) { if (VOCSET[x]) extra.push(x); }); });
    var punti = [];
    IDX.docs.forEach(function (d) {
      var s = 0, prese = 0;
      ris.forEach(function (r) {
        var m = 0;
        for (var x in r) {
          var idf = Math.log(1 + N / (DF[x] || N));
          for (var k = 0; k < 5; k++) if (d._f[k][x]) { m = Math.max(m, PESI[k] * idf * r[x]); break; }
        }
        if (m) { prese++; s += m; }
      });
      extra.forEach(function (x) {
        var idf = Math.log(1 + N / (DF[x] || N));
        for (var k = 0; k < 5; k++) if (d._f[k][x]) { s += 0.5 * PESI[k] * idf; break; }
      });
      if (prese && ris.length > 1) s *= 0.5 + 0.5 * prese / ris.length;   // premia chi contiene tutte le parole
      attive.forEach(function (a) {
        var pos = a[0].p.indexOf(d.u);
        // l'ordine delle pagine nel dizionario conta: la prima è la più pertinente.
        // Se una voce più specifica (più parole) è stata riconosciuta, le voci generiche non contano.
        if (pos > -1 && (a[1] === lmax || lmax < 2)) { s += (120 - Math.min(pos, 6) * 12) * (a[1] === lmax ? 1 : 0.35) * a[2]; d._v = 1; }
      });
      if (s > 0) punti.push([s, d, d._v]); d._v = 0;
    });
    if (!punti.length) return [];
    punti.sort(function (a, b) { return b[0] - a[0] || IDX.tipi.indexOf(a[1].k) - IDX.tipi.indexOf(b[1].k); });
    var soglia = Math.max(6, punti[0][0] * (attive.length ? 0.16 : 0.12));
    // se la ricerca corrisponde a una voce del dizionario, le pagine non elencate lì devono essere molto pertinenti
    var soglia2 = attive.length ? Math.max(soglia, punti[0][0] * 0.3) : soglia;
    return punti.filter(function (p) { return p[0] >= (p[2] ? soglia : soglia2); }).map(function (p) { return { u: p[1].u, t: p[1].t, k: p[1].k, a: p[1].a, s: Math.round(p[0]) }; });
  }

  function pronto() {
    if (IDX) return Promise.resolve();
    if (!carica) carica = fetch("/static/js/cerca-indice.json").then(function (r) { return r.json(); }).then(usa);
    return carica;
  }

  G.CERCA = { usa: usa, cerca: cerca, pronto: pronto, stems: stems, norm: norm };
  if (typeof document === "undefined") return;

  function esc(s) { return String(s).replace(/[<>&"]/g, ""); }
  function voce(r) {
    return '<li><a href="' + r.u + '"><span class="srch-k">' + esc(r.k) + "</span><b>" + esc(r.t) + "</b>" + (r.a ? "<small>" + esc(r.a) + "</small>" : "") + "</a></li>";
  }
  function frecce(inp, res) {
    inp.addEventListener("keydown", function (e) { if (e.key === "ArrowDown") { var a = res.querySelector("a"); if (a) { e.preventDefault(); a.focus(); } } });
    res.addEventListener("keydown", function (e) {
      var L = [].slice.call(res.querySelectorAll("a")), i = L.indexOf(document.activeElement);
      if (e.key === "ArrowDown" && i < L.length - 1) { e.preventDefault(); L[i + 1].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); i > 0 ? L[i - 1].focus() : inp.focus(); }
    });
  }

  /* ---------- Ricerca dell'header ---------- */
  (function () {
    var btns = document.querySelectorAll(".srch-btn"), box = document.getElementById("srch");
    if (!box || !btns.length) return;
    var inp = box.querySelector("input"), res = box.querySelector(".srch-r"), sug = box.querySelector(".srch-s");
    function open() { box.hidden = false; document.documentElement.classList.add("srch-on"); btns.forEach(function (b) { b.setAttribute("aria-expanded", "true"); }); pronto().then(run); setTimeout(function () { inp.focus(); }, 30); }
    function close() { box.hidden = true; document.documentElement.classList.remove("srch-on"); btns.forEach(function (b) { b.setAttribute("aria-expanded", "false"); }); }
    btns.forEach(function (b) { b.addEventListener("click", function () { box.hidden ? open() : close(); }); });
    box.querySelector(".srch-x").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !box.hidden) { close(); btns[0].focus(); } });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    if (sug) sug.addEventListener("click", function (e) { var c = e.target.closest("button"); if (c) { inp.value = c.textContent; pronto().then(run); } });
    function run() {
      var v = inp.value.trim();
      if (!v) { res.innerHTML = ""; if (sug) sug.hidden = false; return; }
      if (sug) sug.hidden = true;
      var r = cerca(v);
      if (!r.length) { res.innerHTML = '<li class="srch-0">Nessun risultato per “' + esc(v) + '”. Provi con un’altra parola, oppure <a href="/contatti/">chieda alla segreteria</a>.</li>'; return; }
      var tutti = r.length > 10 ? '<li class="srch-all"><a href="/?cerca=' + encodeURIComponent(v) + '#cerca-home">Vedi tutti i ' + r.length + " risultati</a></li>" : "";
      res.innerHTML = r.slice(0, 10).map(voce).join("") + tutti;
    }
    inp.addEventListener("input", function () { pronto().then(run); });
    frecce(inp, res);
  })();

  /* ---------- «Da dove desidera partire?» in home ---------- */
  (function () {
    var r = document.getElementById("cerca-home");
    if (!r) return;
    var f = r.querySelector(".hc-f"), inp = f.querySelector("input"), box = r.querySelector(".hc-o"), hd = r.querySelector(".hc-n"), res = r.querySelector(".hc-r"), chips = r.querySelectorAll(".hc-e button");
    function run() {
      var v = inp.value.trim();
      chips.forEach(function (c) { c.classList.toggle("on", norm(c.textContent) === norm(v)); });
      if (!v) { box.hidden = true; res.innerHTML = ""; hd.innerHTML = ""; return 0; }
      var o = cerca(v), x = '<button type="button" class="hc-x">Azzera la ricerca</button>';
      box.hidden = false;
      if (!o.length) { hd.innerHTML = "<span>Nessun risultato per <b>«" + esc(v) + "»</b>. Provi con un’altra parola, oppure <a href=\"/contatti/\">chieda alla segreteria</a>.</span>" + x; res.innerHTML = ""; return 0; }
      hd.innerHTML = "<span>" + (o.length === 1 ? "Un risultato" : o.length + " risultati") + " per <b>«" + esc(v) + "»</b>, dal più pertinente</span>" + x;
      res.innerHTML = o.map(voce).join("");
      return o.length;
    }
    function vedi() { var b = box.getBoundingClientRect(); if (b.top > window.innerHeight - 120 || b.top < 0) box.scrollIntoView({ behavior: "smooth", block: "start" }); }
    inp.addEventListener("focus", function () { pronto(); }, { once: true });
    inp.addEventListener("input", function () { pronto().then(run); });
    f.addEventListener("submit", function (e) { e.preventDefault(); pronto().then(function () { if (run()) { var a = res.querySelector("a"); vedi(); if (a) a.focus({ preventScroll: true }); } }); });
    chips.forEach(function (c) { c.addEventListener("click", function () { inp.value = c.textContent; pronto().then(function () { run(); vedi(); }); }); });
    hd.addEventListener("click", function (e) { if (e.target.closest(".hc-x")) { inp.value = ""; run(); inp.focus(); } });
    frecce(inp, res);
    var q = new URLSearchParams(location.search).get("cerca");
    if (q) { inp.value = q; pronto().then(function () { run(); vedi(); }); }
  })();
})(typeof window !== "undefined" ? window : globalThis);
