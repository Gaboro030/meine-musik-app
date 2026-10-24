/* ===== Freunde + Party-Einladungen (weltweit) =====
   Jede Installation hat ein eigenes "Postfach" und einen Freundescode. Wer
   den Code eines anderen einträgt, schickt ihm automatisch eine
   Freundschaftsanfrage; nimmt er an, kennen sich beide und können sich
   gegenseitig zu Partys einladen - egal, wo auf der Welt sie gerade sind.

   Wie die Nachrichten ankommen, ohne eigenen Server und ohne offene Ports:
   Das Postfach ist ein Thema auf ntfy.sh (kostenloser, offener
   Benachrichtigungsdienst, kein Konto). Jede Nachricht wird vorher mit
   AES-GCM (WebCrypto) für den Empfänger verschlüsselt - der Schlüssel steht
   nur im Freundescode. ntfy.sh sieht also nur Zufallsnamen und
   unlesbaren Text, nie Namen oder Party-Links.

   Die Musik selbst läuft NICHT über ntfy.sh: die Einladung enthält den
   Gastlink des Cloudflare-Tunnels (party.rs), darüber hört der Freund
   direkt beim Gastgeber mit. Gastgeber kann deshalb nur die Desktop-App
   sein (Android hat keinen Tunnel), mitmachen kann jeder. */
(function () {
  "use strict";
  if (!window.crypto || !crypto.subtle) return;

  const RELAY = "https://ntfy.sh";
  const ID_KEY = "friendsIdentity";
  const LIST_KEY = "friendsList";
  const PENDING_KEY = "friendsPending";
  const SEEN_KEY = "friendsLastMsgId";
  const CODE_PREFIX = "RESON:";
  // Ein Tunnel-Link lebt nur, solange der Gastgeber die App offen hat -
  // ältere Einladungen sind fast sicher tot und werden nicht mehr gezeigt.
  const INVITE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
  const GUEST_URL_RE = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com\/guest$/;
  const TOPIC_RE = /^[-_A-Za-z0-9]{8,64}$/;

  const tr = (text, vars) => (window.t ? window.t(text, vars) : text);
  // Knopf mit Icon + Text. Text kommt als Textknoten dazu, nie als HTML.
  const iconLabel = (btn, iconName, text) => {
    btn.innerHTML = window.icon ? window.icon(iconName) : "";
    btn.append(document.createTextNode(" " + text));
  };
  const toast = (msg) => {
    if (typeof showToast === "function") showToast(msg);
  };

  /* --- Speicher -------------------------------------------------------- */
  function load(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) { /* Speicher voll - Freundesliste ist dann nur bis zum Neustart da */ }
  }

  /* --- base64url + Zufall ----------------------------------------------- */
  const b64u = (bytes) =>
    btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64u = (s) =>
    Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) =>
      c.charCodeAt(0)
    );
  const random = (n) => crypto.getRandomValues(new Uint8Array(n));

  /* --- Eigene Identität --------------------------------------------------- */
  function identity() {
    let me = load(ID_KEY, null);
    if (!me || !TOPIC_RE.test(me.topic || "") || !me.key) {
      me = {
        // Kein "Ich": den Namen lesen die ANDEREN ("Ich lädt dich ein").
        name: `Reson-${100 + Math.floor(Math.random() * 900)}`,
        topic: "reson-" + b64u(random(18)),
        key: b64u(random(32)),
      };
      save(ID_KEY, me);
    }
    return me;
  }

  function myCode() {
    const me = identity();
    const json = JSON.stringify({ v: 1, n: me.name, t: me.topic, k: me.key });
    return CODE_PREFIX + b64u(new TextEncoder().encode(json));
  }

  /* Freundescode -> {name, topic, key} oder null. Alles prüfen: der Code
     kommt aus einem Chat, also von außen. */
  function parseCode(raw) {
    const s = String(raw || "").trim().replace(/\s+/g, "");
    if (!s.toUpperCase().startsWith(CODE_PREFIX)) return null;
    try {
      const d = JSON.parse(new TextDecoder().decode(unb64u(s.slice(CODE_PREFIX.length))));
      if (!d || !TOPIC_RE.test(d.t || "") || typeof d.k !== "string" || unb64u(d.k).length !== 32) return null;
      return { name: String(d.n || tr("Freund")).trim().slice(0, 40) || tr("Freund"), topic: d.t, key: d.k };
    } catch (_) {
      return null;
    }
  }

  /* --- Verschlüsselung ---------------------------------------------------- */
  const keyCache = new Map();
  function aesKey(keyB64) {
    if (!keyCache.has(keyB64)) {
      keyCache.set(keyB64, crypto.subtle.importKey("raw", unb64u(keyB64), "AES-GCM", false, ["encrypt", "decrypt"]));
    }
    return keyCache.get(keyB64);
  }
  async function encrypt(keyB64, obj) {
    const iv = random(12);
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(keyB64), data));
    return `${b64u(iv)}.${b64u(ct)}`;
  }
  async function decrypt(keyB64, text) {
    const [iv, ct] = String(text || "").split(".");
    if (!iv || !ct) throw new Error("kaputt");
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(iv) }, await aesKey(keyB64), unb64u(ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  /* --- Senden --------------------------------------------------------------- */
  async function sendTo(friend, payload) {
    const me = identity();
    const body = await encrypt(friend.key, { ...payload, from: { name: me.name, code: myCode() }, ts: Date.now() });
    const res = await fetch(`${RELAY}/${friend.topic}`, { method: "POST", body });
    if (!res.ok) throw new Error(tr("Nachricht konnte nicht zugestellt werden."));
  }

  /* --- Freundesliste -------------------------------------------------------- */
  const friends = () => load(LIST_KEY, []);
  function upsertFriend(f) {
    const list = friends().filter((x) => x.topic !== f.topic);
    list.push({ name: f.name, topic: f.topic, key: f.key });
    list.sort((a, b) => a.name.localeCompare(b.name));
    save(LIST_KEY, list);
  }
  function removeFriend(topic) {
    save(LIST_KEY, friends().filter((f) => f.topic !== topic));
    render();
  }

  async function addFriendFromCode(raw) {
    const f = parseCode(raw);
    if (!f) {
      toast(tr("Das ist kein gültiger Freundescode."));
      return false;
    }
    if (f.topic === identity().topic) {
      toast(tr("Das ist dein eigener Code."));
      return false;
    }
    upsertFriend(f);
    render();
    try {
      await sendTo(f, { type: "friend-request" });
      toast(tr("{name} hinzugefügt – Anfrage ist unterwegs.", { name: f.name }));
    } catch (err) {
      toast(String(err.message || err));
    }
    return true;
  }

  /* --- Einladen (nur Desktop: braucht den Tunnel) --------------------------- */
  async function inviteFriend(friend, btn) {
    const core = window.__TAURI__ && window.__TAURI__.core;
    if (!core) return;
    btn.disabled = true;
    btn.innerHTML = window.icon ? window.icon("refresh", "ic-spin") : "…";
    try {
      // Party läuft noch nicht? Dann gleich starten - eine Einladung zu
      // einer Party, die es nicht gibt, wäre sinnlos.
      if (typeof partyModeActive !== "undefined" && !partyModeActive && typeof setPartyMode === "function") {
        setPartyMode(true);
      }
      const res = await core.invoke("party_internet", { enable: true });
      const url = res && res.public_url;
      if (!url || !GUEST_URL_RE.test(url)) throw new Error(tr("Internet-Link konnte nicht erstellt werden."));
      document.dispatchEvent(new CustomEvent("party-internet-changed"));
      await sendTo(friend, { type: "invite", url });
      toast(tr("{name} ist eingeladen!", { name: friend.name }));
    } catch (err) {
      toast(String((err && err.message) || err));
    } finally {
      btn.disabled = false;
      iconLabel(btn, "sparkles", tr("Einladen"));
    }
  }

  function joinParty(url) {
    // Eigene Musik anhalten - drüben läuft die des Gastgebers.
    if (typeof audioEl !== "undefined" && audioEl && !audioEl.paused) audioEl.pause();
    const full = `${url}?name=${encodeURIComponent(identity().name)}`;
    const shell = window.__TAURI__ && window.__TAURI__.shell;
    if (shell && typeof shell.open === "function") shell.open(full).catch(() => window.open(full, "_blank"));
    else window.open(full, "_blank", "noopener");
  }

  /* --- Eingehende Nachrichten --------------------------------------------- */
  const pending = () => load(PENDING_KEY, []);
  function addPending(req) {
    save(PENDING_KEY, pending().filter((p) => p.topic !== req.topic).concat(req));
  }
  function dropPending(topic) {
    save(PENDING_KEY, pending().filter((p) => p.topic !== topic));
  }

  async function acceptRequest(req) {
    upsertFriend(req);
    dropPending(req.topic);
    render();
    try {
      await sendTo(req, { type: "friend-accept" });
    } catch (_) { /* er sieht uns dann eben beim ersten Einladen */ }
    toast(tr("{name} ist jetzt dein Freund.", { name: req.name }));
  }

  async function handleMessage(text) {
    let msg;
    try {
      msg = await decrypt(identity().key, text);
    } catch (_) {
      return; // nicht für uns oder manipuliert - stillschweigend verwerfen
    }
    const sender = msg && msg.from && parseCode(msg.from.code);
    // Eigene Nachricht (z.B. von einer zweiten Installation mit kopiertem
    // Profil) - sonst stuende man als eigene Freundschaftsanfrage da.
    if (!sender || sender.topic === identity().topic) return;
    // Der Name in der Nachricht ist aktueller als der im (evtl. alten) Code.
    sender.name = String(msg.from.name || sender.name).trim().slice(0, 40) || sender.name;
    const known = friends().some((f) => f.topic === sender.topic);

    if (msg.type === "friend-request") {
      if (known) {
        upsertFriend(sender); // Namen auffrischen, keine erneute Nachfrage
        render();
        return;
      }
      addPending(sender);
      render();
      banner(tr("{name} möchte dich als Freund hinzufügen.", { name: sender.name }), [
        [tr("Annehmen"), () => acceptRequest(sender)],
        [tr("Ablehnen"), () => { dropPending(sender.topic); render(); }],
      ]);
    } else if (msg.type === "friend-accept") {
      upsertFriend(sender);
      dropPending(sender.topic);
      render();
      toast(tr("{name} hat deine Freundschaftsanfrage angenommen.", { name: sender.name }));
    } else if (msg.type === "invite") {
      // Nur von echten Freunden und nur auf einen echten Tunnel-Gastlink -
      // eine Einladung darf nie eine beliebige Adresse öffnen.
      if (!known || !GUEST_URL_RE.test(msg.url || "")) return;
      if (!(Date.now() - Number(msg.ts) < INVITE_MAX_AGE_MS)) return;
      banner(tr("{name} lädt dich zur Party ein!", { name: sender.name }), [
        [tr("Beitreten"), () => joinParty(msg.url)],
        [tr("Später"), () => {}],
      ]);
    }
  }

  /* Postfach abonnieren. ntfy.sh hält Nachrichten 12 Stunden vor - wer die
     App erst später öffnet, bekommt Anfragen und Einladungen trotzdem.
     "since" ist die zuletzt verarbeitete Nachricht, damit nach einem
     Neustart nichts doppelt aufpoppt. Eigenes Neuverbinden statt dem von
     EventSource: das würde mit der ALTEN since-Angabe alles wiederholen. */
  let source = null;
  let retryDelay = 3000;
  function subscribe() {
    if (source) source.close();
    const since = localStorage.getItem(SEEN_KEY) || "12h";
    source = new EventSource(`${RELAY}/${identity().topic}/sse?since=${encodeURIComponent(since)}`);
    source.onopen = () => {
      retryDelay = 3000;
    };
    source.onmessage = (e) => {
      let d;
      try {
        d = JSON.parse(e.data);
      } catch (_) {
        return;
      }
      if (!d || d.event !== "message" || !d.id) return;
      try {
        localStorage.setItem(SEEN_KEY, d.id);
      } catch (_) { /* egal */ }
      handleMessage(d.message);
    };
    source.onerror = () => {
      source.close();
      source = null;
      setTimeout(subscribe, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60000);
    };
  }

  /* --- Hinweis-Leiste für Anfragen/Einladungen ---------------------------- */
  function banner(text, actions) {
    let stack = document.getElementById("friendBannerStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "friendBannerStack";
      stack.className = "friend-banner-stack";
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = "friend-banner";
    const label = document.createElement("div");
    label.className = "friend-banner-text";
    label.textContent = text;
    const row = document.createElement("div");
    row.className = "friend-banner-actions";
    actions.forEach(([caption, fn], i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = i === 0 ? "friend-banner-btn primary" : "friend-banner-btn";
      b.textContent = caption;
      b.addEventListener("click", () => {
        el.remove();
        fn();
      });
      row.appendChild(b);
    });
    el.append(label, row);
    stack.appendChild(el);
  }

  /* --- Bereich im Freunde-Popover ----------------------------------------- */
  const popover = document.getElementById("qrPopover");
  if (!popover) return;
  const section = document.createElement("div");
  section.className = "friends-section";
  // Neu gebaute Listen entfernen das angeklickte Element - der allgemeine
  // "Klick ausserhalb"-Schliesser hielte das dann für einen Klick daneben.
  section.addEventListener("click", (e) => e.stopPropagation());
  popover.appendChild(section);

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render() {
    section.textContent = "";
    section.appendChild(el("div", "qr-participants-title", tr("Deine Freunde")));

    const me = identity();
    const nameInput = el("input", "party-chat-input friends-name-input");
    nameInput.type = "text";
    nameInput.maxLength = 40;
    nameInput.value = me.name;
    nameInput.placeholder = tr("Dein Name");
    nameInput.title = tr("So sehen dich deine Freunde");
    nameInput.addEventListener("change", () => {
      const v = nameInput.value.trim().slice(0, 40);
      if (!v) {
        nameInput.value = identity().name;
        return;
      }
      save(ID_KEY, { ...identity(), name: v });
    });
    section.appendChild(nameInput);

    const copyBtn = el("button", "btn-secondary sync-remote-btn");
    iconLabel(copyBtn, "copy", tr("Meinen Freundescode kopieren"));
    copyBtn.type = "button";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(myCode());
        toast(tr("Code kopiert – schick ihn deinem Freund."));
      } catch (_) {
        toast(tr("Kopieren nicht möglich."));
      }
    });
    section.appendChild(copyBtn);

    const addRow = el("div", "party-chat-input-row friends-add-row");
    const codeInput = el("input", "party-chat-input");
    codeInput.type = "text";
    codeInput.placeholder = tr("Freundescode einfügen …");
    const addBtn = el("button", "party-chat-send-btn", "+");
    addBtn.type = "button";
    addBtn.title = tr("Freund hinzufügen");
    const doAdd = async () => {
      if (!codeInput.value.trim()) return;
      if (await addFriendFromCode(codeInput.value)) codeInput.value = "";
    };
    addBtn.addEventListener("click", doAdd);
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAdd();
    });
    addRow.append(codeInput, addBtn);
    section.appendChild(addRow);

    const reqs = pending();
    if (reqs.length) {
      section.appendChild(el("div", "sync-remote-hint friends-sub", tr("Anfragen")));
      reqs.forEach((r) => {
        const row = el("div", "sync-peer-row");
        row.appendChild(el("div", "sync-peer-item", r.name));
        const ok = el("button", "sync-peer-unpair friends-accept");
        ok.innerHTML = window.icon("checkmark");
        ok.type = "button";
        ok.title = tr("Annehmen");
        ok.addEventListener("click", () => acceptRequest(r));
        const no = el("button", "sync-peer-unpair");
        no.innerHTML = window.icon("x");
        no.type = "button";
        no.title = tr("Ablehnen");
        no.addEventListener("click", () => {
          dropPending(r.topic);
          render();
        });
        row.append(ok, no);
        section.appendChild(row);
      });
    }

    const list = el("div", "sync-peer-list");
    const all = friends();
    if (!all.length) {
      list.appendChild(el("div", "sync-peer-empty", tr("Noch keine Freunde – tauscht eure Codes aus.")));
    }
    all.forEach((f) => {
      const row = el("div", "sync-peer-row");
      row.appendChild(el("div", "sync-peer-item", f.name));
      const inv = el("button", "btn-secondary friends-invite-btn");
      iconLabel(inv, "sparkles", tr("Einladen"));
      inv.type = "button";
      inv.addEventListener("click", () => inviteFriend(f, inv));
      const del = el("button", "sync-peer-unpair");
      del.innerHTML = window.icon("x");
      del.type = "button";
      del.title = tr("Freund entfernen");
      del.addEventListener("click", () => removeFriend(f.topic));
      row.append(inv, del);
      list.appendChild(row);
    });
    section.appendChild(list);
  }

  document.addEventListener("i18n-changed", render);
  render();
  subscribe();
})();
