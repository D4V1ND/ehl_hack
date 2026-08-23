/* Deck engine. No build step, no dependencies, no network — a deck must open
   from a USB stick in a room with bad wifi.

   Markup contract:
     <div class="deck" data-deck="v1 · 5 min" data-budget="300"> …
       <section class="slide" data-title="Problem" data-seconds="35">
         <aside class="note">what to say</aside>
       </section>

   Keys:  → ← space  next/prev · o overview · n notes · t start/stop timer
          r reset timer · f fullscreen · p print (PDF export) · digits + enter jump
*/
(function () {
    "use strict";

    var deck = document.querySelector(".deck");
    if (!deck) return;

    var slides = Array.prototype.slice.call(deck.querySelectorAll(".slide"));
    var total = slides.length;
    var budget = parseInt(deck.getAttribute("data-budget") || "300", 10);
    /* appendix slides are backup for Q&A: they carry data-seconds="0" and are
       excluded from the planned time. */
    var label = deck.getAttribute("data-deck") || "deck";
    var current = 0;
    var started = null;
    var elapsed = 0;
    var jumpBuffer = "";

    /* ------------------------------------------------------------ chrome */

    var hud = document.createElement("div");
    hud.className = "hud";
    hud.innerHTML =
        '<span>' + label + "</span>" +
        '<span class="spacer"></span>' +
        '<span id="hud-title"></span>' +
        '<span><b id="hud-pos">1</b> / ' + total + "</span>" +
        '<span id="hud-clock">0:00</span>' +
        '<span class="d">budget ' + fmt(budget) + "</span>" +
        '<button data-act="timer">start</button>' +
        '<button data-act="notes">notes</button>' +
        '<button data-act="overview">grid</button>' +
        '<button data-act="print">pdf</button>';
    document.body.appendChild(hud);

    var notes = document.createElement("aside");
    notes.className = "notes";
    notes.innerHTML = '<h4>speaker notes</h4><div id="notes-body"></div>';
    document.body.appendChild(notes);

    var overview = document.createElement("div");
    overview.className = "overview";
    document.body.appendChild(overview);

    slides.forEach(function (slide, i) {
        var isAppendix = slide.hasAttribute("data-appendix");
        var thumb = document.createElement("div");
        thumb.className = isAppendix ? "thumb app" : "thumb";
        thumb.innerHTML =
            '<div class="i">' + pad(i + 1) + "</div>" +
            '<div class="t">' + (slide.getAttribute("data-title") || "—") + "</div>" +
            '<div class="s">' + (slide.getAttribute("data-seconds") || "–") + "s</div>";
        thumb.addEventListener("click", function () {
            go(i);
            document.body.classList.remove("overview-on");
        });
        overview.appendChild(thumb);

        var foot = document.createElement("div");
        foot.className = "slide-foot";
        foot.innerHTML =
            "<span>Stockout · autonomous sourcing" + (isAppendix ? " · appendix" : "") + "</span>" +
            "<span>" + pad(i + 1) + " / " + pad(total) + "</span>";
        slide.appendChild(foot);
    });

    /* ------------------------------------------------------------ scaling */

    function fit() {
        var pad = 44;
        var notesWidth = document.body.classList.contains("notes-on") ? 380 : 0;
        var w = (window.innerWidth - notesWidth - pad) / 1280;
        var h = (window.innerHeight - 34 - pad) / 720;
        var scale = Math.min(w, h);
        deck.style.transform = "translateX(" + (-notesWidth / 2) + "px) scale(" + scale + ")";
    }

    function toggleNotes() {
        document.body.classList.toggle("notes-on");
        fit();
    }

    window.addEventListener("resize", fit);

    /* ------------------------------------------------------------ nav */

    function go(i) {
        current = Math.max(0, Math.min(total - 1, i));
        slides.forEach(function (s, n) { s.classList.toggle("is-active", n === current); });
        var slide = slides[current];
        document.getElementById("hud-pos").textContent = String(current + 1);
        document.getElementById("hud-title").textContent = slide.getAttribute("data-title") || "";
        var note = slide.querySelector(".note");
        document.getElementById("notes-body").innerHTML = note
            ? note.innerHTML
            : '<p class="d">no notes on this slide.</p>';
        Array.prototype.forEach.call(overview.children, function (t, n) {
            t.classList.toggle("cur", n === current);
        });
        if (history.replaceState) history.replaceState(null, "", "#" + (current + 1));
    }

    document.addEventListener("keydown", function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        var k = e.key;

        if (k >= "0" && k <= "9") { jumpBuffer += k; return; }
        if (k === "Enter" && jumpBuffer) {
            go(parseInt(jumpBuffer, 10) - 1);
            jumpBuffer = "";
            return;
        }
        jumpBuffer = "";

        if (k === "ArrowRight" || k === " " || k === "PageDown" || k === "ArrowDown") {
            e.preventDefault(); go(current + 1);
        } else if (k === "ArrowLeft" || k === "PageUp" || k === "ArrowUp") {
            e.preventDefault(); go(current - 1);
        } else if (k === "Home") { go(0); }
        else if (k === "End") { go(total - 1); }
        else if (k === "n") { toggleNotes(); }
        else if (k === "o") { document.body.classList.toggle("overview-on"); }
        else if (k === "t") { toggleTimer(); }
        else if (k === "r") { resetTimer(); }
        else if (k === "p") { window.print(); }
        else if (k === "f") {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
        } else if (k === "Escape") {
            document.body.classList.remove("overview-on");
        }
    });

    deck.addEventListener("click", function (e) {
        if (e.target.closest("a")) return;
        go(current + (e.clientX > window.innerWidth / 2 ? 1 : -1));
    });

    hud.addEventListener("click", function (e) {
        var act = e.target.getAttribute && e.target.getAttribute("data-act");
        if (act === "timer") toggleTimer();
        if (act === "notes") toggleNotes();
        if (act === "overview") document.body.classList.toggle("overview-on");
        if (act === "print") window.print();
    });

    /* ------------------------------------------------------------ timer */

    function fmt(s) {
        var m = Math.floor(Math.abs(s) / 60);
        var r = Math.abs(s) % 60;
        return (s < 0 ? "-" : "") + m + ":" + (r < 10 ? "0" : "") + r;
    }

    function pad(n) { return n < 10 ? "0" + n : String(n); }

    function toggleTimer() {
        var btn = hud.querySelector('[data-act="timer"]');
        if (started) {
            elapsed += Math.round((Date.now() - started) / 1000);
            started = null;
            btn.textContent = "start";
        } else {
            started = Date.now();
            btn.textContent = "pause";
        }
    }

    function resetTimer() {
        started = null;
        elapsed = 0;
        hud.querySelector('[data-act="timer"]').textContent = "start";
        tick();
    }

    function tick() {
        var secs = elapsed + (started ? Math.round((Date.now() - started) / 1000) : 0);
        var clock = document.getElementById("hud-clock");
        clock.textContent = fmt(secs);
        clock.className = secs > budget ? "over" : secs > budget * 0.8 ? "warnt" : "";
    }

    setInterval(tick, 500);

    /* ------------------------------------------------------------ boot */

    function fromHash() {
        var n = parseInt((location.hash || "").replace("#", ""), 10);
        return isNaN(n) ? 0 : n - 1;
    }

    window.addEventListener("hashchange", function () {
        if (fromHash() !== current) go(fromHash());
    });

    fit();
    go(fromHash());
})();
