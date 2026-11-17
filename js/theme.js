/* =====================================================================
   Themes. Loaded in every page's <head>, before the page paints, so the
   saved look shows right away (no flash of the default colors).
   - Picks the theme saved in this browser (Settings saves it to your account too).
   - Loads only that theme's fonts.
   - The colors, corners and shadows live in css/styles.css under
     [data-theme="..."]. Default is the :root values at the top of that file.
   Checking a page in every theme: add ?theme=trailhead (or pop, quiet, field, default)
   to its address. That previews without saving.
   To add a theme: add it here, add its block in styles.css, and add it to the
   allowed list in a new migration (see 031).
   ===================================================================== */
(function () {
  var KEY = "momentum.theme";
  var FONTS = "https://fonts.googleapis.com/css2?";
  var THEMES = {
    "default":   { name: "Default",     color: "#00917e", fonts: "family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700" },
    "trailhead": { name: "Trailhead",   color: "#2f5d46", fonts: "family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Source+Sans+3:wght@400;500;600;700" },
    "pop":       { name: "Campus Pop",  color: "#6d3ae8", fonts: "family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800" },
    "quiet":     { name: "Quiet",       color: "#f7f7f5", fonts: "family=Inter:wght@400;500;600;700" },
    "field":     { name: "Field Notes", color: "#1f3a93", fonts: "family=IBM+Plex+Mono:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700" }
  };

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function apply(id, remember) {
    if (!THEMES[id]) id = "default";
    var html = document.documentElement;
    if (id === "default") html.removeAttribute("data-theme"); else html.setAttribute("data-theme", id);

    var link = document.getElementById("theme-fonts");
    if (!link) {
      link = document.createElement("link");
      link.id = "theme-fonts"; link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    var href = FONTS + THEMES[id].fonts + "&display=swap";
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEMES[id].color);

    if (remember !== false) { try { localStorage.setItem(KEY, id); } catch (e) {} }
    return id;
  }

  // ?theme=pop on any page previews a theme without saving it (handy for checking a page in every theme)
  var preview = null;
  try { preview = new URLSearchParams(location.search).get("theme"); } catch (e) {}
  if (!THEMES[preview]) preview = null;
  var current = apply(preview || saved(), false);

  window.Theme = {
    ids: Object.keys(THEMES),
    name: function (id) { return (THEMES[id] || THEMES["default"]).name; },
    current: function () { return current; },
    previewing: !!preview,
    apply: function (id) { current = apply(id, true); return current; },
    // Settings › Appearance: load every theme's fonts so each preview tile shows its real font
    loadAllFonts: function () {
      Object.keys(THEMES).forEach(function (id) {
        if (id === current || document.getElementById("theme-fonts-" + id)) return;
        var l = document.createElement("link");
        l.id = "theme-fonts-" + id; l.rel = "stylesheet"; l.href = FONTS + THEMES[id].fonts + "&display=swap";
        document.head.appendChild(l);
      });
    }
  };
})();
