/*
  Kurstavlor: tavelbyggaren
  Allt sker i webbläsaren. Resultatet är en zip med en färdig tavelmapp
  som laddas upp till GitHub-repot.
*/
(function () {
  "use strict";

  var INST = window.KURSTAVLA_INSTALLNINGAR;
  var PROFILER = window.KURSTAVLA_PROFILER;
  var KT = window.Kurstavla;
  var esc = KT.esc;

  var MAX_FIL = 25 * 1024 * 1024;   // GitHubs gräns vid uppladdning i webbläsaren
  var VARNA_FIL = 10 * 1024 * 1024; // stora filer drar Netlify-krediter vid nedladdning
  var BILD_MAX_BREDD = 1000;

  var TAVLA_INDEX =
    '<!doctype html>\n<html lang="sv">\n<head>\n  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '  <meta name="robots" content="noindex, nofollow">\n  <title>Kurstavla</title>\n' +
    '  <link rel="stylesheet" href="/mall/tavla.css">\n</head>\n<body>\n  <div id="tavla"></div>\n' +
    '  <script src="/mall/profiler.js"></script>\n  <script src="/mall/bibliotek/qrcode.min.js"></script>\n' +
    '  <script src="/mall/tavla.js"></script>\n  <script>Kurstavla.starta();</script>\n</body>\n</html>\n';

  var IKON_UPP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  var IKON_NER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
  var IKON_FIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h8l4 4V21.5H6z"/><path d="M14 2.5v4h4"/></svg>';

  // Namn på profilens färger, i samma ordning som f0 till f4 och mörk i tavla.css.
  var FARGNAMN = {
    sb: ["Korall", "Gul", "Rosa", "Grön", "Blå", "Svart"],
    gr: ["Mörkblå", "Blå", "Grönblå", "Lila", "Grå", "Mörk"],
    neutral: ["Lila", "Turkos", "Korall", "Gul", "Grå", "Mörk"]
  };

  var state = null;
  var smutsig = false;
  var aktivFlik = "redigera";

  /* ---------- Hjälpfunktioner ---------- */

  function $(s, r) { return (r || document).querySelector(s); }
  function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 8); }

  function manad() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function saniter(s) {
    return String(s || "").toLowerCase()
      .replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[éèê]/g, "e").replace(/ü/g, "u")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function slugFran(rubrik) {
    var b = saniter(rubrik).slice(0, 50).replace(/-+$/, "");
    return (b ? b + "-" : "") + manad();
  }

  function saniterFilnamn(namn) {
    var ext = KT.filandelse(namn);
    var bas = String(namn).replace(/\.[^.]+$/, "");
    var s = saniter(bas).slice(0, 50).replace(/-+$/, "") || "fil";
    return ext ? s + "." + ext : s;
  }

  function unik(sokvag, upptagna) {
    var s = sokvag, n = 2;
    while (upptagna[s]) { s = sokvag.replace(/(\.[^.\/]+)?$/, "-" + n + "$1"); n++; }
    upptagna[s] = true;
    return s;
  }

  function normaliseraLank(u) {
    u = String(u || "").trim();
    if (u && !/^[a-z]+:\/\//i.test(u) && !/^mailto:/i.test(u)) u = "https://" + u;
    return u;
  }

  function giltigLank(u) {
    try { var x = new URL(u); return /^(https?|mailto):$/.test(x.protocol) && (x.protocol === "mailto:" || x.hostname.indexOf(".") > 0); } catch (e) { return false; }
  }

  function basnamn(p) { return String(p || "").split("/").pop(); }

  /* ---------- Tillstånd ---------- */

  function nyPost() {
    return { uid: uid("p-"), id: null, rubrik: "", text: "", resurs: "ingen", lank: "", fil: null, filSaknas: false, tidigareFil: "", bild: null, framhavd: false, farg: "" };
  }
  function nyKategori() {
    return { uid: uid("k-"), id: null, rubrik: "", text: "", oppen: true, poster: [nyPost()] };
  }
  function nyttState() {
    return {
      lage: "ny", bas: "", filkarta: {}, befintligaFiler: {},
      profil: "sb", rubrik: "", underrubrik: "", slug: "", slugManuell: false, slutdatum: "",
      valkommen: true, kontakt: true, valkomstText: PROFILER.sb.valkomst,
      kategorier: [nyKategori()]
    };
  }

  /* ---------- Bilder ---------- */

  // Skalar ner bilden och sparar som JPEG, så att tavlan laddar snabbt.
  function forminskaBild(fil) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(fil), img = new Image();
      img.onload = function () {
        var s = Math.min(1, BILD_MAX_BREDD / img.naturalWidth);
        var cv = document.createElement("canvas");
        cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
        var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? resolve(b) : reject(new Error("bild")); }, "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("bild")); };
      img.src = url;
    });
  }

  /* ---------- Rita redigeringsvyn ---------- */

  function radio(namn, varde, aktuellt, etikett, extra) {
    return '<label class="b-radio"><input type="radio" name="' + namn + '" value="' + varde + '"' + (varde === aktuellt ? " checked" : "") + (extra || "") + "><span>" + etikett + "</span></label>";
  }

  function postHtml(p, ki, pi) {
    var etikett = "K" + (ki + 1) + "P" + (pi + 1);
    var flytta = '<select class="b-select" data-g="flytta" aria-label="Flytta posten till annan kategori"><option value="">Flytta till kategori</option>' +
      state.kategorier.map(function (k, i) { return i === ki ? "" : '<option value="' + i + '">' + esc((i + 1) + ". " + (k.rubrik || "Kategori utan rubrik")) + "</option>"; }).join("") + "</select>";

    var h = '<div class="b-post' + (p.framhavd ? " framhavd" : "") + '"' + (p.farg ? ' data-farg="' + p.farg + '"' : "") + ' data-k="' + ki + '" data-p="' + pi + '" id="post-' + p.uid + '">' +
      '<div class="b-post-huvud"><span class="b-etikett">' + etikett + "</span>" +
      '<label class="b-check"><input type="checkbox" data-f="framhavd"' + (p.framhavd ? " checked" : "") + "> Framhävd</label>" +
      '<span class="b-spacer"></span>' +
      '<button type="button" class="b-ikonknapp" data-g="post-upp" aria-label="Flytta posten uppåt"' + (pi === 0 ? " disabled" : "") + ">" + IKON_UPP + "</button>" +
      '<button type="button" class="b-ikonknapp" data-g="post-ner" aria-label="Flytta posten nedåt"' + (pi === state.kategorier[ki].poster.length - 1 ? " disabled" : "") + ">" + IKON_NER + "</button>" +
      (state.kategorier.length > 1 ? flytta : "") +
      '<button type="button" class="b-knapp liten fara" data-g="ta-bort-post">Ta bort</button></div>' +
      '<label class="b-lbl">Rubrik<input type="text" class="b-input" data-f="rubrik" value="' + esc(p.rubrik) + '"></label>' +
      '<label class="b-lbl">Text<textarea class="b-input" rows="3" data-f="text">' + esc(p.text) + "</textarea></label>";

    /* Länk eller fil */
    var namn = "resurs-" + p.uid;
    h += '<div class="b-grupp"><span class="b-lbl-text">Länk eller fil</span><div class="b-radiorad">' +
      radio(namn, "ingen", p.resurs, "Ingen") + radio(namn, "lank", p.resurs, "Länk") + radio(namn, "fil", p.resurs, "Fil") + "</div>";
    if (p.resurs === "lank") {
      h += '<input type="url" class="b-input" data-f="lank" placeholder="https://" value="' + esc(p.lank) + '" aria-label="Länk">' +
        '<div class="b-hint" data-hint>' + lankTips(p.lank) + "</div>";
    } else if (p.resurs === "fil") {
      if (p.fil) {
        var stor = p.fil.storlek > MAX_FIL ? '<span class="b-fel-text">För stor för GitHub (max 25 MB). Lägg den i Dropbox och använd länk i stället.</span>'
          : p.fil.storlek > VARNA_FIL ? '<span class="b-varning-text">Stor fil. Överväg att komprimera eller länka från Dropbox, varje nedladdning drar Netlify-krediter.</span>' : "";
        h += '<div class="b-filinfo">' + IKON_FIL + "<span><strong>" + esc(p.fil.namn) + "</strong> · " + KT.formatStorlek(p.fil.storlek) +
          (p.fil.befintlig ? " · finns redan på tavlan" : "") + "</span>" +
          '<button type="button" class="b-knapp liten" data-g="ta-bort-fil">Byt eller ta bort</button></div>' + stor;
      } else {
        if (p.filSaknas) h += '<p class="b-varning-text">Dokumentet ' + (p.tidigareFil ? "(" + esc(p.tidigareFil) + ") " : "") + "följde inte med från mallen. Välj en ny fil, byt till länk eller ta bort posten.</p>";
        h += '<input type="file" class="b-input-fil" data-f="fil" aria-label="Välj fil">';
      }
    }
    h += "</div>";

    /* Bakgrundsfärg */
    var fnamn = FARGNAMN[state.profil] || FARGNAMN.sb;
    h += '<div class="b-grupp"><span class="b-lbl-text">Bakgrundsfärg</span><div class="b-farger">' +
      '<label class="b-farg" title="Vit"><input type="radio" name="farg-' + p.uid + '" value=""' + (!p.farg ? " checked" : "") + '><span style="background:#fff" aria-label="Vit"></span></label>' +
      KT.FARGER.map(function (f, i) {
        var bg = f === "mork" ? "var(--mork)" : "var(--farg" + f.slice(1) + ")";
        return '<label class="b-farg" title="' + fnamn[i] + '"><input type="radio" name="farg-' + p.uid + '" value="' + f + '"' + (p.farg === f ? " checked" : "") + '><span style="background:' + bg + '" aria-label="' + fnamn[i] + '"></span></label>';
      }).join("") + "</div></div>";

    /* Bild */
    h += '<div class="b-grupp"><span class="b-lbl-text">Bild (valfri)</span>';
    if (p.bild) {
      h += '<div class="b-bildrad"><img class="b-bildmini" src="' + esc(bildUrl(p.bild)) + '" alt="">' +
        '<button type="button" class="b-knapp liten" data-g="ta-bort-bild">Ta bort bild</button></div>';
    } else {
      h += '<input type="file" class="b-input-fil" accept="image/jpeg,image/png,image/webp,image/gif" data-f="bild" aria-label="Välj bild">' +
        (p.resurs === "lank" && KT.youtubeId(p.lank) ? '<div class="b-hint">YouTube-länk: förhandsbilden hämtas automatiskt om du inte väljer en egen.</div>' : "");
    }
    h += "</div></div>";
    return h;
  }

  function lankTips(u) {
    u = String(u || "").trim();
    if (!u) return "";
    var n = normaliseraLank(u);
    if (!giltigLank(n)) return '<span class="b-fel-text">Adressen ser inte ut som en webbadress.</span>';
    var t = KT.typFor({ lank: n });
    return "Visas som: " + esc(t ? t.etikett : "länk") + (KT.youtubeId(n) ? " (förhandsbild från YouTube)" : "");
  }

  function bildUrl(b) {
    if (!b) return "";
    if (b.url) return b.url;
    if (b.befintlig) return state.filkarta[b.befintlig] || (state.bas + b.befintlig);
    return "";
  }

  function ritaRedigering(fokus) {
    var r = $("#b-redigera");
    document.documentElement.setAttribute("data-profil", state.profil);
    var p = PROFILER[state.profil];
    var adressPrefix = INST.webbadress.replace(/\/$/, "") + "/";
    var h = "";

    h += '<div class="b-felruta" id="b-felruta" hidden></div>';

    if (state.lage === "redigera") h += '<p class="b-info">Du redigerar en publicerad tavla. När du laddar ner får du tavla.json och eventuella nya filer. Ladda upp mappen som vanligt: befintliga filer ligger kvar.</p>';
    if (state.lage === "mall") h += '<p class="b-info">Ny tavla byggd från en tidigare. Kontrollera rubrik, adress och slutdatum, och välj nya dokument där det behövs.</p>';

    /* Grunduppgifter */
    h += '<section class="b-sektion"><h2>Grunduppgifter</h2>' +
      '<div class="b-grupp"><span class="b-lbl-text">Profil</span><div class="b-radiorad">' +
      radio("profil", "sb", state.profil, "Samarbetsbolaget") + radio("profil", "gr", state.profil, "Göteborgsregionen") + radio("profil", "neutral", state.profil, "Neutral") +
      "</div></div>" +
      '<label class="b-lbl">Rubrik <span class="b-krav">(obligatorisk)</span><input type="text" class="b-input" id="f-rubrik" data-t="rubrik" value="' + esc(state.rubrik) + '"></label>' +
      '<label class="b-lbl">Underrubrik<input type="text" class="b-input" data-t="underrubrik" value="' + esc(state.underrubrik) + '"></label>' +
      '<label class="b-lbl">Adress <span class="b-krav">(obligatorisk)</span>' +
      '<span class="b-adress"><span class="b-adress-prefix">' + esc(adressPrefix) + '</span><input type="text" class="b-input" id="f-slug" data-t="slug" value="' + esc(state.slug) + '"' + (state.lage === "redigera" ? " readonly" : "") + "></span></label>" +
      '<div class="b-hint">' + (state.lage === "redigera" ? "Adressen kan inte ändras när du redigerar en publicerad tavla." : "Föreslås från rubriken och månaden. Små bokstäver, siffror och bindestreck.") + "</div>" +
      '<label class="b-lbl">Slutdatum (valfritt)<span class="b-rad"><input type="date" class="b-input b-datum" data-t="slutdatum" value="' + esc(state.slutdatum) + '">' +
      '<button type="button" class="b-knapp liten" data-g="inget-slutdatum">Inget slutdatum</button></span></label>' +
      '<div class="b-hint">Efter slutdatumet döljs innehållet och deltagarna ser i stället en kort text' + (p.kontakt ? " med dina kontaktuppgifter" : "") + ".</div>" +
      "</section>";

    /* Fasta kolumner */
    h += '<section class="b-sektion"><h2>Fasta kolumner</h2>' +
      '<label class="b-check"><input type="checkbox" data-t="valkommen"' + (state.valkommen ? " checked" : "") + "> Välkommen hit (porträtt och välkomsttext)</label>";
    if (state.valkommen) {
      h += '<label class="b-lbl">Välkomsttext<textarea class="b-input" rows="7" data-t="valkomstText">' + esc(state.valkomstText) + "</textarea></label>" +
        '<button type="button" class="b-knapp liten" data-g="aterstall-valkomst">Återställ standardtext</button>';
    }
    h += '<label class="b-check"><input type="checkbox" data-t="kontakt"' + (state.kontakt && p.kontakt ? " checked" : "") + (p.kontakt ? "" : " disabled") + "> Kontakt" +
      (p.kontakt ? " (" + esc(p.kontakt.epost) + ")" : " (finns inte i den neutrala profilen)") + "</label></section>";

    /* Kategorier */
    h += '<section class="b-sektion"><h2>Kategorier</h2>';
    state.kategorier.forEach(function (k, ki) {
      h += '<details class="b-kategori" data-k="' + ki + '" id="kat-' + k.uid + '"' + (k.oppen ? " open" : "") + ">" +
        '<summary><span class="b-etikett">K' + (ki + 1) + "</span><span class=\"b-kat-namn\">" + esc(k.rubrik || "Kategori utan rubrik") + '</span><span class="b-kat-antal">' + k.poster.length + " poster</span></summary>" +
        '<div class="b-kat-verktyg">' +
        '<button type="button" class="b-ikonknapp" data-g="kat-upp" aria-label="Flytta kategorin uppåt (vänster på tavlan)"' + (ki === 0 ? " disabled" : "") + ">" + IKON_UPP + "</button>" +
        '<button type="button" class="b-ikonknapp" data-g="kat-ner" aria-label="Flytta kategorin nedåt (höger på tavlan)"' + (ki === state.kategorier.length - 1 ? " disabled" : "") + ">" + IKON_NER + "</button>" +
        '<span class="b-spacer"></span><button type="button" class="b-knapp liten fara" data-g="ta-bort-kat">Ta bort kategorin</button></div>' +
        '<label class="b-lbl">Rubrik <span class="b-krav">(obligatorisk)</span><input type="text" class="b-input" data-kf="rubrik" value="' + esc(k.rubrik) + '"></label>' +
        '<label class="b-lbl">Text överst i kategorin (valfri)<textarea class="b-input" rows="2" data-kf="text">' + esc(k.text) + "</textarea></label>" +
        '<div class="b-poster">';
      k.poster.forEach(function (p2, pi) { h += postHtml(p2, ki, pi); });
      h += '</div><button type="button" class="b-knapp" data-g="lagg-post">Lägg till post</button></details>';
    });
    h += '<button type="button" class="b-knapp" data-g="lagg-kat">Lägg till kategori</button></section>';

    r.innerHTML = h;
    if (fokus) { var f = $(fokus, r); if (f) f.focus(); }
  }

  /* ---------- Händelser i redigeringsvyn ---------- */

  function postFran(e) {
    var pe = e.target.closest(".b-post");
    if (!pe) return null;
    var ki = +pe.getAttribute("data-k"), pi = +pe.getAttribute("data-p");
    return { ki: ki, pi: pi, post: state.kategorier[ki].poster[pi], el: pe };
  }
  function katFran(e) {
    var ke = e.target.closest(".b-kategori");
    if (!ke) return null;
    var ki = +ke.getAttribute("data-k");
    return { ki: ki, kat: state.kategorier[ki], el: ke };
  }

  function kopplaRedigering() {
    var r = $("#b-redigera");

    r.addEventListener("input", function (e) {
      var t = e.target;
      smutsig = true;
      var tf = t.getAttribute("data-t");
      if (tf === "rubrik" || tf === "underrubrik" || tf === "valkomstText" || tf === "slutdatum") {
        state[tf] = t.value;
        if (tf === "rubrik" && state.lage !== "redigera" && !state.slugManuell) {
          state.slug = slugFran(state.rubrik); $("#f-slug").value = state.slug;
        }
        return;
      }
      if (tf === "slug") { state.slugManuell = true; state.slug = t.value; return; }

      var kf = t.getAttribute("data-kf");
      if (kf) {
        var k = katFran(e); k.kat[kf] = t.value;
        if (kf === "rubrik") $(".b-kat-namn", k.el).textContent = t.value || "Kategori utan rubrik";
        return;
      }
      var f = t.getAttribute("data-f");
      if (f === "rubrik" || f === "text" || f === "lank") {
        var p = postFran(e); p.post[f] = t.value;
        if (f === "lank") { var hint = $("[data-hint]", p.el); if (hint) hint.innerHTML = lankTips(t.value); }
      }
    });

    r.addEventListener("change", function (e) {
      var t = e.target;
      smutsig = true;
      if (t.name === "profil") {
        var gammal = PROFILER[state.profil].valkomst.trim();
        if (state.valkomstText.trim() === gammal) state.valkomstText = PROFILER[t.value].valkomst;
        state.profil = t.value;
        ritaRedigering(); return;
      }
      var tf = t.getAttribute("data-t");
      if (tf === "valkommen" || tf === "kontakt") { state[tf] = t.checked; ritaRedigering(); return; }
      if (tf === "slug") { state.slug = saniter(t.value); t.value = state.slug; return; }
      if (t.getAttribute("data-f") === "lank") {
        var pl = postFran(e); pl.post.lank = normaliseraLank(t.value); t.value = pl.post.lank;
        ritaRedigering("#post-" + pl.post.uid + ' [data-f="lank"]'); return;
      }
      if (t.name && t.name.indexOf("farg-") === 0) {
        var pc = postFran(e); pc.post.farg = t.value;
        if (t.value) pc.el.setAttribute("data-farg", t.value); else pc.el.removeAttribute("data-farg");
        return;
      }
      if (t.name && t.name.indexOf("resurs-") === 0) {
        var pr = postFran(e); pr.post.resurs = t.value; ritaRedigering("#post-" + pr.post.uid + ' input[value="' + t.value + '"]'); return;
      }
      if (t.getAttribute("data-f") === "framhavd") { var pf = postFran(e); pf.post.framhavd = t.checked; pf.el.classList.toggle("framhavd", t.checked); return; }

      if (t.getAttribute("data-f") === "fil" && t.files[0]) {
        var pfi = postFran(e), fil = t.files[0];
        pfi.post.fil = { ny: fil, namn: fil.name, storlek: fil.size, url: URL.createObjectURL(fil) };
        pfi.post.filSaknas = false;
        if (!pfi.post.rubrik) pfi.post.rubrik = fil.name.replace(/\.[^.]+$/, "");
        ritaRedigering(); return;
      }
      if (t.getAttribute("data-f") === "bild" && t.files[0]) {
        var pb = postFran(e);
        forminskaBild(t.files[0]).then(function (blob) {
          pb.post.bild = { ny: blob, namn: "bild.jpg", url: URL.createObjectURL(blob) };
          ritaRedigering();
        }, function () { alert("Bilden kunde inte läsas. Prova en JPG- eller PNG-fil."); });
        return;
      }
      if (t.getAttribute("data-g") === "flytta" && t.value !== "") {
        var pm = postFran(e), mal = +t.value;
        state.kategorier[pm.ki].poster.splice(pm.pi, 1);
        state.kategorier[mal].poster.push(pm.post);
        state.kategorier[mal].oppen = true;
        ritaRedigering();
        var nyEl = document.getElementById("post-" + pm.post.uid); if (nyEl) nyEl.scrollIntoView({ block: "center" });
      }
    });

    r.addEventListener("toggle", function (e) {
      if (e.target.classList && e.target.classList.contains("b-kategori")) {
        state.kategorier[+e.target.getAttribute("data-k")].oppen = e.target.open;
      }
    }, true);

    r.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-g]");
      if (!b) return;
      var g = b.getAttribute("data-g");
      smutsig = true;
      var k, p, lista, tmp;

      if (g === "lagg-kat") {
        var nk = nyKategori(); state.kategorier.push(nk);
        ritaRedigering("#kat-" + nk.uid + ' [data-kf="rubrik"]'); return;
      }
      if (g === "inget-slutdatum") { state.slutdatum = ""; ritaRedigering(); return; }
      if (g === "aterstall-valkomst") { state.valkomstText = PROFILER[state.profil].valkomst; ritaRedigering(); return; }

      if (g === "kat-upp" || g === "kat-ner" || g === "ta-bort-kat" || g === "lagg-post") {
        k = katFran(e); lista = state.kategorier;
        if (g === "lagg-post") {
          var np = nyPost(); k.kat.poster.push(np); k.kat.oppen = true;
          ritaRedigering("#post-" + np.uid + ' [data-f="rubrik"]'); return;
        }
        if (g === "ta-bort-kat") {
          if (!confirm("Ta bort kategorin \"" + (k.kat.rubrik || "utan rubrik") + "\" med " + k.kat.poster.length + " poster?")) return;
          lista.splice(k.ki, 1); if (!lista.length) lista.push(nyKategori()); ritaRedigering(); return;
        }
        var ny = g === "kat-upp" ? k.ki - 1 : k.ki + 1;
        tmp = lista[ny]; lista[ny] = lista[k.ki]; lista[k.ki] = tmp;
        ritaRedigering("#kat-" + k.kat.uid + ' [data-g="' + g + '"]'); return;
      }

      p = postFran(e);
      if (!p) return;
      lista = state.kategorier[p.ki].poster;
      if (g === "post-upp" || g === "post-ner") {
        var np2 = g === "post-upp" ? p.pi - 1 : p.pi + 1;
        tmp = lista[np2]; lista[np2] = lista[p.pi]; lista[p.pi] = tmp;
        ritaRedigering("#post-" + p.post.uid + ' [data-g="' + g + '"]');
        var flyttad = document.getElementById("post-" + p.post.uid); if (flyttad) flyttad.scrollIntoView({ block: "nearest" });
        return;
      }
      if (g === "ta-bort-post") {
        var tom = !p.post.rubrik && !p.post.text && !p.post.lank && !p.post.fil;
        if (!tom && !confirm("Ta bort posten \"" + (p.post.rubrik || "utan rubrik") + "\"?")) return;
        lista.splice(p.pi, 1); ritaRedigering(); return;
      }
      if (g === "ta-bort-fil") { p.post.fil = null; ritaRedigering(); return; }
      if (g === "ta-bort-bild") { p.post.bild = null; ritaRedigering(); return; }
    });
  }

  /* ---------- Bygga tavla.json ---------- */

  function byggJson() {
    var upptagna = Object.assign({}, state.befintligaFiler);
    var filer = [], karta = Object.assign({}, state.filkarta);
    var profil = PROFILER[state.profil];
    var json = {
      version: 1,
      rubrik: state.rubrik.trim(),
      underrubrik: state.underrubrik.trim(),
      profil: state.profil,
      slutdatum: state.slutdatum || "",
      fastaKolumner: { valkommen: !!state.valkommen, kontakt: !!(state.kontakt && profil.kontakt) },
      valkomstText: state.valkomstText.trim() === profil.valkomst.trim() ? "" : state.valkomstText.trim(),
      kategorier: []
    };
    state.kategorier.forEach(function (k, ki) {
      var kj = { id: k.id || k.uid, rubrik: k.rubrik.trim(), text: k.text.trim(), poster: [] };
      k.poster.forEach(function (p, pi) {
        var etikett = "K" + (ki + 1) + "P" + (pi + 1);
        var pj = { id: p.id || p.uid };
        if (p.rubrik.trim()) pj.rubrik = p.rubrik.trim();
        if (p.text.trim()) pj.text = p.text.trim();
        if (p.resurs === "lank" && p.lank.trim()) pj.lank = normaliseraLank(p.lank);
        if (p.resurs === "fil" && p.fil) {
          if (p.fil.befintlig) pj.fil = p.fil.befintlig;
          else {
            pj.fil = unik("filer/" + etikett + "-" + saniterFilnamn(p.fil.namn), upptagna);
            filer.push({ sokvag: pj.fil, blob: p.fil.ny });
            karta[pj.fil] = p.fil.url;
          }
          pj.filnamn = p.fil.namn;
          if (p.fil.storlek) pj.filstorlek = p.fil.storlek;
        }
        if (p.bild) {
          if (p.bild.befintlig) pj.bild = p.bild.befintlig;
          else {
            pj.bild = unik("filer/" + etikett + "-bild.jpg", upptagna);
            filer.push({ sokvag: pj.bild, blob: p.bild.ny });
            karta[pj.bild] = p.bild.url;
          }
        }
        if (p.framhavd) pj.framhavd = true;
        if (p.farg) pj.farg = p.farg;
        var t = KT.typFor(pj); if (t) pj.typ = t.typ;
        kj.poster.push(pj);
      });
      json.kategorier.push(kj);
    });
    return { json: json, filer: filer, karta: karta };
  }

  /* ---------- Kontroll före nedladdning ---------- */

  function validera() {
    var fel = [];
    if (!state.rubrik.trim()) fel.push({ text: "Tavlan saknar rubrik.", mal: "#f-rubrik" });
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(state.slug)) fel.push({ text: "Adressen får bara innehålla små bokstäver (a till z), siffror och bindestreck.", mal: "#f-slug" });
    state.kategorier.forEach(function (k, ki) {
      var kNamn = "Kategori " + (ki + 1) + (k.rubrik ? " (" + k.rubrik + ")" : "");
      if (!k.rubrik.trim()) fel.push({ text: kNamn + " saknar rubrik.", mal: "#kat-" + k.uid + ' [data-kf="rubrik"]', kat: k });
      k.poster.forEach(function (p, pi) {
        var pNamn = "Post K" + (ki + 1) + "P" + (pi + 1) + (p.rubrik ? " (" + p.rubrik + ")" : "");
        var mal = "#post-" + p.uid + ' [data-f="rubrik"]';
        var harLank = p.resurs === "lank" && p.lank.trim(), harFil = p.resurs === "fil" && p.fil;
        if (!p.rubrik.trim() && !p.text.trim() && !harLank && !harFil) fel.push({ text: pNamn + " är tom. Fyll i minst rubrik, text, länk eller fil, eller ta bort posten.", mal: mal, kat: k });
        if (p.resurs === "lank" && !p.lank.trim()) fel.push({ text: pNamn + ": länken saknas. Fyll i en adress eller välj Ingen.", mal: "#post-" + p.uid + ' [data-f="lank"]', kat: k });
        if (harLank && !giltigLank(normaliseraLank(p.lank))) fel.push({ text: pNamn + ": länken ser inte ut som en webbadress.", mal: "#post-" + p.uid + ' [data-f="lank"]', kat: k });
        if (p.resurs === "fil" && !p.fil) fel.push({ text: pNamn + ": ingen fil vald. Välj fil, byt till Länk eller välj Ingen.", mal: "#post-" + p.uid + ' [data-f="fil"]', kat: k });
        if (harFil && p.fil.storlek > MAX_FIL) fel.push({ text: pNamn + ": filen är större än 25 MB. Lägg den i Dropbox och använd länk.", mal: mal, kat: k });
      });
    });
    return fel;
  }

  function visaFel(fel) {
    var ruta = $("#b-felruta");
    ruta.innerHTML = "<h2>Det här behöver fixas innan du laddar ner</h2><ul>" +
      fel.map(function (f, i) { return '<li><a href="#" data-felindex="' + i + '">' + esc(f.text) + "</a></li>"; }).join("") + "</ul>";
    ruta.hidden = false;
    ruta.onclick = function (e) {
      var a = e.target.closest("[data-felindex]"); if (!a) return;
      e.preventDefault();
      var f = fel[+a.getAttribute("data-felindex")];
      if (f.kat && !f.kat.oppen) { f.kat.oppen = true; ritaRedigering(); visaFel(fel); }
      var m = $(f.mal); if (m) { m.scrollIntoView({ block: "center" }); m.focus(); }
    };
    ruta.scrollIntoView({ block: "start" });
  }

  function finnsTavla(slug) {
    var url = INST.webbadress.replace(/\/$/, "") + "/" + slug + "/tavla.json";
    return fetch(url, { method: "HEAD", cache: "no-store" }).then(function (r) { return r.ok; }, function () { return false; });
  }

  function laddaNerTavla() {
    if (aktivFlik !== "redigera") visaFlik("redigera");
    var fel = validera();
    if (fel.length) { visaFel(fel); return; }
    $("#b-felruta").hidden = true;

    var knapp = $("#b-ladda-ner");
    knapp.disabled = true; knapp.textContent = "Packar...";
    var klar = function () { knapp.disabled = false; knapp.textContent = "Ladda ner tavlan"; };

    var kontroll = state.lage === "redigera" ? Promise.resolve(false) : finnsTavla(state.slug);
    kontroll.then(function (finns) {
      if (finns && !confirm("Det finns redan en publicerad tavla på adressen " + state.slug + ". Om du laddar upp den här skrivs den över. Fortsätta ändå?")) { klar(); return; }
      var b = byggJson();
      var zip = new JSZip();
      var mapp = zip.folder(state.slug);
      mapp.file("index.html", TAVLA_INDEX);
      mapp.file("tavla.json", JSON.stringify(b.json, null, 2) + "\n");
      b.filer.forEach(function (f) { mapp.file(f.sokvag, f.blob); });
      return zip.generateAsync({ type: "blob" }).then(function (blob) {
        KT.laddaNer(blob, state.slug + ".zip");
        smutsig = false;
        klar();
        visaKlart(b.filer.length);
      });
    }).catch(function () { klar(); alert("Något gick fel när tavlan skulle packas. Försök igen."); });
  }

  function visaKlart(antalFiler) {
    var adress = INST.webbadress.replace(/\/$/, "") + "/" + state.slug + "/";
    var gammal = document.getElementById("b-klart"); if (gammal) gammal.remove();
    var d = document.createElement("dialog");
    d.id = "b-klart"; d.className = "kt-dialog b-klart";
    d.innerHTML = "<h2>Tavlan är nedladdad</h2>" +
      "<p>Filen <strong>" + esc(state.slug) + ".zip</strong> ligger i Hämtade filer" + (antalFiler ? " (" + antalFiler + " nya filer ingår)" : "") + ".</p>" +
      "<ol>" +
      "<li>Dubbelklicka på zip-filen så att mappen <strong>" + esc(state.slug) + "</strong> packas upp.</li>" +
      "<li>Öppna repot <strong>kurstavlor</strong> på GitHub och välj <em>Add file</em> och sedan <em>Upload files</em>.</li>" +
      "<li>Dra hela mappen till uppladdningsrutan och klicka på <em>Commit changes</em>. Allt i en uppladdning ger en enda publicering på Netlify.</li>" +
      (state.lage === "redigera" ? "<li>Befintliga filer i mappen ligger kvar, tavla.json ersätts.</li>" : "") +
      "<li>Efter någon minut finns tavlan på adressen nedan.</li></ol>" +
      '<div class="kt-rad"><input type="text" readonly value="' + esc(adress) + '"></div>' +
      '<div class="kt-rad kt-rad-slut"><button type="button" class="kt-knapp sekundar" data-g="qr">Länk och QR-kod</button><button type="button" class="kt-knapp" data-g="stang">Stäng</button></div>';
    document.body.appendChild(d);
    d.addEventListener("click", function (e) {
      var g = e.target.getAttribute && e.target.getAttribute("data-g");
      if (g === "stang" || e.target === d) d.close();
      if (g === "qr") { d.close(); KT.visaDela(adress, state.slug); }
    });
    d.addEventListener("close", function () { d.remove(); });
    d.showModal();
  }

  /* ---------- Förhandsvisning ---------- */

  function ritaForhand() {
    var b = byggJson();
    var adress = INST.webbadress.replace(/\/$/, "") + "/" + (state.slug || "tavla") + "/";
    KT.rendera($("#b-forhand-tavla"), b.json, { forhandsvisning: true, bas: state.bas, urlKarta: b.karta, tavlansAdress: adress });
  }

  function visaFlik(flik) {
    aktivFlik = flik;
    document.querySelectorAll(".b-flik").forEach(function (f) { f.classList.toggle("aktiv", f.getAttribute("data-flik") === flik); f.setAttribute("aria-pressed", f.getAttribute("data-flik") === flik ? "true" : "false"); });
    $("#b-redigera").hidden = flik !== "redigera";
    $("#b-forhand").hidden = flik !== "forhandsvisa";
    document.body.classList.toggle("visar-forhand", flik === "forhandsvisa");
    if (flik === "forhandsvisa") ritaForhand();
    window.scrollTo(0, 0);
  }

  /* ---------- Läsa in en tidigare tavla ---------- */

  function tavlaAdress(s) {
    s = String(s || "").trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) {
      if (s.indexOf(".") > 0 && s.indexOf("/") > 0) s = "https://" + s;
      else s = INST.webbadress.replace(/\/$/, "") + "/" + s.replace(/^\/+|\/+$/g, "");
    }
    s = s.split(/[?#]/)[0].replace(/\/(index\.html|tavla\.json)$/, "");
    return s.replace(/\/?$/, "/");
  }

  function hamtaFranAdress(adress, lage) {
    var bas = tavlaAdress(adress);
    if (!bas) return Promise.reject(new Error("Skriv in tavlans adress."));
    return fetch(bas + "tavla.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("Hittade ingen tavla på " + bas); return r.json(); },
        function () { throw new Error("Kunde inte nå " + bas + ". Prova att välja tavlans mapp på datorn i stället."); })
      .then(function (json) {
        var slug = bas.replace(/\/$/, "").split("/").pop();
        return laddaJson(json, lage, {
          slug: slug, bas: bas,
          hamta: function (sokvag) { return fetch(bas + sokvag).then(function (r) { return r.ok ? r.blob() : null; }, function () { return null; }); }
        });
      });
  }

  function hamtaFranMapp(filer, lage) {
    filer = Array.prototype.slice.call(filer || []);
    var jsonFiler = filer.filter(function (f) { return /(^|\/)tavla\.json$/.test(f.webkitRelativePath || f.name); });
    if (!jsonFiler.length) return Promise.reject(new Error("Mappen innehåller ingen tavla.json. Välj mappen som heter som tavlans adress."));
    jsonFiler.sort(function (a, b) { return (a.webkitRelativePath || "").length - (b.webkitRelativePath || "").length; });
    var jf = jsonFiler[0], rot = (jf.webkitRelativePath || "tavla.json").replace(/tavla\.json$/, "");
    var karta = {};
    filer.forEach(function (f) { var rel = f.webkitRelativePath || f.name; if (rel.indexOf(rot) === 0) karta[rel.slice(rot.length)] = f; });
    var slug = rot.split("/").filter(Boolean).pop() || "";
    return jf.text().then(function (txt) {
      var json;
      try { json = JSON.parse(txt); } catch (e) { throw new Error("tavla.json kunde inte läsas."); }
      return laddaJson(json, lage, {
        slug: slug, bas: "", karta: karta,
        hamta: function (sokvag) { return Promise.resolve(karta[sokvag] || null); }
      });
    });
  }

  function laddaJson(json, lage, kalla) {
    var s = nyttState();
    s.lage = lage;
    s.profil = PROFILER[json.profil] ? json.profil : "sb";
    s.rubrik = json.rubrik || "";
    s.underrubrik = json.underrubrik || "";
    var fk = json.fastaKolumner || {};
    s.valkommen = fk.valkommen !== false;
    s.kontakt = fk.kontakt !== false;
    s.valkomstText = json.valkomstText || PROFILER[s.profil].valkomst;
    if (lage === "redigera") {
      s.slug = kalla.slug; s.slugManuell = true; s.slutdatum = json.slutdatum || "";
      s.bas = kalla.bas || "";
      if (kalla.karta) Object.keys(kalla.karta).forEach(function (k) { s.filkarta[k] = URL.createObjectURL(kalla.karta[k]); });
    } else {
      s.slug = slugFran(s.rubrik);
      if (s.slug === kalla.slug) s.slug += "-2"; // samma månad som mallen: undvik att skriva över den
    }

    var varningar = [];
    var jobb = [];
    s.kategorier = (json.kategorier || []).map(function (kat) {
      var k = { uid: uid("k-"), id: kat.id || null, rubrik: kat.rubrik || "", text: kat.text || "", oppen: false, poster: [] };
      (kat.poster || []).forEach(function (post) {
        var p = nyPost();
        p.id = post.id || null; p.rubrik = post.rubrik || ""; p.text = post.text || ""; p.framhavd = !!post.framhavd;
        p.farg = KT.FARGER.indexOf(post.farg) >= 0 ? post.farg : "";
        if (post.lank) { p.resurs = "lank"; p.lank = post.lank; }
        if (post.fil) {
          p.resurs = "fil";
          if (lage === "redigera") {
            p.fil = { befintlig: post.fil, namn: post.filnamn || basnamn(post.fil), storlek: post.filstorlek || 0 };
            s.befintligaFiler[post.fil] = true;
          } else {
            p.filSaknas = true; p.tidigareFil = post.filnamn || basnamn(post.fil);
          }
        }
        if (post.bild) {
          if (lage === "redigera") { p.bild = { befintlig: post.bild }; s.befintligaFiler[post.bild] = true; }
          else {
            jobb.push(kalla.hamta(post.bild).then(function (blob) {
              if (blob) p.bild = { ny: blob, namn: "bild.jpg", url: URL.createObjectURL(blob) };
              else varningar.push("Bilden till \"" + (p.rubrik || "en post") + "\" kunde inte hämtas.");
            }));
          }
        }
        k.poster.push(p);
      });
      return k;
    });
    if (!s.kategorier.length) s.kategorier.push(nyKategori());
    if (s.kategorier.length) s.kategorier[0].oppen = true;

    return Promise.all(jobb).then(function () {
      state = s;
      starta();
      if (varningar.length) alert(varningar.join("\n"));
    });
  }

  /* ---------- Start ---------- */

  function starta() {
    $("#b-start").hidden = true;
    $("#b-redigera").hidden = false;
    $("#b-flikar").hidden = false;
    $("#b-topp-hoger").hidden = false;
    $("#b-lage").textContent = state.lage === "redigera" ? "Redigerar: " + state.slug : state.lage === "mall" ? "Ny tavla från mall" : "Ny tavla";
    visaFlik("redigera");
    ritaRedigering(state.lage === "redigera" ? null : "#f-rubrik");
    smutsig = state.lage !== "ny";
  }

  function init() {
    var mallInnehall = $("#b-hamta-mall").innerHTML;
    document.querySelectorAll(".b-hamta").forEach(function (box) {
      var lage = box.getAttribute("data-lage");
      box.innerHTML = mallInnehall;
      var visaStartFel = function (err) { $("#b-start-fel").textContent = err.message || String(err); };
      var adressFalt = $("[data-adress]", box);
      var hamta = function () {
        $("#b-start-fel").textContent = "";
        hamtaFranAdress(adressFalt.value, lage).catch(visaStartFel);
      };
      $("[data-hamta-adress]", box).addEventListener("click", hamta);
      adressFalt.addEventListener("keydown", function (e) { if (e.key === "Enter") hamta(); });
      $("[data-hamta-mapp]", box).addEventListener("change", function (e) {
        $("#b-start-fel").textContent = "";
        hamtaFranMapp(e.target.files, lage).catch(visaStartFel);
        e.target.value = "";
      });
    });
    $('[data-start="ny"]').addEventListener("click", function () { state = nyttState(); state.slug = ""; starta(); });

    kopplaRedigering();
    document.querySelectorAll(".b-flik").forEach(function (f) { f.addEventListener("click", function () { visaFlik(f.getAttribute("data-flik")); }); });
    $("#b-ladda-ner").addEventListener("click", laddaNerTavla);
    $("#b-borja-om").addEventListener("click", function () {
      if (smutsig && !confirm("Börja om? Det du inte laddat ner försvinner.")) return;
      smutsig = false; location.reload();
    });
    window.addEventListener("beforeunload", function (e) { if (smutsig) { e.preventDefault(); e.returnValue = ""; } });
  }

  init();
})();
