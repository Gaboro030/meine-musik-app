/* ===== Backup: Einstellungen (klein, JSON) + Komplette Bibliothek (ZIP) =====
   App-native Zusatzfunktion ohne Flask-Vorbild (wie Handy-Sync in sync.js,
   M3U-Export in m3u-export.js) - kein eigener Cloud-Account/Server, der
   Nutzer waehlt selbst einen Zielordner (z.B. einen OneDrive/GDrive-
   Ordner) ueber den normalen Speichern-Dialog.

   Einstellungs-Backup laeuft komplett hier im Frontend (localStorage ist
   sowieso nur hier sichtbar). Der Komplett-ZIP dagegen laeuft in Rust
   (backup.rs export_library_zip/import_library_zip) - Musik-Bibliotheken
   koennen mehrere GB gross sein, das per IPC durchzureichen waere sowohl
   langsam als auch speicherhungrig; Rust bekommt nur den vom Dialog
   gewaehlten Zielpfad und schreibt/liest die Datei direkt. */
(function () {
  "use strict";
  if (!window.__TAURI__) return;
  const { invoke } = window.__TAURI__.core;

  const exportSettingsBtn = document.getElementById("exportSettingsBtn");
  const importSettingsBtn = document.getElementById("importSettingsBtn");
  const exportZipBtn = document.getElementById("exportZipBtn");
  const importZipBtn = document.getElementById("importZipBtn");
  if (!exportSettingsBtn) return;

  function toast(msg) {
    if (typeof showToast === "function") showToast(msg);
  }
  function errMsg(err) {
    return String(err && err.message ? err.message : err);
  }
  function todayStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  exportSettingsBtn.addEventListener("click", async () => {
    exportSettingsBtn.disabled = true;
    try {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
      const json = JSON.stringify(
        { app: "meine-musik", kind: "settings-backup", version: 1, exportedAt: Date.now(), localStorage: data },
        null,
        2
      );
      const path = await window.__TAURI__.dialog.save({
        defaultPath: `meine-musik-einstellungen-${todayStamp()}.json`,
        filters: [{ name: "Meine-Musik-Backup", extensions: ["json"] }],
      });
      if (!path) return;
      await window.__TAURI__.fs.writeTextFile(path, json);
      toast(t("💾 Einstellungen gesichert"));
    } catch (err) {
      toast(errMsg(err));
    } finally {
      exportSettingsBtn.disabled = false;
    }
  });

  if (importSettingsBtn) {
    importSettingsBtn.addEventListener("click", async () => {
      importSettingsBtn.disabled = true;
      try {
        const path = await window.__TAURI__.dialog.open({
          multiple: false,
          filters: [{ name: "Meine-Musik-Backup", extensions: ["json"] }],
        });
        if (!path) return;
        const text = await window.__TAURI__.fs.readTextFile(path);
        const parsed = JSON.parse(text);
        if (!parsed || parsed.kind !== "settings-backup" || !parsed.localStorage) {
          throw new Error(t("Keine gültige Einstellungs-Backup-Datei."));
        }
        Object.entries(parsed.localStorage).forEach(([k, v]) => localStorage.setItem(k, v));
        toast(t("💾 Einstellungen wiederhergestellt – App startet neu …"));
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        toast(errMsg(err));
        importSettingsBtn.disabled = false;
      }
    });
  }

  if (exportZipBtn) {
    exportZipBtn.addEventListener("click", async () => {
      exportZipBtn.disabled = true;
      const orig = exportZipBtn.textContent;
      exportZipBtn.textContent = t("Wird gepackt …");
      try {
        const path = await window.__TAURI__.dialog.save({
          defaultPath: `meine-musik-bibliothek-${todayStamp()}.zip`,
          filters: [{ name: "ZIP-Archiv", extensions: ["zip"] }],
        });
        if (!path) return;
        await invoke("export_library_zip", { destPath: path });
        toast(t("📦 Bibliothek als ZIP exportiert"));
      } catch (err) {
        toast(errMsg(err));
      } finally {
        exportZipBtn.disabled = false;
        exportZipBtn.textContent = orig;
      }
    });
  }

  if (importZipBtn) {
    importZipBtn.addEventListener("click", async () => {
      importZipBtn.disabled = true;
      const orig = importZipBtn.textContent;
      importZipBtn.textContent = t("Wird entpackt …");
      try {
        const path = await window.__TAURI__.dialog.open({
          multiple: false,
          filters: [{ name: "ZIP-Archiv", extensions: ["zip"] }],
        });
        if (!path) return;
        const imported = await invoke("import_library_zip", { srcPath: path });
        toast(t("📦 {count} Datei(en) wiederhergestellt", { count: imported }));
        if (typeof refreshLibrary === "function") await refreshLibrary();
      } catch (err) {
        toast(errMsg(err));
      } finally {
        importZipBtn.disabled = false;
        importZipBtn.textContent = orig;
      }
    });
  }
})();
