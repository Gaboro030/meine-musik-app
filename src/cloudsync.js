/* ===== Playlist-Abgleich: Anmeldung (Etappe 1) =====

   Die eigentliche Anmeldung laeuft in Rust (cloudauth.rs) - hier stehen
   nur die Client-Kennungen, die Knoepfe und die Anzeige, wer angemeldet
   ist.

   Warum die Kennungen im normalen Speicher liegen duerfen und die Token
   nicht: eine Client-ID ist oeffentlich, sie steht bei jeder Web-Anmeldung
   in der Adresszeile. Die Token dagegen liegen ausschliesslich auf der
   Rust-Seite im App-Datenverzeichnis und kommen nie ins Frontend - dieses
   Modul erfaehrt nur "angemeldet: ja/nein". */
(function () {
  "use strict";
  if (!window.__TAURI__) return;
  const { invoke } = window.__TAURI__.core;

  const uebersetzt = (text) => (window.t ? window.t(text) : text);

  const DIENSTE = [
    {
      name: "spotify",
      label: "Spotify",
      speicher: "spotifyClientId",
      eingabe: document.getElementById("spotifyClientIdInput"),
      knopf: document.getElementById("spotifyAuthBtn"),
      status: document.getElementById("spotifyAuthStatus"),
    },
    {
      name: "google",
      label: "Google",
      speicher: "googleClientId",
      eingabe: document.getElementById("googleClientIdInput"),
      // Bewusst nicht im localStorage: der landet im Einstellungs-Backup.
      // Rust legt ihn beim Anmelden zum Token.
      geheim: document.getElementById("googleClientSecretInput"),
      knopf: document.getElementById("googleAuthBtn"),
      status: document.getElementById("googleAuthStatus"),
    },
  ].filter((d) => d.eingabe && d.knopf && d.status);

  if (!DIENSTE.length) return;

  let angemeldet = {};

  function anzeigen() {
    DIENSTE.forEach((d) => {
      const an = !!angemeldet[d.name];
      const geheimFehlt = !!d.geheim && !d.geheim.value.trim();
      d.status.textContent = an
        ? uebersetzt("✅ Angemeldet.")
        : !d.eingabe.value.trim()
          ? uebersetzt("Client-ID fehlt noch.")
          : geheimFehlt
            ? uebersetzt("Clientschlüssel fehlt noch.")
            : uebersetzt("Noch nicht angemeldet.");
      d.knopf.textContent = an
        ? uebersetzt("Abmelden")
        : uebersetzt("Anmelden");
      d.knopf.disabled = !an && (!d.eingabe.value.trim() || geheimFehlt);
    });
  }

  async function statusHolen() {
    try {
      angemeldet = (await invoke("cloud_status")) || {};
    } catch (_) {
      angemeldet = {};
    }
    anzeigen();
    ytListeZeigen();
  }

  /* ===== YouTube Music: automatischer Abgleich (Etappe 5) =====
     Die Arbeit macht youtube_abgleich (youtubesync.rs) - hier nur, WELCHE
     Playlists abgeglichen werden und WANN: beim Start, alle 10 Minuten
     und kurz nachdem sich in der Bibliothek etwas geaendert hat. */
  const YT_KEY = "ytSyncPlaylists";
  const ytRow = document.getElementById("ytSyncRow");
  const ytList = document.getElementById("ytSyncList");
  const ytStatus = document.getElementById("ytSyncStatus");
  const ytNow = document.getElementById("ytSyncNowBtn");
  let ytAuswahl = [];
  try {
    ytAuswahl = JSON.parse(localStorage.getItem(YT_KEY) || "[]");
  } catch (_) {}
  let ytLaeuft = false;
  let ytFernNamen = null; // Kostet Kontingent - einmal holen reicht
  const googleId = () => (localStorage.getItem("googleClientId") || "").trim();
  const mitWerten = (text, werte) => (window.t ? window.t(text, werte) : text);

  function ytSchalter(name) {
    const zeile = document.createElement("div");
    zeile.className = "yt-sync-item";
    const text = document.createElement("span");
    text.textContent = name;
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "toggle-switch";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-label", name);
    const setzen = (an) => {
      sw.classList.toggle("active", an);
      sw.setAttribute("aria-checked", String(an));
    };
    setzen(ytAuswahl.includes(name));
    sw.addEventListener("click", () => {
      const an = !ytAuswahl.includes(name);
      ytAuswahl = an ? [...ytAuswahl, name] : ytAuswahl.filter((n) => n !== name);
      localStorage.setItem(YT_KEY, JSON.stringify(ytAuswahl));
      setzen(an);
      // Ausgeschaltet = vergessen. Beim Wiedereinschalten wird neu
      // verknuepft statt Altes als "geloescht" zu werten.
      if (an) ytAbgleichen(true);
      else invoke("sync_zustand_loeschen", { dienst: "google", playlist: name }).catch(() => {});
    });
    zeile.append(text, sw);
    return zeile;
  }

  async function ytListeZeigen() {
    if (!ytRow) return;
    // .settings-row setzt display:flex und schlaegt damit [hidden].
    ytRow.style.display = angemeldet.google ? "" : "none";
    if (!angemeldet.google) return;
    const namen = new Set(ytAuswahl);
    try {
      (await invoke("list_playlists")).forEach((p) => namen.add(p.name));
    } catch (_) {}
    if (!ytFernNamen) {
      try {
        ytFernNamen = (await invoke("youtube_playlists", { clientId: googleId() })).map((p) => p.name);
      } catch (_) {}
    }
    (ytFernNamen || []).forEach((n) => namen.add(n));
    ytList.replaceChildren(...[...namen].sort((a, b) => a.localeCompare(b)).map(ytSchalter));
  }

  async function ytAbgleichen(manuell) {
    if (ytLaeuft || !angemeldet.google || !googleId()) return;
    if (!ytAuswahl.length) {
      if (manuell) ytStatus.textContent = uebersetzt("Schalte zuerst mindestens eine Playlist ein.");
      return;
    }
    ytLaeuft = true;
    if (ytNow) ytNow.disabled = true;
    ytStatus.textContent = uebersetzt("Gleiche ab …");
    const summe = { eingetragen: 0, ausgetragen: 0, geladen: 0, papierkorb: 0, nicht: 0 };
    const fehler = [];
    for (const playlist of [...ytAuswahl]) {
      // Waehrend des Durchgangs umbenannt oder ausgeschaltet.
      if (!ytAuswahl.includes(playlist)) continue;
      try {
        const e = await invoke("youtube_abgleich", { clientId: googleId(), playlist });
        ["eingetragen", "ausgetragen", "geladen", "papierkorb"].forEach((k) => (summe[k] += e[k]));
        summe.nicht += e.nicht_gefunden.length;
        fehler.push(...e.fehler);
      } catch (err) {
        fehler.push(String(err));
      }
    }
    if ((summe.geladen || summe.papierkorb) && typeof refreshLibrary === "function") await refreshLibrary();
    ytLaeuft = false;
    if (ytNow) ytNow.disabled = false;

    const zeit = new Date().toLocaleTimeString(document.documentElement.lang || "de", { hour: "2-digit", minute: "2-digit" });
    let zeile = mitWerten("Zuletzt abgeglichen um {zeit}: {geladen} geladen, {eingetragen} eingetragen, {entfernt} entfernt.", {
      zeit,
      geladen: summe.geladen,
      eingetragen: summe.eingetragen,
      entfernt: summe.ausgetragen + summe.papierkorb,
    });
    if (summe.nicht) zeile += " " + mitWerten("{n} bei YouTube Music nicht gefunden.", { n: summe.nicht });
    if (fehler.length) zeile += " " + fehler[0];
    ytStatus.textContent = zeile;
    if (manuell && fehler.length && typeof showToast === "function") showToast(fehler[0]);
  }

  // Umbenannt oder geloescht (newName null): sonst liefe der Abgleich unter
  // dem alten Namen weiter und holte alles als "neu" zurueck. Den Stand in
  // sync_state.json zieht rename_playlist/delete_playlist selbst nach.
  document.addEventListener("reson-playlist-renamed", (e) => {
    const { oldName, newName } = e.detail;
    if (!ytAuswahl.includes(oldName)) return;
    ytAuswahl = ytAuswahl.filter((n) => n !== oldName);
    if (newName) ytAuswahl.push(newName);
    localStorage.setItem(YT_KEY, JSON.stringify(ytAuswahl));
    ytListeZeigen();
  });

  if (ytNow) ytNow.addEventListener("click", () => ytAbgleichen(true));
  setTimeout(() => ytAbgleichen(false), 15000);
  setInterval(() => ytAbgleichen(false), 10 * 60 * 1000);
  // Lokale Aenderung (Song geladen/geloescht) bald drueben nachziehen.
  // Der eigene refreshLibrary() oben laeuft noch mit ytLaeuft = true und
  // loest deshalb keinen weiteren Durchgang aus.
  let ytBald = 0;
  document.addEventListener("reson-library-changed", () => {
    ytListeZeigen(); // neue Playlist soll ohne Neustart schaltbar sein
    if (ytLaeuft) return;
    clearTimeout(ytBald);
    ytBald = setTimeout(() => ytAbgleichen(false), 30000);
  });

  DIENSTE.forEach((d) => {
    d.eingabe.value = localStorage.getItem(d.speicher) || "";
    if (d.geheim) d.geheim.addEventListener("input", anzeigen);
    d.eingabe.addEventListener("input", () => {
      localStorage.setItem(d.speicher, d.eingabe.value.trim());
      anzeigen();
    });

    d.knopf.addEventListener("click", async () => {
      if (angemeldet[d.name]) {
        try {
          await invoke("cloud_logout", { dienst: d.name });
        } catch (e) {
          if (typeof showToast === "function") showToast(String(e));
        }
        await statusHolen();
        return;
      }

      const clientId = d.eingabe.value.trim();
      if (!clientId) return;

      // Der Aufruf kehrt erst zurueck, wenn der Nutzer im Browser fertig
      // ist - das kann eine Weile dauern, deshalb der Hinweis und der
      // gesperrte Knopf statt eines scheinbar toten Fensters.
      d.knopf.disabled = true;
      d.status.textContent = uebersetzt(
        "Im Browser anmelden … dieses Fenster offen lassen."
      );
      try {
        await invoke("cloud_login", {
          dienst: d.name,
          clientId,
          clientSecret: d.geheim ? d.geheim.value.trim() : null,
        });
        if (d.geheim) d.geheim.value = "";
        if (typeof showToast === "function") {
          showToast(uebersetzt("Bei {dienst} angemeldet.").replace("{dienst}", d.label));
        }
      } catch (e) {
        if (typeof showToast === "function") showToast(String(e));
      }
      await statusHolen();
    });
  });

  document.addEventListener("i18n-changed", anzeigen);
  statusHolen();
})();
