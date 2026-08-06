/* ===== Musik (und Stimme) an den Sprachchat weitergeben - Desktop =====

   Ziel: Freunde in Discord, WhatsApp, TeamSpeak oder einem Spiel sollen
   die Musik mithoeren - und einen dabei weiter reden hoeren.

   Warum ein virtuelles Kabel unvermeidlich ist: Windows laesst keine
   Anwendung sich als Mikrofon anmelden. Welche Mikrofone es gibt,
   entscheidet das Betriebssystem, und dort etwas Neues einzutragen ist
   Treiberarbeit - kein Programm kann das umgehen, auch kein Soundboard.
   Alle diese Programme (Voicemod, Soundpad und Verwandte) installieren
   genau dafuer einen Treiber. Ein virtuelles Kabel wie VB-Cable meldet
   sich beim System gleichzeitig als Ausgabe- UND als Aufnahmegeraet an;
   was man in seine Ausgabeseite schickt, kommt auf der Aufnahmeseite
   wieder heraus und ist damit fuer jedes andere Programm ein Mikrofon.

   Was diese Datei uebernimmt, ist der Teil danach - und der spart die
   ZWEITE Installation: das Mischen. Ueblicherweise braucht man dafuer
   noch ein Mischprogramm (VoiceMeeter), weil ein Kabel allein nur eine
   Quelle durchreicht und die eigene Stimme sonst verloren geht. Hier
   passiert das Mischen in der App:

       Musik (hinter EQ/Normalisierung) --> Musik-Lautstaerke --\
                                                                 >-- Kabel
       Mikrofon (getUserMedia) ----------> Stimm-Lautstaerke ---/

   Beides landet in einem MediaStreamDestination, dessen Strom ueber ein
   verstecktes <audio> laeuft; setSinkId legt dessen Ausgabegeraet auf das
   Kabel. Im Sprachchat waehlt man einmal die Aufnahmeseite des Kabels als
   Mikrofon - danach gilt das fuer jedes Programm gleichermassen.

   Der eigene Kopfhoerer-Weg bleibt voellig unberuehrt: der Abzweig haengt
   parallel an derselben Stelle. Man hoert also weiter genau das, was man
   vorher gehoert hat, und beide Lautstaerken hier haben damit nichts zu
   tun - sie gelten nur fuer das, was drueben ankommt. */
(function () {
  "use strict";

  const AN_KEY = "voiceShareEnabled";
  const GERAET_KEY = "voiceShareDeviceId";
  const LAUTSTAERKE_KEY = "voiceShareVolume";
  const MIKRO_AN_KEY = "voiceShareMicEnabled";
  const MIKRO_KEY = "voiceShareMicId";
  const MIKRO_LAUTSTAERKE_KEY = "voiceShareMicVolume";

  // i18n.js haengt t() an window; ist die Sprache Deutsch (oder das Modul
  // noch nicht geladen), bleibt der Text schlicht wie er ist.
  const uebersetzt = (text) => (window.t ? window.t(text) : text);

  const schalter = document.getElementById("voiceShareToggleSwitch");
  const auswahl = document.getElementById("voiceShareDeviceSelect");
  const regler = document.getElementById("voiceShareVolumeSlider");
  const anzeige = document.getElementById("voiceShareVolumeReadout");
  const mikroSchalter = document.getElementById("voiceShareMicToggleSwitch");
  const mikroAuswahl = document.getElementById("voiceShareMicSelect");
  const mikroRegler = document.getElementById("voiceShareMicVolumeSlider");
  const mikroAnzeige = document.getElementById("voiceShareMicVolumeReadout");
  const hinweis = document.getElementById("voiceShareHint");
  const kabelKnopf = document.getElementById("voiceShareCableBtn");
  if (kabelKnopf) {
    // Erspart die Suche nach der richtigen Seite - der Name "VB-Cable"
    // fuehrt in einer Suchmaschine auch zu einem Haufen Weiterverteiler
    // mit fragwuerdigen Installern.
    kabelKnopf.addEventListener("click", () => {
      window.open("https://vb-audio.com/Cable/", "_blank", "noopener");
    });
  }
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

  function zahlAusSpeicher(schluessel, standard, min, max) {
    // Erst auf "noch nie gespeichert" pruefen, DANN umwandeln: Number(null)
    // ist 0, und 0 liegt in jedem dieser Bereiche - beim allerersten Start
    // stuenden die Regler damit auf stumm.
    const roh = localStorage.getItem(schluessel);
    const wert = roh === null ? standard : Number(roh);
    if (!Number.isFinite(wert) || wert < min || wert > max) return standard;
    return wert;
  }

  let an = localStorage.getItem(AN_KEY) === "1";
  let geraetId = localStorage.getItem(GERAET_KEY) || "";
  let lautstaerke = zahlAusSpeicher(LAUTSTAERKE_KEY, 35, 0, 100);
  // Standardmaessig an: ohne die Stimme hoeren die Freunde nur noch Musik
  // und einen selbst gar nicht mehr - das ist fast nie gewollt.
  let mikroAn = localStorage.getItem(MIKRO_AN_KEY) !== "0";
  let mikroId = localStorage.getItem(MIKRO_KEY) || "";
  let mikroLautstaerke = zahlAusSpeicher(MIKRO_LAUTSTAERKE_KEY, 100, 0, 200);

  let musikGain = null;
  let zweigZiel = null; // MediaStreamDestination - hier laeuft alles zusammen
  let zweigAudio = null; // verstecktes <audio>, spielt auf dem Zielgeraet
  let mikroGain = null;
  let mikroQuelle = null;
  let mikroStrom = null;
  let warteAufGraph = null;

  /* --- Anzeige ---------------------------------------------------------- */

  function reglerAnzeigen() {
    if (anzeige) anzeige.textContent = `${lautstaerke}%`;
    if (mikroAnzeige) mikroAnzeige.textContent = `${mikroLautstaerke}%`;
  }

  function schalterAnzeigen() {
    schalter.classList.toggle("active", an);
    schalter.setAttribute("aria-checked", an ? "true" : "false");
    auswahl.disabled = !an || !moeglich;
    regler.disabled = !an || !moeglich;
    if (mikroSchalter) {
      mikroSchalter.classList.toggle("active", mikroAn);
      mikroSchalter.setAttribute("aria-checked", mikroAn ? "true" : "false");
    }
    if (mikroAuswahl) mikroAuswahl.disabled = !an || !mikroAn || !moeglich;
    if (mikroRegler) mikroRegler.disabled = !an || !mikroAn || !moeglich;
  }

  /* Ein virtuelles Kabel erkennt man am Namen - die gaengigen heissen alle
     irgendwas mit "cable", "virtual" oder "voicemeeter". Das ist keine
     exakte Wissenschaft, aber es reicht, um zu sagen "da ist offenbar
     keines installiert" statt den Nutzer raten zu lassen, warum in
     Discord nichts ankommt.

     "reson" steht mit in der Liste, weil Windows das Umbenennen von
     Audiogeraeten erlaubt: wer sein Kabel in "Reson Mikro" umbenannt hat
     (siehe Hinweis unten), soll es hier trotzdem wiederfinden. */
  function istKabel(name) {
    const n = (name || "").toLowerCase();
    return (
      n.includes("cable") ||
      n.includes("voicemeeter") ||
      n.includes("virtual") ||
      n.includes("reson")
    );
  }

  function hinweisSetzen(text) {
    if (hinweis) hinweis.textContent = text;
  }

  /* --- Geraete ---------------------------------------------------------- */

  /* Geraetenamen gibt der Browser erst preis, wenn einmal eine
     Audio-Berechtigung erteilt wurde - ohne die heissen alle Eintraege
     schlicht "" und sind nicht auseinanderzuhalten. Der Zugriff wird hier
     ohnehin gebraucht (fuers Mikrofon), also einmal anfragen. Wird er
     abgelehnt, geht es mit Ersatznamen weiter statt gar nicht. */
  async function berechtigungHolen() {
    try {
      const strom = await navigator.mediaDevices.getUserMedia({ audio: true });
      strom.getTracks().forEach((t) => t.stop());
      return true;
    } catch (_) {
      return false;
    }
  }

  function listeFuellen(select, geraete, leerText) {
    select.innerHTML = "";
    const leer = document.createElement("option");
    leer.value = "";
    leer.textContent = geraete.length ? leerText : uebersetzt("Kein Gerät gefunden");
    select.appendChild(leer);
    geraete.forEach((g, i) => {
      const opt = document.createElement("option");
      opt.value = g.deviceId;
      opt.textContent = g.label || `${leerText} ${i + 1}`;
      select.appendChild(opt);
    });
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
    const eingaenge = liste.filter((g) => g.kind === "audioinput");

    listeFuellen(auswahl, ausgaenge, uebersetzt("– bitte wählen –"));
    if (mikroAuswahl) listeFuellen(mikroAuswahl, eingaenge, uebersetzt("– Standardmikrofon –"));

    // Ein gemerktes Geraet kann verschwunden sein (Kabel abgezogen,
    // VB-Cable deinstalliert). Dann bleibt die Auswahl leer statt auf
    // einen Eintrag zu zeigen, den es nicht mehr gibt.
    auswahl.value = ausgaenge.some((g) => g.deviceId === geraetId) ? geraetId : "";
    if (auswahl.value !== geraetId) {
      geraetId = auswahl.value;
      localStorage.setItem(GERAET_KEY, geraetId);
    }
    if (mikroAuswahl) {
      mikroAuswahl.value = eingaenge.some((g) => g.deviceId === mikroId) ? mikroId : "";
      if (mikroAuswahl.value !== mikroId) {
        mikroId = mikroAuswahl.value;
        localStorage.setItem(MIKRO_KEY, mikroId);
      }
    }

    // Noch kein Ziel gewaehlt, aber ein Kabel liegt bereit: gleich
    // vorschlagen. Das ist in praktisch allen Faellen das Richtige und
    // erspart die Suche in einer Liste voller kryptischer Geraetenamen.
    if (!geraetId) {
      const kabel = ausgaenge.find((g) => istKabel(g.label));
      if (kabel) {
        geraetId = kabel.deviceId;
        auswahl.value = kabel.deviceId;
        localStorage.setItem(GERAET_KEY, geraetId);
      }
    }

    const kabelDa = ausgaenge.some((g) => istKabel(g.label));
    if (kabelKnopf) kabelKnopf.style.display = kabelDa ? "none" : "";
    if (!kabelDa) {
      hinweisSetzen(
        uebersetzt(
          "⚠ Schritt 1 fehlt noch: ein virtuelles Kabel. Ohne eines kann keine Anwendung Ton in ein Mikrofon schicken - das ist eine Vorgabe von Windows, kein Umweg, den man sich sparen könnte. Rechts holen, installieren, PC neu starten. Danach stellt sich hier alles von selbst ein."
        )
      );
    } else {
      const ziel = ausgaenge.find((g) => g.deviceId === geraetId);
      const zielName = (ziel && ziel.label) || uebersetzt("dem gewählten Gerät");
      // Ist die Gegenseite schon umbenannt worden, ist der Tipp erledigt -
      // dann nur noch sagen, was einzustellen ist.
      const schonUmbenannt = eingaenge.some((g) => (g.label || "").toLowerCase().includes("reson"));
      const aufnahmeseite =
        eingaenge.find((g) => (g.label || "").toLowerCase().includes("reson")) ||
        eingaenge.find((g) => istKabel(g.label));
      const aufnahmeName = (aufnahmeseite && aufnahmeseite.label) || "CABLE Output";
      hinweisSetzen(
        uebersetzt("Bereit. Stelle in Discord/WhatsApp/im Spiel als Mikrofon „{mikro}“ ein.").replace(
          "{mikro}",
          aufnahmeName
        ) +
          (schonUmbenannt
            ? ""
            : " " +
              uebersetzt(
                "Tipp: Windows lässt dich Geräte umbenennen - unter Einstellungen › System › Sound › Weitere Soundeinstellungen kannst du „{mikro}“ in „Reson Mikro“ umbenennen. Dann steht in Discord und in jedem Spiel genau das in der Mikrofonliste."
              ).replace("{mikro}", aufnahmeName)) +
          ` (${uebersetzt("Ziel gerade")}: ${zielName})`
      );
    }
  }

  /* --- Audioweg --------------------------------------------------------- */

  /* Der Audiograph in player.js entsteht erst beim ersten Abspielen (ein
     AudioContext darf ohne Nutzergeste nicht starten) - vorher gibt es
     kein masterGain, an das sich etwas haengen liesse. Deshalb hier
     warten, bis er steht, statt einmalig zu scheitern. */
  function graphBereit() {
    return (
      typeof audioGraphReady !== "undefined" &&
      audioGraphReady &&
      typeof masterGain !== "undefined" &&
      masterGain &&
      typeof audioCtx !== "undefined" &&
      audioCtx
    );
  }

  function abzweigAufbauen() {
    if (zweigZiel || !graphBereit()) return false;
    musikGain = audioCtx.createGain();
    musikGain.gain.value = lautstaerke / 100;
    zweigZiel = audioCtx.createMediaStreamDestination();
    masterGain.connect(musikGain).connect(zweigZiel);

    mikroGain = audioCtx.createGain();
    mikroGain.gain.value = mikroLautstaerke / 100;
    mikroGain.connect(zweigZiel);

    zweigAudio = new Audio();
    zweigAudio.srcObject = zweigZiel.stream;
    zweigAudio.autoplay = true;
    // Die Lautstaerken stecken schon in den Gain-Knoten; hier auf 1
    // lassen, sonst multipliziert sich beides.
    zweigAudio.volume = 1;
    return true;
  }

  function mikroSchliessen() {
    if (mikroQuelle) {
      try {
        mikroQuelle.disconnect();
      } catch (_) {
        /* schon getrennt */
      }
      mikroQuelle = null;
    }
    if (mikroStrom) {
      // Wirklich freigeben, nicht nur trennen: sonst bleibt das Mikrofon
      // dauerhaft offen, samt Aufnahme-Symbol im System.
      mikroStrom.getTracks().forEach((t) => t.stop());
      mikroStrom = null;
    }
  }

  async function mikroOeffnen() {
    if (!an || !mikroAn || !zweigZiel) {
      mikroSchliessen();
      return;
    }
    if (mikroStrom) return; // laeuft schon
    try {
      mikroStrom = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Ohne feste Kennung nimmt der Browser das Standardmikrofon -
          // genau das, was "– Standardmikrofon –" verspricht.
          ...(mikroId ? { deviceId: { exact: mikroId } } : {}),
          // Echoausloeschung AN: sie filtert genau das aus dem Mikrofon,
          // was gerade ueber die Lautsprecher laeuft - hier also die
          // eigene Musik. Ohne sie kaeme die Musik ein zweites Mal,
          // zeitversetzt und dumpf, wieder mit rein.
          echoCancellation: true,
          noiseSuppression: true,
          // Automatische Aussteuerung AUS: die zieht in Sprechpausen die
          // Verstaerkung hoch und laesst die Stimme dadurch dauernd im
          // Pegel schwanken. Die Lautstaerke wird hier von Hand geregelt.
          autoGainControl: false,
        },
      });
    } catch (e) {
      mikroStrom = null;
      if (typeof showToast === "function") {
        showToast(uebersetzt("Mikrofon lässt sich nicht öffnen. Ist es angeschlossen und für Reson erlaubt?"));
      }
      return;
    }
    mikroQuelle = audioCtx.createMediaStreamSource(mikroStrom);
    mikroQuelle.connect(mikroGain);
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
      // mitlaufender Strom haelt Geraet und Mikrofon sonst dauerhaft offen.
      if (zweigAudio) zweigAudio.pause();
      if (musikGain) musikGain.gain.value = 0;
      mikroSchliessen();
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
            mikroOeffnen();
          }
        }, 500);
      }
      return;
    }
    if (musikGain) musikGain.gain.value = lautstaerke / 100;
    if (mikroGain) mikroGain.gain.value = mikroLautstaerke / 100;
    zielSetzen();
    mikroOeffnen();
  }

  /* --- Bedienung -------------------------------------------------------- */

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
      await berechtigungHolen();
      await geraeteLaden();
      schalterAnzeigen();
    } else {
      hinweisSetzen("");
    }
    anwenden();
  });

  if (mikroSchalter) {
    mikroSchalter.addEventListener("click", () => {
      mikroAn = !mikroAn;
      localStorage.setItem(MIKRO_AN_KEY, mikroAn ? "1" : "0");
      schalterAnzeigen();
      if (mikroAn) mikroOeffnen();
      else mikroSchliessen();
    });
  }

  auswahl.addEventListener("change", () => {
    geraetId = auswahl.value;
    localStorage.setItem(GERAET_KEY, geraetId);
    anwenden();
  });

  if (mikroAuswahl) {
    mikroAuswahl.addEventListener("change", () => {
      mikroId = mikroAuswahl.value;
      localStorage.setItem(MIKRO_KEY, mikroId);
      // Ein laufendes Mikrofon zeigt weiter auf das alte Geraet - erst
      // schliessen, dann mit der neuen Kennung neu oeffnen.
      mikroSchliessen();
      mikroOeffnen();
    });
  }

  regler.addEventListener("input", () => {
    lautstaerke = Number(regler.value);
    localStorage.setItem(LAUTSTAERKE_KEY, String(lautstaerke));
    reglerAnzeigen();
    if (musikGain) musikGain.gain.value = lautstaerke / 100;
  });

  if (mikroRegler) {
    mikroRegler.addEventListener("input", () => {
      mikroLautstaerke = Number(mikroRegler.value);
      localStorage.setItem(MIKRO_LAUTSTAERKE_KEY, String(mikroLautstaerke));
      reglerAnzeigen();
      if (mikroGain) mikroGain.gain.value = mikroLautstaerke / 100;
    });
  }

  // Ein neu eingestecktes Kabel oder Mikrofon taucht ohne das nicht auf.
  if (moeglich && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      if (an) geraeteLaden().then(anwenden);
    });
  }

  regler.value = String(lautstaerke);
  if (mikroRegler) mikroRegler.value = String(mikroLautstaerke);
  reglerAnzeigen();
  schalterAnzeigen();
  if (an && moeglich) {
    geraeteLaden().then(() => {
      schalterAnzeigen();
      anwenden();
    });
  }
})();
