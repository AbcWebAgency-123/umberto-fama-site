/* Sito del Dott. Umberto Fama — JS vanilla, senza librerie.
   Tutto funziona anche senza script: qui solo menu, percorso guidato, mappa delle sedi, filtri del blog,
   video al clic, accordion, ingressi allo scorrimento e precompilazione del modulo. */
(function(){
  "use strict";
  var $=function(s,r){return (r||document).querySelector(s)};
  var $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
  var reduced=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- Testata: ombra allo scorrimento ---------- */
  var head=$("#head");
  function onScroll(){ if(head) head.classList.toggle("stuck",window.scrollY>10); }
  window.addEventListener("scroll",onScroll,{passive:true}); onScroll();

  /* ---------- Menu: pannello su telefono e sottomenu da tastiera ---------- */
  var burger=$("#burger"), menu=$("#menu");
  if(burger&&menu){
    burger.addEventListener("click",function(){
      var open=menu.classList.toggle("open");
      burger.setAttribute("aria-expanded",open?"true":"false");
      burger.setAttribute("aria-label",open?"Chiudi il menu":"Apri il menu");
      document.body.style.overflow=open&&window.innerWidth<=1200?"hidden":"";
    });
    document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&menu.classList.contains("open")){ burger.click(); burger.focus(); } });
  }
  /* I sottomenu si aprono SOLO con il pulsante .sub-btn (non al passaggio del focus sul link padre),
     si chiudono con Esc, con un clic fuori e quando il focus esce dal <li>.
     Su desktop il CSS li mostra anche al passaggio del mouse: aria-expanded segue lo stato visibile. */
  var desk=window.matchMedia?window.matchMedia("(min-width:75.0625em)"):{matches:window.innerWidth>1200};
  $$(".has-sub").forEach(function(li){
    var btn=$(".sub-btn",li), sub=$(".sub",li);
    function sync(){ var vis=sub?getComputedStyle(sub).display!=="none":li.classList.contains("open"); btn.setAttribute("aria-expanded",vis?"true":"false"); }
    function set(open){ li.classList.toggle("open",open); sync(); }
    li._set=set;
    btn.addEventListener("click",function(){ var open=!li.classList.contains("open"); $$(".has-sub.open").forEach(function(x){ if(x!==li) x._set(false); }); set(open); });
    li.addEventListener("keydown",function(e){ if(e.key==="Escape"&&li.classList.contains("open")){ e.stopPropagation(); set(false); btn.focus(); } });
    li.addEventListener("focusout",function(){ setTimeout(function(){ if(!li.contains(document.activeElement)) set(false); },0); });
    function later(){ sync(); if(window.requestAnimationFrame) requestAnimationFrame(sync); }
    li.addEventListener("mouseenter",function(){ if(desk.matches) later(); });
    li.addEventListener("mouseleave",later);

  });
  document.addEventListener("click",function(e){ if(!e.target.closest(".has-sub")) $$(".has-sub.open").forEach(function(x){ x._set(false); }); });


  /* ---------- Percorso guidato (home): schede per area ---------- */
  var tabs=$$(".areas .area");
  if(tabs.length){
    function pick(i,anim){
      tabs.forEach(function(t,k){ var on=k===i; t.setAttribute("aria-selected",on?"true":"false"); t.tabIndex=on?0:-1; var p=document.getElementById(t.getAttribute("aria-controls")); if(p){ p.hidden=!on; p.classList.remove("sw"); if(on&&anim&&!reduced){ void p.offsetWidth; p.classList.add("sw"); } } });
    }
    tabs.forEach(function(t,i){
      t.addEventListener("click",function(){ pick(i,true) });
      t.addEventListener("keydown",function(e){ var k=i; if(e.key==="ArrowRight") k=(i+1)%tabs.length; else if(e.key==="ArrowLeft") k=(i-1+tabs.length)%tabs.length; else if(e.key==="Home") k=0; else if(e.key==="End") k=tabs.length-1; else return; e.preventDefault(); pick(k,true); tabs[k].focus(); });
    });
  }

  /* ---------- Sedi: mappa ed elenco si accendono insieme ---------- */
  var pts=$$(".map .m-pt"), sedi=$$(".sedi .sede");
  if(pts.length&&sedi.length){
    function sede(slug){ pts.forEach(function(p){ p.classList.toggle("on",p.getAttribute("data-s")===slug) }); sedi.forEach(function(r){ r.classList.toggle("on",r.id==="sede-"+slug) }); }
    sedi.forEach(function(r){ var slug=r.id.replace("sede-",""); r.addEventListener("mouseenter",function(){ sede(slug) }); r.addEventListener("focusin",function(){ sede(slug) }); });
    pts.forEach(function(p){ var slug=p.getAttribute("data-s"); p.addEventListener("mouseenter",function(){ sede(slug) }); p.addEventListener("focus",function(){ sede(slug) }); });
    sede(pts[0].getAttribute("data-s"));
  }

  /* ---------- Blog: filtro per argomento ---------- */
  var chips=$$("#filtri .chip"), elenco=$("#elenco"), esito=$("#filtri-esito");
  if(chips.length&&elenco){
    var NOMI={};
    chips.forEach(function(c){ NOMI[c.getAttribute("data-cat")]=c.firstChild.textContent.trim(); });
    function filtra(cat,push){
      chips.forEach(function(c){ c.setAttribute("aria-pressed",c.getAttribute("data-cat")===cat?"true":"false") });
      var n=0; $$(".art-w",elenco).forEach(function(w){ var on=!cat||w.getAttribute("data-cat")===cat; w.hidden=!on; if(on) n++; });
      if(esito) esito.textContent=cat?(n+" articol"+(n===1?"o":"i")+" su "+NOMI[cat].toLowerCase()):"";
      if(push){ try{ history.replaceState(null,"",cat?"#"+cat:location.pathname) }catch(e){} }
    }
    chips.forEach(function(c){ c.addEventListener("click",function(){ filtra(c.getAttribute("data-cat"),true) }) });
    var h=location.hash.slice(1); if(h&&NOMI[h]!==undefined) filtra(h,false);
    window.addEventListener("hashchange",function(){ var h=location.hash.slice(1); filtra(NOMI[h]!==undefined?h:"",false) });
  }

  /* ---------- Video: l'iframe di YouTube si carica solo al clic ---------- */
  var vids=$$(".video[data-yt]");
  /* più video nella stessa pagina: se le etichette coincidono, si numerano («video 2 di 3») per distinguerle */
  if(vids.length>1){
    var labs=vids.map(function(v){ var b=$(".video-play",v); return b?b.getAttribute("aria-label"):"" });
    var doppie=labs.some(function(l,i){ return labs.indexOf(l)!==i });
    if(doppie) vids.forEach(function(v,i){
      var b=$(".video-play",v), sr=$(".video-ext .sr-only",v), n=(i+1)+" di "+vids.length, t=v.getAttribute("data-titolo")||"";
      if(b) b.setAttribute("aria-label",b.getAttribute("aria-label").replace(/^Riproduci il video( \d+)?/,"Riproduci il video "+n));
      if(sr) sr.textContent=": "+t+" (video "+n+") (si apre in una nuova scheda)";
    });
  }
  vids.forEach(function(v){
    var b=$(".video-play",v); if(!b) return;

    b.addEventListener("click",function(){
      var f=document.createElement("iframe");
      f.src="https://www.youtube-nocookie.com/embed/"+v.getAttribute("data-yt")+"?autoplay=1&rel=0";
      f.title=b.getAttribute("aria-label")||"Video"; f.allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"; f.allowFullscreen=true; f.setAttribute("loading","lazy");
      b.replaceWith(f); f.focus();
    });
  });

  /* ---------- Accordion (curriculum): apri / chiudi tutto ---------- */
  $$("[data-acc]").forEach(function(b){ b.addEventListener("click",function(){ var open=b.getAttribute("data-acc")==="open"; $$("details.acc").forEach(function(d){ d.open=open }); }); });
  /* apertura della sezione indicata nell'URL (#cv-3) */
  if(location.hash){ var d=document.getElementById(location.hash.slice(1)); if(d&&d.tagName==="DETAILS") d.open=true; }

  /* ---------- Modulo: convalida leggera, precompilazione da ?trattamento= / ?sede= ---------- */
  var q={}; try{ location.search.slice(1).split("&").forEach(function(p){ if(!p) return; var kv=p.split("="); q[decodeURIComponent(kv[0])]=decodeURIComponent((kv[1]||"").replace(/\+/g," ")); }); }catch(e){}
  /* aggiunge o toglie un id da aria-describedby senza perdere gli altri (es. l'aiuto del telefono) */
  function desc(el,id,on){
    var ids=(el.getAttribute("aria-describedby")||"").split(/\s+/).filter(function(x){ return x&&x!==id });
    if(on) ids.unshift(id);
    if(ids.length) el.setAttribute("aria-describedby",ids.join(" ")); else el.removeAttribute("aria-describedby");
  }
  $$("form.form").forEach(function(form){
    var tr=$("select[name=trattamento]",form), se=$("select[name=sede]",form);
    if(tr&&q.trattamento){
      var scelto=null;
      $$("option",tr).forEach(function(o){ if(o.value&&(o.value===q.trattamento||o.textContent===q.trattamento)){ tr.value=o.value; scelto=o.textContent; } });
      /* riga di conferma sopra i campi: «Richiesta per: <b>…</b> — può cambiarlo qui sotto» */
      var fh=$(".form-h",form);
      if(scelto&&fh){ var conf=document.createElement("p"); conf.appendChild(document.createTextNode("Richiesta per: ")); var bb=document.createElement("b"); bb.textContent=scelto; conf.appendChild(bb); conf.appendChild(document.createTextNode(" — può cambiarlo qui sotto")); fh.appendChild(conf); }
    }
    if(se&&q.sede){ $$("option",se).forEach(function(o){ if(o.value===q.sede) se.value=o.value; }); }

    var sum=$("p.err[role=alert]",form);
    /* regole: campo → messaggio se non valido, altrimenti "" */
    var regole=[
      ["nome",function(el){ return el.value.trim().length<2?"Inserisca il nome.":"" }],
      ["cognome",function(el){ return el.value.trim().length<2?"Inserisca il cognome.":"" }],
      ["telefono",function(el){ return el.value.replace(/\D/g,"").length<6?"Inserisca un numero valido: almeno 6 cifre.":"" }],
      ["email",function(el){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim())?"":"Inserisca un’e-mail valida (es. nome@esempio.it)." }],
      ["consenso",function(el){ return el.checked?"":"Per inviare la richiesta serve il consenso al trattamento dei dati." }]
    ].map(function(r){ var el=$("[name="+r[0]+"]",form); return el?{el:el,test:r[1],box:document.getElementById(el.id+"-err")}:null }).filter(Boolean);

    function mostra(r,msg){
      if(msg){ r.el.setAttribute("aria-invalid","true"); }
      else r.el.removeAttribute("aria-invalid");
      if(r.box){ r.box.textContent=msg; r.box.hidden=!msg; desc(r.el,r.box.id,!!msg); }
    }
    function riepilogo(){
      var n=regole.filter(function(r){ return r.el.getAttribute("aria-invalid")==="true" }).length;
      if(!n){ sum.hidden=true; sum.textContent=""; }
      return n;
    }
    /* il campo corretto perde subito aria-invalid (durante la digitazione e all'uscita); gli errori nuovi compaiono solo all'invio */
    regole.forEach(function(r){
      function ricontrolla(){ if(r.el.getAttribute("aria-invalid")==="true"&&!r.test(r.el)){ mostra(r,""); riepilogo(); } }
      r.el.addEventListener("input",ricontrolla); r.el.addEventListener("change",ricontrolla); r.el.addEventListener("blur",ricontrolla);
    });

    function conferma(html){
      /* il riquadro entra nel modulo, poi si riempie (role=status già presente) e riceve il focus */
      var box=document.createElement("div"); box.className="ok"; box.setAttribute("role","status"); box.tabIndex=-1;
      form.replaceChildren(box);
      box.innerHTML=html;
      box.focus();
    }

    form.addEventListener("submit",function(e){
      var errati=[];
      regole.forEach(function(r){ var msg=r.test(r.el); mostra(r,msg); if(msg) errati.push(r); });
      if(errati.length){
        e.preventDefault();
        /* testo senza conteggio: resta vero mentre i campi vengono corretti; sparisce quando sono tutti a posto */
        sum.textContent=errati.length===1?"C’è un campo da correggere: "+errati[0].box.textContent:"Alcuni campi sono da correggere: trova l’indicazione sotto ciascun campo.";

        sum.hidden=false;
        errati[0].el.focus();
        return;
      }
      sum.hidden=true; sum.textContent="";
      var action=form.getAttribute("action")||"#", grazie=form.getAttribute("data-grazie");
      if(action==="#"){
        /* endpoint non ancora configurato (site.yaml: modulo.endpoint): mostra la conferma senza inviare */
        e.preventDefault();
        conferma("<b>Grazie per averci contattato.</b><span>Le risponderemo al più presto. (Modulo in configurazione: nessun invio effettuato.)</span>");
        return;
      }
      /* endpoint reale: invio in background e poi pagina di ringraziamento (data-grazie).
         Senza fetch/FormData il modulo parte nel modo classico verso l'endpoint. */
      if(!window.fetch||!window.FormData) return;
      e.preventDefault();
      var btn=$("button[type=submit]",form); if(btn) btn.disabled=true;
      fetch(action,{method:(form.getAttribute("method")||"POST").toUpperCase(),body:new FormData(form),headers:{"Accept":"application/json"}})
        .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); if(grazie) location.href=grazie; else conferma("<b>Grazie per averci contattato.</b><span>Le risponderemo al più presto.</span>"); })
        .catch(function(){
          if(btn) btn.disabled=false;
          sum.textContent="Invio non riuscito. Riprovi tra poco oppure chiami la segreteria.";
          sum.hidden=false;
        });
    });
  });

  /* ---------- Ingressi allo scorrimento e numeri che contano ---------- */
  function count(el,dur){
    if(reduced||!window.requestAnimationFrame) return;
    var els=$$("[data-count]",el); if(el.matches&&el.matches("[data-count]")) els.push(el);
    els.forEach(function(n){
      var end=+n.getAttribute("data-count"), fin=String(end), t0=0, d=dur||1100;
      function step(t){ if(!t0) t0=t; var p=Math.min(1,(t-t0)/d), e=1-Math.pow(1-p,3); n.textContent=String(Math.round(end*e)); if(p<1) requestAnimationFrame(step); else n.textContent=fin; }
      n.textContent="0"; requestAnimationFrame(step);
    });
  }
  var rv=$$(".rv");
  if(rv.length&&!reduced&&"IntersectionObserver" in window){
    var scrolled=false;
    function show(el){ if(!el.classList.contains("arm")) return; clearTimeout(el._t); el.classList.remove("arm"); el.classList.add("in"); count(el); }
    window.addEventListener("scroll",function(){ if(window.scrollY>4) scrolled=true },{passive:true});
    var ioIn=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting) show(e.target) }) },{rootMargin:"0px 0px -7% 0px"});
    var ioArm=new IntersectionObserver(function(es){ es.forEach(function(e){
      var el=e.target; if(!e.isIntersecting||!scrolled||el._done) return;
      if(e.boundingClientRect.top<window.innerHeight) return;
      el._done=true; el.classList.add("arm"); el._t=setTimeout(function(){ show(el) },2600);
    }) },{rootMargin:"0px 0px 180px 0px"});
    rv.forEach(function(el){ ioArm.observe(el); ioIn.observe(el) });
  }
  var facts=$(".facts"); if(facts) count(facts,650);
})();

/* ---------- Recensioni MioDottore: numeri aggiornati da /data/miodottore.json ----------
   Il file lo scrive ogni giorno tools/aggiorna-miodottore.php (workflow aggiorna-recensioni.yml), che
   aggiorna anche i valori scritti nell'HTML: lo script copre solo le pagine rimaste in cache. */
(function(){
  var els=document.querySelectorAll("[data-md]");
  if(!els.length||!window.fetch) return;
  fetch("/data/miodottore.json",{cache:"no-cache",credentials:"omit"}).then(function(r){return r.ok?r.json():null}).then(function(d){
    if(!d) return;
    var n=parseInt(d.reviewCount,10), t=d.updatedAt?new Date(d.updatedAt):null;
    if(!(n>=1)) return;
    var val={
      recensioni:String(n),
      data:(t&&!isNaN(t))?t.toLocaleDateString("it-IT",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Rome"}):null
    };
    function metti(){
      for(var i=0;i<els.length;i++){
        var k=els[i].getAttribute("data-md"); if(val[k]==null) continue;
        if(els[i].hasAttribute("data-count")) els[i].setAttribute("data-count",val[k]);
        els[i].textContent=val[k];
      }
    }
    metti(); setTimeout(metti,1400); /* dopo un eventuale conteggio animato già partito */
  }).catch(function(){});
})();

/* ---------- Riquadri MioDottore (agenda e recensioni) ----------
   Lo script ufficiale di MioDottore si carica con il consenso ai «Contenuti esterni» (script data-cc nel riquadro)
   oppure quando il visitatore preme il pulsante del segnaposto. Un solo script disegna tutti i widget della pagina,
   quindi i segnaposto spariscono tutti insieme. */
(function(){
  if(!document.querySelector(".zl-ph")) return;
  function via(){ [].forEach.call(document.querySelectorAll(".zl-ph"),function(p){ p.parentNode.removeChild(p); }); }
  function carica(){
    via();
    if(document.getElementById("zl-widget-s")) return;
    var js=document.createElement("script"),f=document.getElementsByTagName("script")[0];
    js.id="zl-widget-s"; js.src="//platform.docplanner.com/js/widget.js"; f.parentNode.insertBefore(js,f);
  }
  [].forEach.call(document.querySelectorAll(".zl-ph button"),function(b){ b.addEventListener("click",carica); });
  document.addEventListener("fama:consenso",function(e){ if(e.detail&&e.detail.esterni) via(); });
  if(/(?:^|; )fama_consenso=v2\.1\./.test(document.cookie)) via();
})();
