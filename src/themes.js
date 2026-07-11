/* ===== Theme-System 2.0 (läuft NACH player.js) =====
   player.js kennt nur data-theme-Paletten. Dieses Modul erweitert das:
   - Jedes Theme ändert jetzt Farben, Akzent, Schriftart, Ecken-Radius und
     Effekte (animierte Hintergründe, Scanlines, ...).
   - Rechtsklick auf ein Theme öffnet ein Menü, in dem man pro Theme
     an-/abschalten kann, WAS es ändern darf.
   - "Eigenes Theme": kompletter Editor (Farben, Schrift, Radius, Effekte).
   Alles wird als Inline-CSS-Variablen auf <html> gesetzt - die gewinnen
   gegen die data-theme-Regeln in styles.css, dadurch bleibt player.js
   unverändert und beide Systeme koexistieren. */
(function () {
  "use strict";

  const root = document.documentElement;
  const THEME_KEY = "meineMusikTheme";
  const ASPECTS_KEY = "themeAspects";
  const CUSTOM_KEY = "customTheme";

  /* ===== Farb-Helfer ===== */
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("");
  }
  function lighten(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  }
  function darken(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
  }
  function mix(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }
  function rgba(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /* ===== Schrift-Stacks ===== */
  const FONTS = {
    inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'Cascadia Code', Consolas, ui-monospace, monospace",
    rounded: "'Segoe UI', Verdana, 'Trebuchet MS', sans-serif",
  };

  /* Vollständige Palette aus wenigen Basiswerten ableiten - hält die
     Theme-Definitionen kurz und den Custom-Editor auf 5 Farbfelder. */
  function derivePalette(o) {
    return {
      "--sp-black": o.black || darken(o.bg, 0.5),
      "--sp-bg": o.bg,
      "--sp-elevated": o.elevated,
      "--sp-elevated-hover": o.elevatedHover || lighten(o.elevated, 0.1),
      "--sp-border": o.border || rgba(o.accent, 0.18),
      "--sp-text": o.text || "#ffffff",
      "--sp-muted": o.muted,
      "--sp-muted-2": o.muted2 || mix(o.muted, o.bg, 0.4),
      "--sp-green": o.accent,
      "--sp-green-hover": o.accentHover || lighten(o.accent, 0.2),
      "--sp-gradient-top": o.gradTop || mix(o.accent, o.bg, 0.72),
      "--sp-surface": o.surface || rgba(o.accent, 0.08),
      "--sp-scrollbar": o.scrollbar || lighten(o.bg, 0.18),
    };
  }

  /* ===== Themes: Palette + Schrift + Radius + Effekt-Klasse ===== */
  const THEMES = {
    "spotify-green": {
      pal: derivePalette({ bg: "#121212", elevated: "#181818", elevatedHover: "#282828", muted: "#a7a7a7", muted2: "#727272", accent: "#1db954", accentHover: "#1ed760", gradTop: "#2a2a2a", border: "rgba(255,255,255,0.08)", surface: "rgba(255,255,255,0.06)", scrollbar: "#3f3f3f", black: "#000000" }),
      font: "inter", radius: [12, 8, 4],
    },
    "neon-purple": {
      pal: derivePalette({ bg: "#0d0518", elevated: "#170a28", elevatedHover: "#241238", muted: "#b49ecf", muted2: "#7d6a99", accent: "#a855f7", accentHover: "#c084fc", gradTop: "#2b1052", scrollbar: "#3d2660", black: "#05010a" }),
      font: "inter", radius: [16, 10, 6], fx: "fx-glowpulse",
    },
    "cyberpunk-cyan": {
      pal: derivePalette({ bg: "#0b1416", elevated: "#101f22", elevatedHover: "#162a2e", muted: "#8fc6cf", muted2: "#5b878f", accent: "#22e0ff", accentHover: "#6ce9ff", gradTop: "#0d3a44", scrollbar: "#1e4d56", black: "#05090a" }),
      font: "mono", radius: [0, 0, 0], fx: "fx-scanlines",
    },
    "crimson-red": {
      pal: derivePalette({ bg: "#140808", elevated: "#1f0d0d", elevatedHover: "#2e1414", muted: "#cf9ea3", muted2: "#8f6367", accent: "#e63946", accentHover: "#ff5c67", gradTop: "#431016", scrollbar: "#52201f", black: "#0a0303" }),
      font: "inter", radius: [12, 8, 4],
    },
    "sunset-orange": {
      pal: derivePalette({ bg: "#171008", elevated: "#22170a", elevatedHover: "#33220e", muted: "#cfb18f", muted2: "#8f7457", accent: "#ff8c1a", accentHover: "#ffa64d", gradTop: "#4a2a08", scrollbar: "#52351a", black: "#0d0803" }),
      font: "inter", radius: [14, 10, 6], fx: "fx-sunsetbg",
    },
    "ocean-blue": {
      pal: derivePalette({ bg: "#06121f", elevated: "#0a1c30", elevatedHover: "#10294a", muted: "#93b6d6", muted2: "#5b7a96", accent: "#2f9dff", accentHover: "#66b8ff", gradTop: "#0d3055", scrollbar: "#1c3f5e", black: "#030a12" }),
      font: "inter", radius: [14, 10, 6],
    },
    "rose-pink": {
      pal: derivePalette({ bg: "#180a12", elevated: "#24101c", elevatedHover: "#33182a", muted: "#d3a0bc", muted2: "#91647e", accent: "#ff5ca8", accentHover: "#ff85bf", gradTop: "#47122f", scrollbar: "#54223c", black: "#0f0509" }),
      font: "rounded", radius: [20, 14, 8],
    },
    "arctic-white": {
      pal: derivePalette({ bg: "#f0f1f3", elevated: "#ffffff", elevatedHover: "#e5e7ea", muted: "#52525b", muted2: "#8a8a94", accent: "#169c46", accentHover: "#1db954", gradTop: "#dcdee2", text: "#121212", border: "rgba(0,0,0,0.12)", surface: "rgba(0,0,0,0.05)", scrollbar: "#c3c6cc", black: "#ffffff" }),
      font: "system", radius: [12, 8, 4],
    },
    "matrix-green": {
      pal: derivePalette({ bg: "#030803", elevated: "#061206", elevatedHover: "#0a1f0a", muted: "#6fbf6f", muted2: "#3f7a3f", accent: "#00ff41", accentHover: "#66ff8c", gradTop: "#052505", text: "#d8ffd8", scrollbar: "#14421a", black: "#000000" }),
      font: "mono", radius: [2, 2, 2], fx: "fx-scanlines",
    },
    "gold-luxus": {
      pal: derivePalette({ bg: "#12100a", elevated: "#1c1810", elevatedHover: "#292213", muted: "#cbbb8d", muted2: "#8c7f5c", accent: "#d4af37", accentHover: "#e6c65c", gradTop: "#3b2f10", scrollbar: "#4c3f1c", black: "#0a0805" }),
      font: "serif", radius: [10, 6, 3],
    },
    "midnight-blue": {
      pal: derivePalette({ bg: "#0a0e1a", elevated: "#111726", elevatedHover: "#1a2338", muted: "#9aa5cf", muted2: "#626c94", accent: "#7c9eff", accentHover: "#a3bcff", gradTop: "#1c2747", scrollbar: "#263252", black: "#05070f" }),
      font: "inter", radius: [14, 10, 6],
    },
    "rgb-wave": {
      pal: derivePalette({ bg: "#121212", elevated: "#181818", elevatedHover: "#282828", muted: "#a7a7a7", muted2: "#727272", accent: "#1db954", accentHover: "#1ed760", gradTop: "#2a2a2a", border: "rgba(255,255,255,0.08)", surface: "rgba(255,255,255,0.06)", scrollbar: "#3f3f3f", black: "#000000" }),
      font: "inter", radius: [12, 8, 4], keepAttr: true, // styles.css animiert per data-theme
    },
    "mocha-braun": {
      pal: derivePalette({ bg: "#151009", elevated: "#201811", elevatedHover: "#2e2218", muted: "#c2a68b", muted2: "#85705c", accent: "#c98d4e", accentHover: "#dfa76b", gradTop: "#3d2a17", scrollbar: "#46331f", black: "#0c0806" }),
      font: "serif", radius: [10, 8, 5],
    },
    /* ===== Neue Themes ===== */
    "amoled-schwarz": {
      pal: derivePalette({ bg: "#000000", elevated: "#0a0a0a", elevatedHover: "#161616", muted: "#9a9a9a", muted2: "#5c5c5c", accent: "#ffffff", accentHover: "#e0e0e0", gradTop: "#111111", text: "#ffffff", border: "rgba(255,255,255,0.14)", surface: "rgba(255,255,255,0.06)", scrollbar: "#2a2a2a", black: "#000000" }),
      font: "system", radius: [8, 6, 3],
    },
    vaporwave: {
      pal: derivePalette({ bg: "#160a2e", elevated: "#221244", elevatedHover: "#2f1a5c", muted: "#c4a6e8", muted2: "#8468ad", accent: "#ff71ce", accentHover: "#ff9ede", gradTop: "#3d1670", scrollbar: "#45297a", black: "#0b0518" }),
      font: "rounded", radius: [18, 12, 8], fx: "fx-vaporwave",
    },
    "retro-terminal": {
      pal: derivePalette({ bg: "#0d0a02", elevated: "#161105", elevatedHover: "#221a08", muted: "#c2993d", muted2: "#7a6126", accent: "#ffb000", accentHover: "#ffc94d", gradTop: "#2e2405", text: "#ffd98a", scrollbar: "#3d3110", black: "#070500" }),
      font: "mono", radius: [0, 0, 0], fx: "fx-scanlines",
    },
    "lavendel-pastell": {
      pal: derivePalette({ bg: "#f3f0fa", elevated: "#ffffff", elevatedHover: "#e9e3f7", muted: "#6b6383", muted2: "#9a92b3", accent: "#8a6fd6", accentHover: "#a48ce6", gradTop: "#ddd2f2", text: "#2a2438", border: "rgba(120,90,200,0.18)", surface: "rgba(120,90,200,0.07)", scrollbar: "#cfc4e8", black: "#ffffff" }),
      font: "rounded", radius: [18, 12, 8],
    },
    "mint-frost": {
      pal: derivePalette({ bg: "#0a1a16", elevated: "#0f2620", elevatedHover: "#16352d", muted: "#96c9b9", muted2: "#5e8a7c", accent: "#7fe8c3", accentHover: "#a5f0d5", gradTop: "#134336", text: "#eafff7", scrollbar: "#1f4a3e", black: "#04100c" }),
      font: "system", radius: [16, 10, 6],
    },
    "deep-forest": {
      pal: derivePalette({ bg: "#0e1410", elevated: "#152018", elevatedHover: "#1e2f22", muted: "#a3bda9", muted2: "#68806e", accent: "#4c9a5f", accentHover: "#63b877", gradTop: "#1b3a24", scrollbar: "#2a4531", black: "#070b08" }),
      font: "serif", radius: [10, 8, 5],
    },
    custom: { pal: null, font: "inter", radius: [12, 8, 4] }, // aus localStorage
  };

  const ACCENT_VARS = ["--sp-green", "--sp-green-hover"];
  const ALL_VARS = Object.keys(THEMES["spotify-green"].pal).concat("--app-font", "--radius-lg", "--radius-md", "--radius-sm");
  const FX_CLASSES = ["fx-scanlines", "fx-vaporwave", "fx-sunsetbg", "fx-glowpulse", "fx-custom-anim"];

  /* ===== Aspekte (Rechtsklick-Schalter) ===== */
  const ASPECTS = [
    ["colors", "Farben"],
    ["accent", "Akzentfarbe"],
    ["font", "Schriftart"],
    ["radius", "Ecken-Radius"],
    ["effects", "Effekte / Hintergrund"],
  ];
  function loadAspects(theme) {
    try {
      const all = JSON.parse(localStorage.getItem(ASPECTS_KEY) || "{}");
      return Object.assign({ colors: true, accent: true, font: true, radius: true, effects: true }, all[theme] || {});
    } catch (_) {
      return { colors: true, accent: true, font: true, radius: true, effects: true };
    }
  }
  function saveAspects(theme, aspects) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(ASPECTS_KEY) || "{}"); } catch (_) {}
    all[theme] = aspects;
    localStorage.setItem(ASPECTS_KEY, JSON.stringify(all));
  }

  /* ===== Custom-Theme laden/ableiten ===== */
  const CUSTOM_DEFAULTS = {
    accent: "#1db954", bg: "#121212", elevated: "#181818",
    text: "#ffffff", muted: "#a7a7a7", font: "inter", radius: 12, animBg: false,
  };
  function loadCustom() {
    try {
      return Object.assign({}, CUSTOM_DEFAULTS, JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}"));
    } catch (_) {
      return Object.assign({}, CUSTOM_DEFAULTS);
    }
  }
  function customPalette(c) {
    return derivePalette({
      bg: c.bg, elevated: c.elevated, muted: c.muted,
      accent: c.accent, text: c.text,
    });
  }

  /* ===== Theme wirklich anwenden ===== */
  function applyFullTheme(name) {
    const theme = THEMES[name] || THEMES["spotify-green"];
    const aspects = loadAspects(name);
    const custom = name === "custom" ? loadCustom() : null;
    const pal = name === "custom" ? customPalette(custom) : theme.pal;

    // Reset: alle verwalteten Inline-Variablen + Effekt-Klassen weg
    ALL_VARS.forEach((v) => root.style.removeProperty(v));
    FX_CLASSES.forEach((c) => document.body.classList.remove(c));

    // data-theme nur behalten, wenn das Theme Attribut-CSS braucht
    // (rgb-wave-Animationen) und Effekte erlaubt sind - player.js hat das
    // Attribut evtl. gerade gesetzt, hier ist die letzte Instanz.
    if (theme.keepAttr && aspects.effects) {
      root.setAttribute("data-theme", name);
    } else {
      root.removeAttribute("data-theme");
    }

    if (aspects.colors) {
      for (const [k, v] of Object.entries(pal)) {
        if (!ACCENT_VARS.includes(k)) root.style.setProperty(k, v);
      }
    }
    if (aspects.accent) {
      ACCENT_VARS.forEach((k) => root.style.setProperty(k, pal[k]));
    }
    if (aspects.font) {
      const fontKey = custom ? custom.font : theme.font;
      root.style.setProperty("--app-font", FONTS[fontKey] || FONTS.inter);
    }
    if (aspects.radius) {
      const [lg, md, sm] = custom
        ? [custom.radius, Math.round(custom.radius * 0.66), Math.round(custom.radius * 0.33)]
        : theme.radius;
      root.style.setProperty("--radius-lg", lg + "px");
      root.style.setProperty("--radius-md", md + "px");
      root.style.setProperty("--radius-sm", sm + "px");
    }
    if (aspects.effects) {
      if (custom && custom.animBg) document.body.classList.add("fx-custom-anim");
      else if (theme.fx) document.body.classList.add(theme.fx);
    }
  }

  function currentTheme() {
    return localStorage.getItem(THEME_KEY) || "spotify-green";
  }

  /* player.js hat seine Klick-Handler schon registriert (setzt data-theme
     + localStorage + active-Klasse) - unser Handler läuft danach und legt
     die erweiterte Anwendung drüber. */
  document.querySelectorAll(".theme-option").forEach((btn) => {
    btn.addEventListener("click", () => applyFullTheme(btn.dataset.theme || "spotify-green"));
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openContextMenu(btn.dataset.theme || "spotify-green", e.clientX, e.clientY);
    });
  });

  /* ===== Rechtsklick-Menü ===== */
  let ctxMenu = null;
  function closeContextMenu() {
    if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
  }
  function openContextMenu(theme, x, y) {
    closeContextMenu();
    const aspects = loadAspects(theme);
    ctxMenu = document.createElement("div");
    ctxMenu.className = "theme-ctx-menu";
    const title = document.createElement("div");
    title.className = "theme-ctx-title";
    title.textContent = "Dieses Theme ändert:";
    ctxMenu.appendChild(title);

    ASPECTS.forEach(([key, label]) => {
      const row = document.createElement("label");
      row.className = "theme-ctx-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!aspects[key];
      cb.addEventListener("change", () => {
        aspects[key] = cb.checked;
        saveAspects(theme, aspects);
        if (currentTheme() === theme) applyFullTheme(theme);
      });
      const span = document.createElement("span");
      span.textContent = label;
      row.append(cb, span);
      ctxMenu.appendChild(row);
    });

    if (theme === "custom") {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "theme-ctx-edit";
      edit.textContent = "✎ Theme bearbeiten …";
      edit.addEventListener("click", () => { closeContextMenu(); openCustomEditor(); });
      ctxMenu.appendChild(edit);
    }

    document.body.appendChild(ctxMenu);
    const rect = ctxMenu.getBoundingClientRect();
    ctxMenu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + "px";
    ctxMenu.style.top = Math.min(y, window.innerHeight - rect.height - 8) + "px";
    setTimeout(() => {
      document.addEventListener("mousedown", function onAway(ev) {
        if (ctxMenu && !ctxMenu.contains(ev.target)) {
          closeContextMenu();
          document.removeEventListener("mousedown", onAway);
        }
      });
    }, 0);
  }

  /* ===== Custom-Theme-Editor ===== */
  const customBtn = document.querySelector('.theme-option[data-theme="custom"]');
  if (customBtn) {
    // Doppelklick oder Klick bei bereits aktivem Custom-Theme öffnet den Editor
    customBtn.addEventListener("dblclick", openCustomEditor);
    customBtn.addEventListener("click", () => {
      if (customBtn.dataset.wasActive === "1") openCustomEditor();
      customBtn.dataset.wasActive = "1";
      document.querySelectorAll('.theme-option:not([data-theme="custom"])').forEach((b) => {
        b.addEventListener("click", () => { customBtn.dataset.wasActive = ""; }, { once: true });
      });
    });
  }

  function openCustomEditor() {
    if (document.getElementById("customThemeModal")) return;
    const c = loadCustom();
    const overlay = document.createElement("div");
    overlay.id = "customThemeModal";
    overlay.className = "custom-theme-overlay";

    const modal = document.createElement("div");
    modal.className = "custom-theme-modal";
    modal.innerHTML = `
      <div class="custom-theme-header">
        <h3>✎ Eigenes Theme</h3>
        <button type="button" class="custom-theme-close">✕</button>
      </div>
      <div class="custom-theme-body">
        <label class="ct-row"><span>Akzentfarbe</span><input type="color" data-k="accent"></label>
        <label class="ct-row"><span>Hintergrund</span><input type="color" data-k="bg"></label>
        <label class="ct-row"><span>Flächen / Karten</span><input type="color" data-k="elevated"></label>
        <label class="ct-row"><span>Textfarbe</span><input type="color" data-k="text"></label>
        <label class="ct-row"><span>Nebentext</span><input type="color" data-k="muted"></label>
        <label class="ct-row"><span>Schriftart</span>
          <select data-k="font">
            <option value="inter">Standard (Inter)</option>
            <option value="system">System</option>
            <option value="serif">Serifen (elegant)</option>
            <option value="mono">Monospace (Terminal)</option>
            <option value="rounded">Weich / Rund</option>
          </select>
        </label>
        <label class="ct-row"><span>Ecken-Radius <b class="ct-radius-val"></b></span>
          <input type="range" min="0" max="24" step="1" data-k="radius">
        </label>
        <label class="ct-row ct-check"><input type="checkbox" data-k="animBg"><span>Animierter Farbverlauf im Hintergrund</span></label>
      </div>
      <div class="custom-theme-footer">
        <button type="button" class="ct-reset">Zurücksetzen</button>
        <button type="button" class="ct-save">Speichern</button>
      </div>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const inputs = modal.querySelectorAll("[data-k]");
    const radiusVal = modal.querySelector(".ct-radius-val");
    function fill(values) {
      inputs.forEach((inp) => {
        const k = inp.dataset.k;
        if (inp.type === "checkbox") inp.checked = !!values[k];
        else inp.value = values[k];
      });
      radiusVal.textContent = values.radius + "px";
    }
    fill(c);

    function collect() {
      const out = {};
      inputs.forEach((inp) => {
        const k = inp.dataset.k;
        out[k] = inp.type === "checkbox" ? inp.checked : inp.type === "range" ? Number(inp.value) : inp.value;
      });
      return out;
    }
    // Live-Vorschau bei jeder Änderung
    inputs.forEach((inp) => {
      inp.addEventListener("input", () => {
        const vals = collect();
        radiusVal.textContent = vals.radius + "px";
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(vals));
        activateCustom();
      });
    });

    function close() { overlay.remove(); }
    modal.querySelector(".custom-theme-close").addEventListener("click", () => {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(c)); // Abbruch = alter Stand
      if (currentTheme() === "custom") applyFullTheme("custom");
      close();
    });
    modal.querySelector(".ct-save").addEventListener("click", () => {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(collect()));
      activateCustom();
      close();
    });
    modal.querySelector(".ct-reset").addEventListener("click", () => {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(CUSTOM_DEFAULTS));
      fill(Object.assign({}, CUSTOM_DEFAULTS));
      activateCustom();
    });
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  }

  function activateCustom() {
    localStorage.setItem(THEME_KEY, "custom");
    document.querySelectorAll(".theme-option").forEach((b) => {
      b.classList.toggle("active", b.dataset.theme === "custom");
    });
    applyFullTheme("custom");
  }

  /* ===== Initial anwenden (player.js hat sein applyTheme schon gemacht) ===== */
  applyFullTheme(currentTheme());
})();
