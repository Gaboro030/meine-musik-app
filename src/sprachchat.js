/* ===== Musik an den Sprachchat weitergeben (Desktop) =====

   Zweck: Freunde, die einen im Sprachchat hoeren (Discord, TeamSpeak,
   Teamspeak-artige Programme), sollen die Musik mithoeren koennen.

   Warum das so und nicht direkter geht: Windows laesst keine Anwendung
   sich als Mikrofon ausgeben - dafuer braucht es einen Audiotreiber, und
   den kann eine App nicht ersetzen. Der uebliche Weg ist deshalb ein
   virtuelles Kabel (VB-Cable und Verwandte): das meldet sich beim System
   als Ausgabegeraet UND als Aufnahmegeraet an. Wir schicken die Musik an
   dessen Ausgabeseite, der Sprachchat nimmt die Aufnahmeseite als Mikrofon.

   Diese Datei baut dafuer einen ZWEITEN Ausgang: an masterGain (Ende der
   Kette in player.js, hinter Equalizer und Normalisierung) haengt
   zusaetzlich eine eigene Lautstaerke und ein MediaStreamDestination. Der
   daraus entstehende Strom laeuft ueber ein verstecktes <audio>, dessen
   Ausgabegeraet per setSinkId auf das gewaehlte Geraet gelegt wird.

   Der normale Weg zu den Kopfhoerern bleibt voellig unberuehrt - beide
   Ausgaenge haengen parallel am selben Punkt. Deshalb hoert man selbst
   weiter genau das, was man vorher gehoert hat, und die Lautstaerke fuer
   den Sprachchat ist davon unabhaengig regelbar (in der Regel deutlich
   leiser, sonst redet man gegen die eigene Musik an). */
(function () {
  "use strict";

  const AN_KEY = "voiceShareEnabled";
  const GERAET_KEY = "voiceShareDeviceId";
  const LAUTSTAERKE_KEY = "voiceShareVolume";

  // i18n.js haengt t() an window; ist die Sprache Deutsch (oder das Modul
  // noch nicht geladen), bleibt der Text schlicht wie er ist.
  const uebersetzt = (text) => (window.t ? window.t(text) : text);

  const schalter = document.getElementById("voiceShareToggleSwitch");
  const auswahl = document.getElementById("voiceShareDeviceSelect");
  const regler = document.getElementById("voiceShareVolumeSlider");
  const anzeige = document.getElementById("voiceShareVolumeReadout");
  if (!schalter || !auswahl || !regler) return;

  // Android hat weder ein virtuelles Kabel noch setSinkId. Die Zeilen
  // bleiben dort einfach unbedienbar, statt eine Funktion vorzugaukeln,
  // die nicht existiert.
  const moeglich =
    typeof Audio !== "undefined" &&
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.enumerateDevices === "function";

  let an = localStorage.getItem(AN_KEY) === "1";
  let geraetId = localStorage.getItem(GERAET_KEY) || "";
  // Erst auf "noch nie gespeichert" pruefen, DANN umwandeln: Number(null)
  // ist 0, und 0 liegt im erlaubten Bereich - beim allerersten Start
  // stuende der Regler damit auf stumm, und die Weitergabe waere
  // eingeschaltet, ohne dass drueben etwas ankommt.
  const gespeicherteLautstaerke = localStorage.getItem(LAUTSTAERKE_KEY);
  let lautstaerke = gespeicherteLautstaerke === null ? 35 : Number(gespeicherteLautstaerke);
  if (!Number.isFinite(lautstaerke) || lautstaerke < 0 || lautstaerke > 100) lautstaerke = 35;

  let zweigGain = null; // eigene Lautstaerke fuer diesen Ausgang
  let zweigZiel = null; // MediaStreamDestination
  let zweigAudio = null; // verstecktes <audio>, das auf dem Zielgeraet spielt
  let warteAufGraph = null;

  function reglerAnzeigen() {
    if (anzeige) anzeige.textContent = `${lautstaerke}%`;
  }

  function schalterAnzeigen() {
    schalter.classList.toggle("active", an);
    schalter.setAttribute("aria-checked", an ? "true" : "false");
    auswahl.disabled = !an || !moeglich;
    regler.disabled = !an || !moeglich;
  }

  /* Geraetenamen gibt der Browser erst preis, wenn einmal eine
     Audio-Berechtigung erteilt wurde - ohne die heissen alle Eintraege
     schlicht "" und sind nicht auseinanderzuhalten. Deshalb einmal kurz
     ein Aufnahmegeraet oeffnen und sofort wieder schliessen; aufgenommen
     wird dabei nichts, der Strom wird noch in derselben Funktion
     gestoppt. Schlaegt es fehl (Berechtigung abgelehnt), geht es mit
     Ersatznamen weiter statt gar nicht. */
  async function namenFreischalten() {
    try {
      const strom = await navigator.mediaDevices.getUserMedia({ audio: true });
      strom.getTracks().forEach((t) => t.stop());
    } catch (_) {
      /* ohne Namen weitermachen */
    }
  }

  async function geraeteLaden() {
    if (!moeglich) return;
    let liste = [];
    try {
      liste = await navigator.mediaDevices.enumerateDevices();
    } catch (_) {
      return;
    }
    const ausgaenge = liste.filter((g) => g.kind === "audiooutput");
    auswahl.innerHTML = "";

    const leer = document.createElement("option");
    leer.value = "";
    leer.textContent = ausgaenge.length ? "– bitte wählen –" : "Kein Gerät gefunden";
    auswahl.appendChild(leer);

    ausgaenge.forEach((g, i) => {
      const opt = document.createElement("option");
      opt.value = g.deviceId;
      opt.textContent = g.label || `Ausgabegerät ${i + 1}`;
      auswahl.appendChild(opt);
    });

    // Das gemerkte Geraet kann verschwunden sein (Kabel abgezogen, VB-Cable
    // deinstalliert). Dann bleibt die Auswahl leer statt auf einen
    // Eintrag zu zeigen, den es nicht mehr gibt.
    auswahl.value = ausgaenge.some((g) => g.deviceId === geraetId) ? geraetId : "";
    if (auswahl.value !== geraetId) {
      geraetId = auswahl.value;
      localStorage.setItem(GERAET_KEY, geraetId);
    }
  }

  /* Der Audiograph in player.js entsteht erst beim ersten Abspielen (ein
     AudioContext darf ohne Nutzergeste nicht starten) - vorher gibt es
     kein masterGain, an das sich etwas haengen liesse. Deshalb hier
     warten, bis er steht, statt einmalig zu scheitern. */
  function graphBereit() {
    return typeof audioGraphReady !== "undefined" && audioGraphReady &&
      typeof masterGain !== "undefined" && masterGain &&
      typeof audioCtx !== "undefined" && audioCtx;
  }

  function abzweigAufbauen() {
    if (zweigZiel || !graphBereit()) return false;
    zweigGain = audioCtx.createGain();
    zweigGain.gain.value = lautstaerke / 100;
    zweigZiel = audioCtx.createMediaStreamDestination();
    masterGain.connect(zweigGain).connect(zweigZiel);

    zweigAudio = new Audio();
    zweigAudio.srcObject = zweigZiel.stream;
    zweigAudio.autoplay = true;
    // Die eigene Lautstaerke steckt schon in zweigGain; hier auf 1 lassen,
    // sonst multipliziert sich beides.
    zweigAudio.volume = 1;
    return true;
  }

  async function zielSetzen() {
    if (!zweigAudio) return;
    if (!geraetId) {
      zweigAudio.pause();
      return;
    }
    try {
      await zweigAudio.setSinkId(geraetId);
      await zweigAudio.play();
    } catch (e) {
      // Haeufigster Fall: das Geraet ist weg (Kabel deinstalliert/abgezogen).
      if (typeof showToast === "function") {
        showToast(uebersetzt("Zielgerät für den Sprachchat lässt sich nicht öffnen. Ist es noch angeschlossen?"));
      }
    }
  }

  function anwenden() {
    if (!moeglich) return;
    if (!an || !geraetId) {
      // Verbindung wirklich kappen statt nur stummschalten: ein weiter
      // mitlaufender Strom haelt das Geraet sonst dauerhaft geoeffnet.
      if (zweigAudio) zweigAudio.pause();
      if (zweigGain) zweigGain.gain.value = 0;
      return;
    }
    if (!abzweigAufbauen() && !zweigZiel) {
      // Graph noch nicht da - erneut versuchen, sobald etwas laeuft.
      if (!warteAufGraph) {
        warteAufGraph = setInterval(() => {
          if (!an || !geraetId) return;
          if (abzweigAufbauen()) {
            clearInterval(warteAufGraph);
            warteAufGraph = null;
            zielSetzen();
          }
        }, 500);
      }
      return;
    }
    if (zweigGain) zweigGain.gain.value = lautstaerke / 100;
    zielSetzen();
  }

  schalter.addEventListener("click", async () => {
    if (!moeglich) {
      if (typeof showToast === "function") {
        showToast(uebersetzt("Das geht nur am PC - Android kennt keine zweiten Ausgabegeräte."));
      }
      return;
    }
    an = !an;
    localStorage.setItem(AN_KEY, an ? "1" : "0");
    schalterAnzeigen();
    if (an) {
      await namenFreischalten();
      await geraeteLaden();
      schalterAnzeigen();
    }
    anwenden();
  });

  auswahl.addEventListener("change", () => {
    geraetId = auswahl.value;
    localStorage.setItem(GERAET_KEY, geraetId);
    anwenden();
  });

  regler.addEventListener("input", () => {
    lautstaerke = Number(regler.value);
    localStorage.setItem(LAUTSTAERKE_KEY, String(lautstaerke));
    reglerAnzeigen();
    if (zweigGain) zweigGain.gain.value = lautstaerke / 100;
  });

  // Ein neu eingestecktes Kabel taucht ohne das nicht in der Liste auf.
  if (moeglich && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      if (an) geraeteLaden().then(anwenden);
    });
  }

  regler.value = String(lautstaerke);
  reglerAnzeigen();
  schalterAnzeigen();
  if (an && moeglich) {
    geraeteLaden().then(() => {
      schalterAnzeigen();
      anwenden();
    });
  }
})();
