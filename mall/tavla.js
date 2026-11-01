/*
  Kurstavlor: gemensam logik för alla tavlor
  Används av varje tavla (index.html i tavlans mapp) och av byggaren.
*/
(function () {
  "use strict";

  var PROFILER = window.KURSTAVLA_PROFILER || {};
  var INST = window.KURSTAVLA_INSTALLNINGAR || {};

  /* ---------- Små hjälpfunktioner ---------- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
        else e.setAttribute(k, v === true ? "" : v);
      });
    }
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // Gör om vanlig text till HTML: stycken, radbrytningar och klickbara adresser.
  function textTillHtml(s) {
    if (!s) return "";
    var stycken = String(s).replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
    return stycken.map(function (st) {
      var h = esc(st).replace(
        /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]|www\.[^\s<]+[^\s<.,;:!?)\]'"])/g,
        function (m) {
          var href = m.indexOf("http") === 0 ? m : "https://" + m;
          return '<a href="' + href + '" target="_blank" rel="noopener" data-utskrift="' + href + '">' + m + "</a>";
        }
      );
      return "<p>" + h.replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function formatStorlek(b) {
    if (!b && b !== 0) return "";
    if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + " kB";
    return (b / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
  }

  function doman(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }

  function filandelse(s) {
    var m = String(s || "").split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i);
    return m ? m[1].toLowerCase() : "";
  }

  function idag() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------- Ikoner ---------- */

  var IKON = {
    dokument: '<path d="M6 2.5h8l4 4V21.5H6z"/><path d="M14 2.5v4h4"/><path d="M9 12h6M9 15.5h6"/>',
    lank: '<path d="M10 13.5a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10.5a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    play: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>',
    mapp: '<path d="M2.5 6.5a1 1 0 0 1 1-1h5.5l2 2.5h9.5a1 1 0 0 1 1 1V18.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1z"/>',
    bild: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16.5l-5-5-9.5 8.5"/>',
    ljud: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    dela: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
    skrivut: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M6 14h12v7H6z"/>',
    pil: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };

  function ikon(namn) {
    return '<svg class="ikon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (IKON[namn] || IKON.dokument) + "</svg>";
  }

  /* ---------- Typ av resurs ---------- */

  function youtubeId(url) {
    if (!url) return "";
    var m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  }

  var FILTYPER = {
    pdf: { typ: "pdf", etikett: "PDF", ikon: "dokument", knapp: "Öppna PDF" },
    doc: { typ: "word", etikett: "Word", ikon: "dokument", knapp: "Ladda ner dokumentet" },
    docx: { typ: "word", etikett: "Word", ikon: "dokument", knapp: "Ladda ner dokumentet" },
    odt: { typ: "word", etikett: "Dokument", ikon: "dokument", knapp: "Ladda ner dokumentet" },
    rtf: { typ: "word", etikett: "Dokument", ikon: "dokument", knapp: "Ladda ner dokumentet" },
    ppt: { typ: "powerpoint", etikett: "PowerPoint", ikon: "dokument", knapp: "Ladda ner presentationen" },
    pptx: { typ: "powerpoint", etikett: "PowerPoint", ikon: "dokument", knapp: "Ladda ner presentationen" },
    key: { typ: "powerpoint", etikett: "Keynote", ikon: "dokument", knapp: "Ladda ner presentationen" },
    xls: { typ: "excel", etikett: "Excel", ikon: "dokument", knapp: "Ladda ner filen" },
    xlsx: { typ: "excel", etikett: "Excel", ikon: "dokument", knapp: "Ladda ner filen" },
    csv: { typ: "excel", etikett: "CSV", ikon: "dokument", knapp: "Ladda ner filen" },
    jpg: { typ: "bild", etikett: "Bild", ikon: "bild", knapp: "Öppna bilden" },
    jpeg: { typ: "bild", etikett: "Bild", ikon: "bild", knapp: "Öppna bilden" },
    png: { typ: "bild", etikett: "Bild", ikon: "bild", knapp: "Öppna bilden" },
    gif: { typ: "bild", etikett: "Bild", ikon: "bild", knapp: "Öppna bilden" },
    webp: { typ: "bild", etikett: "Bild", ikon: "bild", knapp: "Öppna bilden" },
    mp4: { typ: "video", etikett: "Video", ikon: "play", knapp: "Se filmen" },
    mov: { typ: "video", etikett: "Video", ikon: "play", knapp: "Se filmen" },
    m4v: { typ: "video", etikett: "Video", ikon: "play", knapp: "Se filmen" },
    mp3: { typ: "ljud", etikett: "Ljud", ikon: "ljud", knapp: "Lyssna" },
    m4a: { typ: "ljud", etikett: "Ljud", ikon: "ljud", knapp: "Lyssna" },
    wav: { typ: "ljud", etikett: "Ljud", ikon: "ljud", knapp: "Lyssna" },
    zip: { typ: "zip", etikett: "Zip-arkiv", ikon: "mapp", knapp: "Ladda ner" }
  };

  // Returnerar { typ, etikett, ikon, knapp } för en post, eller null om posten saknar länk/fil.
  function typFor(post) {
    if (post.fil) {
      var f = FILTYPER[filandelse(post.filnamn || post.fil)];
      var t = f ? Object.assign({}, f) : { typ: "fil", etikett: "Fil", ikon: "dokument", knapp: "Ladda ner filen" };
      if (post.filstorlek) t.etikett += " · " + formatStorlek(post.filstorlek);
      return t;
    }
    if (post.lank) {
      var u = post.lank, d = doman(u);
      if (youtubeId(u)) return { typ: "youtube", etikett: "YouTube", ikon: "play", knapp: "Se filmen på YouTube" };
      if (/vimeo\.com/.test(d)) return { typ: "video", etikett: "Vimeo", ikon: "play", knapp: "Se filmen" };
      if (/dropbox\.com$/.test(d)) {
        if (/\/(scl\/fo|sh)\//.test(u)) return { typ: "mapp", etikett: "Dropbox-mapp", ikon: "mapp", knapp: "Öppna mappen" };
        var fd = FILTYPER[filandelse(u)];
        return { typ: fd ? fd.typ : "dropbox", etikett: (fd ? fd.etikett + " i " : "") + "Dropbox", ikon: fd ? fd.ikon : "dokument", knapp: "Öppna i Dropbox" };
      }
      if (/(drive|docs)\.google\.com$/.test(d)) return { typ: "drive", etikett: "Google Drive", ikon: "dokument", knapp: "Öppna dokumentet" };
      var fl = FILTYPER[filandelse(u)];
      if (fl) return Object.assign({}, fl, { etikett: fl.etikett + " · " + d });
      return { typ: "webb", etikett: d || "Webbsida", ikon: "lank", knapp: "Öppna webbsidan" };
    }
    return null;
  }

  /* ---------- QR-kod ---------- */

  function qrSvg(text) {
    var m = window.KurstavlaQR(text), n = m.length, marg = 4, s = n + marg * 2, p = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (m[r][c]) p += "M" + (c + marg) + " " + (r + marg) + "h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + " " + s + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + p + '" fill="#000"/></svg>';
  }

  function qrPngBlob(text, cb) {
    var m = window.KurstavlaQR(text), n = m.length, marg = 4, skala = 16, s = (n + marg * 2) * skala;
    var cv = document.createElement("canvas"); cv.width = cv.height = s;
    var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, s, s); g.fillStyle = "#000";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (m[r][c]) g.fillRect((c + marg) * skala, (r + marg) * skala, skala, skala);
    cv.toBlob(cb, "image/png");
  }

  function laddaNer(blob, namn) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = namn;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function kopiera(text, knapp) {
    function klart() { var t = knapp.textContent; knapp.textContent = "Kopierad"; setTimeout(function () { knapp.textContent = t; }, 1500); }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(klart, function () { reserv(); });
    } else reserv();
    function reserv() {
      var ta = el("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); klart(); } catch (e) { /* ignorera */ }
      ta.remove();
    }
  }

  // Visar dialogen med länk och QR-kod.
  function visaDela(url, filprefix) {
    var gammal = document.getElementById("kt-dela"); if (gammal) gammal.remove();
    var d = el("dialog", { id: "kt-dela", class: "kt-dialog", "aria-labelledby": "kt-dela-rubrik" });
    d.innerHTML =
      '<h2 id="kt-dela-rubrik">Dela tavlan</h2>' +
      '<label class="kt-etikett" for="kt-dela-url">Länk</label>' +
      '<div class="kt-rad"><input id="kt-dela-url" type="text" readonly value="' + esc(url) + '"><button type="button" class="kt-knapp" data-g="kopiera">Kopiera länk</button></div>' +
      '<div class="kt-qr">' + qrSvg(url) + "</div>" +
      '<div class="kt-rad kt-rad-knappar"><button type="button" class="kt-knapp sekundar" data-g="svg">Ladda ner QR (SVG)</button><button type="button" class="kt-knapp sekundar" data-g="png">Ladda ner QR (PNG)</button></div>' +
      '<div class="kt-rad kt-rad-slut"><button type="button" class="kt-knapp" data-g="stang">Stäng</button></div>';
    document.body.appendChild(d);
    var namn = (filprefix || "kurstavla") + "-qr";
    d.addEventListener("click", function (e) {
      var g = e.target.getAttribute && e.target.getAttribute("data-g");
      if (e.target === d || g === "stang") d.close();
      else if (g === "kopiera") kopiera(url, e.target);
      else if (g === "svg") laddaNer(new Blob([qrSvg(url)], { type: "image/svg+xml" }), namn + ".svg");
      else if (g === "png") qrPngBlob(url, function (b) { laddaNer(b, namn + ".png"); });
    });
    d.addEventListener("close", function () { d.remove(); });
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  }

  /* ---------- Fäll ut långa texter ---------- */

  function matFallUt(rot) {
    rot.querySelectorAll(".posttext").forEach(function (t) {
      var knapp = t.nextElementSibling;
      if (!knapp || !knapp.classList.contains("fall-ut")) return;
      if (t.classList.contains("utfalld")) { knapp.hidden = false; return; }
      if (t.offsetParent === null) return; // dold just nu, mät när den visas
      knapp.hidden = !(t.scrollHeight > t.clientHeight + 4);
      t.classList.toggle("har-mer", !knapp.hidden);
    });
  }

  /* ---------- Rendering ---------- */

  // data: innehållet i tavla.json
  // opts.bas: prefix för relativa sökvägar (t.ex. "/kursnamn-2026-11/" i byggaren)
  // opts.urlKarta: { "sökväg": "blob:..." } för nya filer i förhandsvisningen
  // opts.forhandsvisning: true i byggaren
  // opts.tavlansAdress: tavlans publika adress (för Dela och utskrift)
  function rendera(behallare, data, opts) {
    opts = opts || {};
    var profilNyckel = PROFILER[data.profil] ? data.profil : "sb";
    var profil = PROFILER[profilNyckel];
    var adressFor = function (p) {
      if (!p) return "";
      if (opts.urlKarta && opts.urlKarta[p]) return opts.urlKarta[p];
      if (/^(https?:|data:|blob:|\/)/.test(p)) return p;
      return (opts.bas || "") + p;
    };
    var absolut = function (href) {
      if (/^blob:/.test(href)) return "";
      try { return new URL(href, document.baseURI).href; } catch (e) { return href; }
    };
    var tavlansAdress = opts.tavlansAdress || location.href.split(/[?#]/)[0];

    behallare.innerHTML = "";
    behallare.className = "kt-tavla";
    behallare.setAttribute("data-profil", profilNyckel);
    document.documentElement.setAttribute("data-profil", profilNyckel);

    /* Sidhuvud */
    var huvud = el("header", { class: "kt-huvud" });
    var loggaHtml = "";
    if (profil.logga) {
      loggaHtml = '<div class="kt-logga"><img src="' + esc(profil.logga) + '" alt="' + esc(profil.namn) + '" ' +
        'onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="kt-logga-text" hidden>' + esc(profil.namn) + "</span></div>";
    }
    huvud.innerHTML =
      loggaHtml +
      '<div class="kt-titel"><h1>' + esc(data.rubrik || "") + "</h1>" +
      (data.underrubrik ? '<p class="kt-underrubrik">' + esc(data.underrubrik) + "</p>" : "") + "</div>" +
      '<div class="kt-verktyg">' +
      '<button type="button" class="kt-knapp ljus" data-g="dela">' + ikon("dela") + "<span>Dela</span></button>" +
      '<button type="button" class="kt-knapp ljus" data-g="skrivut">' + ikon("skrivut") + "<span>Spara som PDF</span></button>" +
      "</div>" +
      '<p class="kt-utskrift-adress">Tavlans adress: ' + esc(tavlansAdress) + "</p>";
    behallare.appendChild(huvud);
    huvud.querySelector('[data-g="dela"]').addEventListener("click", function () {
      var slug = (tavlansAdress.match(/\/([^\/]+)\/?$/) || [])[1];
      visaDela(tavlansAdress, slug);
    });
    huvud.querySelector('[data-g="skrivut"]').addEventListener("click", function () { window.print(); });

    if (!opts.forhandsvisning && data.rubrik) document.title = data.rubrik + (profil.namn ? " | " + profil.namn : "");

    /* Arkiverad? */
    var arkiverad = data.slutdatum && idag() > data.slutdatum;
    if (arkiverad && opts.forhandsvisning) {
      behallare.appendChild(el("div", { class: "kt-banner" }, "Slutdatumet har passerat. Deltagarna ser tavlan som arkiverad."));
    }
    if (arkiverad && !opts.forhandsvisning) {
      var ark = el("main", { class: "kt-arkiv" });
      var k = profil.kontakt;
      ark.innerHTML = '<div class="post"><div class="post-kropp"><h2>Tavlan är arkiverad</h2>' +
        "<p>Materialet på den här tavlan var tillgängligt till och med " + esc(data.slutdatum) + ".</p>" +
        (k && k.epost ? '<p>Vill du ha tillgång till något av materialet? Kontakta ' + esc(k.namn) + ', <a href="mailto:' + esc(k.epost) + '">' + esc(k.epost) + "</a>.</p>" : "") +
        "</div></div>";
      behallare.appendChild(ark);
      return;
    }

    var kolumner = el("main", { class: "kt-kolumner" });
    behallare.appendChild(kolumner);

    function kolumn(rubrik, extraKlass, oppen, antal) {
      var sek = el("section", { class: "kolumn " + (extraKlass || "") + (oppen ? " oppen" : "") });
      var id = "k" + Math.random().toString(36).slice(2, 8);
      sek.innerHTML = '<h2 class="kolumn-rubrik"><button type="button" aria-expanded="' + (oppen ? "true" : "false") + '" aria-controls="' + id + '">' +
        "<span>" + esc(rubrik) + "</span>" + (antal ? '<span class="kolumn-antal">' + antal + "</span>" : "") + "</button></h2>" +
        '<div class="kolumn-innehall" id="' + id + '"></div>';
      var knapp = sek.querySelector("button");
      knapp.addEventListener("click", function () {
        var o = sek.classList.toggle("oppen");
        knapp.setAttribute("aria-expanded", o ? "true" : "false");
        if (o) matFallUt(sek);
      });
      kolumner.appendChild(sek);
      return sek.querySelector(".kolumn-innehall");
    }

    function textBlock(html, utanGrans) {
      if (utanGrans) return '<div class="posttext">' + html + "</div>";
      return '<div class="posttext begransad">' + html + '</div><button type="button" class="fall-ut" hidden>Visa mer</button>';
    }

    var fasta = data.fastaKolumner || {};

    /* Välkommen */
    if (fasta.valkommen !== false) {
      var vk = kolumn("Välkommen hit", "kolumn-fast", true);
      var portratt = INST.portratt ? '<img class="post-portratt" src="' + esc(INST.portratt) + '" alt="Patrick Gruczkun" onerror="this.remove()">' : "";
      vk.appendChild(el("article", { class: "post" }, portratt + '<div class="post-kropp">' + textBlock(textTillHtml(data.valkomstText || profil.valkomst), true) + "</div>"));
    }

    /* Kontakt */
    if (fasta.kontakt !== false && profil.kontakt) {
      var kk = kolumn("Kontakt", "kolumn-fast", false);
      var k2 = profil.kontakt, rader = [];
      if (k2.namn) rader.push("<strong>" + esc(k2.namn) + "</strong>");
      if (k2.organisation) rader.push(esc(k2.organisation));
      if (k2.epost) rader.push('<a href="mailto:' + esc(k2.epost) + '">' + esc(k2.epost) + "</a>");
      if (k2.telefon) rader.push('<a href="tel:' + esc(k2.telefon.replace(/[^\d+]/g, "")) + '">' + esc(k2.telefon) + "</a>");
      if (k2.webb) rader.push('<a href="' + esc(k2.webb) + '" target="_blank" rel="noopener" data-utskrift="' + esc(k2.webb) + '">' + esc(doman(k2.webb)) + "</a>");
      if (k2.linkedin) rader.push('<a href="' + esc(k2.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>');
      var kLogga = profil.logga ? '<img class="kontakt-logga" src="' + esc(profil.logga) + '" alt="" onerror="this.remove()">' : "";
      kk.appendChild(el("article", { class: "post post-kontakt" }, '<div class="post-kropp">' + kLogga + "<p>" + rader.join("<br>") + "</p></div>"));
    }

    /* Kategorier */
    (data.kategorier || []).forEach(function (kat, ki) {
      var inne = kolumn(kat.rubrik || "", "kolumn-farg" + (ki % 5), false, (kat.poster || []).length);
      if (kat.text) inne.appendChild(el("div", { class: "kolumn-intro" }, textTillHtml(kat.text)));

      (kat.poster || []).forEach(function (post) {
        var typ = typFor(post);
        var href = post.fil ? adressFor(post.fil) : (post.lank || "");
        var yt = !post.bild && youtubeId(post.lank);
        var bildSrc = post.bild ? adressFor(post.bild) : (yt ? "https://i.ytimg.com/vi/" + yt + "/hqdefault.jpg" : "");
        var lankAttr = href ? ' href="' + esc(href) + '" target="_blank" rel="noopener"' : "";
        var utskrift = href && absolut(href) ? ' data-utskrift="' + esc(absolut(href)) + '"' : "";

        var h = "";
        if (bildSrc) {
          var bildInre = '<img src="' + esc(bildSrc) + '" alt="" loading="lazy" onerror="this.parentNode.remove()">' + (yt ? '<span class="post-play">' + ikon("play") + "</span>" : "");
          h += href ? '<a class="post-bild' + (yt ? " yt" : "") + '" href="' + esc(href) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">' + bildInre + "</a>"
                    : '<div class="post-bild">' + bildInre + "</div>";
        }
        h += '<div class="post-kropp">';
        if (typ) h += '<div class="post-typ">' + ikon(typ.ikon) + "<span>" + esc(typ.etikett) + "</span></div>";
        if (post.rubrik) h += '<h3 class="post-rubrik">' + (href ? "<a" + lankAttr + ">" + esc(post.rubrik) + "</a>" : esc(post.rubrik)) + "</h3>";
        if (post.text) h += textBlock(textTillHtml(post.text));
        if (href && typ) h += '<a class="post-knapp"' + lankAttr + utskrift + ">" + esc(typ.knapp) + ikon("pil") + "</a>";
        h += "</div>";
        inne.appendChild(el("article", { class: "post" + (post.framhavd ? " framhavd" : "") }, h));
      });
    });

    /* Händelser för fäll ut (kopplas bara en gång per behållare) */
    if (!behallare._ktFallUt) behallare.addEventListener("click", behallare._ktFallUt = function (e) {
      var b = e.target.closest && e.target.closest(".fall-ut");
      if (!b) return;
      var t = b.previousElementSibling;
      var ut = t.classList.toggle("utfalld");
      t.classList.toggle("begransad", !ut);
      b.textContent = ut ? "Visa mindre" : "Visa mer";
    });
    // Vänta in bilder och typsnitt innan mätning.
    requestAnimationFrame(function () { matFallUt(behallare); });
    window.addEventListener("load", function () { matFallUt(behallare); });
    behallare.querySelectorAll("img").forEach(function (i) { i.addEventListener("load", function () { matFallUt(behallare); }); });
  }

  var storTimer;
  window.addEventListener("resize", function () {
    clearTimeout(storTimer);
    storTimer = setTimeout(function () { document.querySelectorAll(".kt-tavla").forEach(matFallUt); }, 200);
  });

  /* ---------- Start för en publicerad tavla ---------- */

  function starta() {
    var rot = document.getElementById("tavla");
    fetch("tavla.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { rendera(rot, data, {}); })
      .catch(function () {
        rot.innerHTML = '<p class="kt-fel">Tavlan kunde inte laddas. Kontrollera adressen eller försök igen senare.</p>';
      });
  }

  window.Kurstavla = {
    rendera: rendera,
    starta: starta,
    typFor: typFor,
    youtubeId: youtubeId,
    formatStorlek: formatStorlek,
    filandelse: filandelse,
    qrSvg: qrSvg,
    visaDela: visaDela,
    laddaNer: laddaNer,
    kopiera: kopiera,
    textTillHtml: textTillHtml,
    esc: esc
  };
})();
