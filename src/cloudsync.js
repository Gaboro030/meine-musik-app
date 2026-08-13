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
      knopf: document.getElementById("googleAuthBtn"),
      status: document.getElementById("googleAuthStatus"),
    },
  ].filter((d) => d.eingabe && d.knopf && d.status);

  if (!DIENSTE.length) return;

  let angemeldet = {};

  function anzeigen() {
    DIENSTE.forEach((d) => {
      const an = !!angemeldet[d.name];
      d.status.textContent = an
        ? uebersetzt("✅ Angemeldet.")
        : d.eingabe.value.trim()
          ? uebersetzt("Noch nicht angemeldet.")
          : uebersetzt("Client-ID fehlt noch.");
      d.knopf.textContent = an
        ? uebersetzt("Abmelden")
        : uebersetzt("Anmelden");
      d.knopf.disabled = !an && !d.eingabe.value.trim();
    });
  }

  async function statusHolen() {
    try {
      angemeldet = (await invoke("cloud_status")) || {};
    } catch (_) {
      angemeldet = {};
    }
    anzeigen();
  }

  DIENSTE.forEach((d) => {
    d.eingabe.value = localStorage.getItem(d.speicher) || "";
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
        await invoke("cloud_login", { dienst: d.name, clientId });
        if (typeof showToast === "function") {
          showToast(uebersetzt("Bei {dienst} angemeldet.").replace("{dienst}", d.label));
        }
      } catch (e) {
        if (typeof showToast === "function") showToast(String(e));
      }
      await statusHolen();
    });
  });

  statusHolen();
})();
