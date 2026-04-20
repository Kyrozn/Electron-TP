import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Contenu de la solution ────────────────────────────────────────────────────

const SOLUTION_CONTENT = `
<section class="intro">
  <p>Ce document décrit l'implémentation complète du TP. Pour chaque feature, vous trouverez le <strong>concept clé</strong>, le <strong>code à écrire</strong> et les <strong>points de vigilance</strong>.</p>
  <p>L'application de base (Markdownitor) contient déjà tous les appels <code>window.electronAPI.*</code> dans <code>app/src/main.js</code>. Votre travail est de les <strong>brancher</strong> côté Electron.</p>
</section>

<h2>Architecture générale</h2>

<p>Une application Electron repose sur deux processus distincts qui communiquent par IPC :</p>

<div class="arch-diagram">
  <div class="arch-box process-main">
    <div class="arch-title">Processus Principal<br><span>electron/main.js</span></div>
    <ul>
      <li>Accès Node.js complet</li>
      <li>Crée les fenêtres</li>
      <li>Gère les fichiers, menus, tray</li>
      <li>Répond aux appels IPC</li>
    </ul>
  </div>
  <div class="arch-arrow">
    <div class="arrow-line"></div>
    <div class="arrow-label">ipcMain.handle / ipcRenderer.invoke</div>
    <div class="arrow-label">win.webContents.send / ipcRenderer.on</div>
  </div>
  <div class="arch-box process-renderer">
    <div class="arch-title">Processus Renderer<br><span>app/src/main.js</span></div>
    <ul>
      <li>Votre app web (HTML/CSS/JS)</li>
      <li>Sandbox — pas d'accès Node</li>
      <li>Communique via <code>window.electronAPI</code></li>
      <li>Exposé par le preload script</li>
    </ul>
  </div>
</div>

<div class="arch-preload">
  <strong>electron/preload.js</strong> — le pont sécurisé. S'exécute avant le renderer, a accès à Node, et expose uniquement les fonctions autorisées via <code>contextBridge.exposeInMainWorld()</code>.
</div>

<h2>Structure des fichiers</h2>

<pre><code>TP-Electron-Solution/
├── app/                     ← Application web (inchangée côté logique)
│   ├── src/main.js          ← Appels window.electronAPI déjà en place
│   └── src/style.css        ← -webkit-app-region pour le drag (B2)
├── electron/
│   ├── main.js              ← Processus principal — tout ce que vous écrivez
│   └── preload.js           ← contextBridge — interface renderer ↔ main
└── package.json             ← "main": "electron/main.js"</code></pre>

<div class="page-break"></div>

<h1>F1–F4 · Fondations</h1>

<h2>F1 — Fenêtre Electron &nbsp;<span class="badge">BrowserWindow</span></h2>

<p>La fenêtre est créée dans le processus principal avec <code>BrowserWindow</code>. Les options <code>webPreferences</code> définissent le niveau de sécurité.</p>

<pre><code class="language-javascript">const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // isole le renderer du contexte Node
      nodeIntegration: false,   // interdit require() dans le renderer
      sandbox: false,           // nécessaire pour que preload accède à Node
    },
    show: false,  // évite le flash blanc au démarrage
  });

  win.once('ready-to-show', () => win.show());
  return win;
}

app.whenReady().then(() => createWindow());</code></pre>

<div class="callout warning">
  <strong>Sécurité :</strong> <code>nodeIntegration: false</code> + <code>contextIsolation: true</code> sont les réglages recommandés. Ils empêchent du code malveillant chargé dans le renderer d'accéder à Node.js. Ne jamais les désactiver si l'app charge du contenu distant.
</div>

<h2>F2 — Charger l'application web &nbsp;<span class="badge">loadURL / loadFile</span></h2>

<pre><code class="language-javascript">const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
  win.loadURL('http://localhost:5173');   // serveur Vite en dev
} else {
  win.loadFile(path.join(__dirname, '../app/dist/index.html')); // build statique
}</code></pre>

<p>En développement, l'app pointe sur le serveur Vite (hot reload actif). En production, elle charge le build statique généré par <code>npm run build</code>.</p>

<h2>F3 — Détection du contexte &nbsp;<span class="badge">contextBridge</span></h2>

<p>Le fichier <code>preload.js</code> expose <code>window.electronAPI</code>. Dès que cet objet existe, l'app web sait qu'elle tourne sous Electron et active les fonctionnalités natives.</p>

<pre><code class="language-javascript">// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile:   ()     => ipcRenderer.invoke('open-file'),
  saveFile:   (args) => ipcRenderer.invoke('save-file', args),
  saveFileAs: (args) => ipcRenderer.invoke('save-file-as', args),
  // ... autres méthodes
});</code></pre>

<pre><code class="language-javascript">// app/src/main.js — côté renderer
const isElectron = typeof window.electronAPI !== 'undefined';

if (isElectron) {
  // activer les fonctionnalités natives
}</code></pre>

<h2>F4 — DevTools en développement &nbsp;<span class="badge">openDevTools</span></h2>

<pre><code class="language-javascript">if (isDev) {
  win.loadURL('http://localhost:5173');
  win.webContents.openDevTools({ mode: 'detach' }); // fenêtre séparée
}</code></pre>

<div class="page-break"></div>

<h1>F5–F8 · Fichiers natifs</h1>

<h2>F5 — Ouvrir un fichier &nbsp;<span class="badge">dialog.showOpenDialog</span></h2>

<p>Le renderer appelle <code>window.electronAPI.openFile()</code>, le main process ouvre le dialogue natif et renvoie le contenu.</p>

<pre><code class="language-javascript">// electron/main.js
const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;

ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un fichier Markdown',
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
    ],
    properties: ['openFile'],
  });

  if (canceled || !filePaths[0]) return null;

  const content = await fs.readFile(filePaths[0], 'utf-8');
  return { path: filePaths[0], content };
});</code></pre>

<pre><code class="language-javascript">// electron/preload.js — exposer la méthode
openFile: () => ipcRenderer.invoke('open-file'),</code></pre>

<pre><code class="language-javascript">// app/src/main.js — utiliser la méthode
async function openFile() {
  if (isElectron) {
    const result = await window.electronAPI.openFile();
    if (result) { editor.value = result.content; setCurrentFile(result.path); }
  } else {
    fileInput.click(); // fallback navigateur
  }
}</code></pre>

<div class="callout info">
  <strong>invoke vs send :</strong> <code>ipcRenderer.invoke</code> est bidirectionnel (Promise). <code>ipcRenderer.send</code> est unidirectionnel (fire-and-forget). Pour les fichiers, on utilise <code>invoke</code> pour attendre la réponse.
</div>

<h2>F6 — Enregistrer &nbsp;<span class="badge">fs.writeFile</span></h2>

<pre><code class="language-javascript">ipcMain.handle('save-file', async (_event, { path: filePath, content }) => {
  await fs.writeFile(filePath, content, 'utf-8');
  return { success: true };
});</code></pre>

<p>Si le fichier n'a pas encore de chemin (<em>Sans titre</em>), le renderer appelle <code>saveFileAs()</code> à la place.</p>

<h2>F7 — Enregistrer sous &nbsp;<span class="badge">dialog.showSaveDialog</span></h2>

<pre><code class="language-javascript">ipcMain.handle('save-file-as', async (_event, { content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer sous…',
    defaultPath: 'document.md',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });

  if (canceled || !filePath) return null;
  await fs.writeFile(filePath, content, 'utf-8');
  return { path: filePath };
});</code></pre>

<h2>F8 — Titre de fenêtre dynamique &nbsp;<span class="badge">win.setTitle</span></h2>

<pre><code class="language-javascript">// electron/main.js
ipcMain.handle('set-window-title', (_event, title) => {
  mainWindow.setTitle(title);
  // Sur macOS : affiche le chemin dans la barre de titre
  if (process.platform === 'darwin') mainWindow.setRepresentedFilename(title);
});</code></pre>

<pre><code class="language-javascript">// app/src/main.js — appeler à chaque changement de fichier
function setCurrentFile(filePath) {
  state.currentFile = filePath;
  const name = filePath ? filePath.split(/[\\/]/).pop() : null;
  fileName.textContent = name ? \`— \${name}\` : '— Sans titre';
  window.electronAPI?.setWindowTitle?.(name ? \`\${name} — Markdownitor\` : 'Markdownitor');
}</code></pre>

<div class="page-break"></div>

<h1>F9–F12 · Intégration OS</h1>

<h2>F9 — Menu natif &nbsp;<span class="badge">Menu.buildFromTemplate</span></h2>

<p>Le menu est déclaratif : on passe un tableau de templates à Electron, qui construit le menu natif correspondant à la plateforme.</p>

<pre><code class="language-javascript">const { Menu } = require('electron');

const template = [
  {
    label: 'Fichier',
    submenu: [
      {
        label: 'Ouvrir…',
        accelerator: 'CmdOrCtrl+O',  // raccourci cross-platform
        click: () => win.webContents.send('menu-action', 'open'),
      },
      {
        label: 'Enregistrer',
        accelerator: 'CmdOrCtrl+S',
        click: () => win.webContents.send('menu-action', 'save'),
      },
      { type: 'separator' },
      { role: 'quit', label: 'Quitter' }, // role = comportement natif prédéfini
    ],
  },
  // Édition, Affichage, Aide...
];

Menu.setApplicationMenu(Menu.buildFromTemplate(template));</code></pre>

<pre><code class="language-javascript">// preload.js — écouter les actions menu depuis le renderer
onMenuAction: (cb) => ipcRenderer.on('menu-action', (_e, action) => cb(action)),</code></pre>

<pre><code class="language-javascript">// app/src/main.js
window.electronAPI.onMenuAction((action) => {
  switch (action) {
    case 'open':  openFile();  break;
    case 'save':  saveFile();  break;
    case 'new':   newDocument(); break;
  }
});</code></pre>

<div class="callout info">
  <strong>CmdOrCtrl :</strong> Electron remplace automatiquement par <code>Cmd</code> sur macOS et <code>Ctrl</code> sur Windows/Linux. Les <code>role</code> (quit, undo, copy…) utilisent également le comportement natif de chaque OS.
</div>

<h2>F10 — Confirmation avant fermeture &nbsp;<span class="badge">win.on('close')</span></h2>

<p>On intercepte l'événement <code>close</code>, on demande au renderer si l'état est "dirty", puis on laisse passer (ou non) la fermeture.</p>

<pre><code class="language-javascript">// electron/main.js
let forceClose = false;

win.on('close', (e) => {
  if (forceClose) return;     // déjà confirmé, on laisse passer
  e.preventDefault();          // bloquer la fermeture
  win.webContents.send('before-close'); // demander au renderer
});

ipcMain.on('confirm-close', (_e, confirmed) => {
  if (confirmed) { forceClose = true; win.close(); }
});</code></pre>

<pre><code class="language-javascript">// app/src/main.js
window.electronAPI.onBeforeClose(() => {
  if (state.isDirty) {
    const ok = confirm('Modifications non enregistrées. Quitter quand même ?');
    window.electronAPI.confirmClose(ok);
  } else {
    window.electronAPI.confirmClose(true);
  }
});</code></pre>

<h2>F11 — Notifications OS &nbsp;<span class="badge">Notification</span></h2>

<pre><code class="language-javascript">const { Notification } = require('electron');

function notifySaved(filename) {
  if (!Notification.isSupported()) return;
  new Notification({
    title: 'Markdownitor',
    body: \`"\${filename}" enregistré\`,
    silent: true,
  }).show();
}

// Appeler après chaque fs.writeFile réussi</code></pre>

<h2>F12 — System Tray &nbsp;<span class="badge">Tray</span></h2>

<pre><code class="language-javascript">const { Tray, Menu, nativeImage } = require('electron');

let tray = null;

function createTray(win) {
  // Charger une icône (PNG 16×16 ou 22×22)
  const icon = nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('Markdownitor');

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir', click: () => { win.show(); win.focus(); } },
    { label: 'Nouveau', click: () => win.webContents.send('menu-action', 'new') },
    { type: 'separator' },
    { label: 'Quitter', click: () => { tray.destroy(); app.quit(); } },
  ]));

  // Double-clic sur l'icône → show/hide
  tray.on('double-click', () => win.isVisible() ? win.hide() : win.show());
}

// Ne pas quitter quand la fenêtre se ferme si tray est actif
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) app.quit();
});</code></pre>

<div class="page-break"></div>

<h1>Bonus</h1>

<h2>B2 — Fenêtre sans cadre &nbsp;<span class="badge">frame: false</span></h2>

<p>On désactive le cadre natif et on crée sa propre titlebar en HTML. La propriété CSS <code>-webkit-app-region</code> indique à Electron quelle zone sert au drag de la fenêtre.</p>

<pre><code class="language-javascript">// electron/main.js
const win = new BrowserWindow({
  frame: false,               // pas de décoration OS
  // titleBarStyle: 'hidden', // alternative sur macOS (garde les boutons natifs)
  // ...
});</code></pre>

<pre><code class="language-css">/* app/src/style.css */
#titlebar {
  -webkit-app-region: drag;   /* toute la titlebar est draggable */
}

/* Les boutons et éléments interactifs ne doivent pas déclencher le drag */
button, input, .tool-btn {
  -webkit-app-region: no-drag;
}</code></pre>

<pre><code class="language-javascript">// preload.js — exposer les contrôles fenêtre
windowMinimize: () => ipcRenderer.send('window-minimize'),
windowMaximize: () => ipcRenderer.send('window-maximize'),
windowClose:    () => ipcRenderer.send('window-close'),</code></pre>

<pre><code class="language-javascript">// electron/main.js
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () =>
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window-close',    () => mainWindow.close());</code></pre>

<h2>B3 — Fichiers récents &nbsp;<span class="badge">userData + Menu dynamique</span></h2>

<pre><code class="language-javascript">// Stocker dans le dossier userData de l'app (persistant entre sessions)
const recentFilesPath = path.join(app.getPath('userData'), 'recent-files.json');

function loadRecentFiles() {
  try {
    return JSON.parse(fs.readFileSync(recentFilesPath, 'utf-8'));
  } catch { return []; }
}

function addRecentFile(filePath) {
  let recents = loadRecentFiles();
  recents = [filePath, ...recents.filter(f => f !== filePath)].slice(0, 8);
  fs.writeFileSync(recentFilesPath, JSON.stringify(recents), 'utf-8');
  rebuildMenu(); // reconstruire le menu avec la nouvelle liste
}</code></pre>

<pre><code class="language-javascript">// Sous-menu dynamique dans le template de menu
{
  label: 'Fichiers récents',
  submenu: recentFiles.length === 0
    ? [{ label: 'Aucun fichier récent', enabled: false }]
    : recentFiles.map(fp => ({
        label: path.basename(fp),
        click: async () => {
          const content = await fs.readFile(fp, 'utf-8');
          win.webContents.send('file-loaded', { path: fp, content });
        },
      })),
}</code></pre>

<h2>B1 — Packaging &nbsp;<span class="badge">electron-builder</span></h2>

<pre><code class="language-json">// package.json
{
  "build": {
    "appId": "com.votreapp.markdownitor",
    "productName": "Markdownitor",
    "files": ["electron/**/*", "app/dist/**/*"],
    "win":   { "target": "nsis" },
    "mac":   { "target": "dmg" },
    "linux": { "target": "AppImage" }
  }
}</code></pre>

<pre><code class="language-bash">npm run build        # 1. Builder l'app Vite
npx electron-builder # 2. Packager en binaire distributable</code></pre>

<div class="page-break"></div>

<h1>Récapitulatif — Flux complet</h1>

<div class="flow-table">
  <table>
    <thead>
      <tr><th>Action utilisateur</th><th>Renderer</th><th>preload.js</th><th>main.js</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Clique "Ouvrir"</td>
        <td><code>electronAPI.openFile()</code></td>
        <td><code>ipcRenderer.invoke('open-file')</code></td>
        <td><code>dialog.showOpenDialog()</code> → <code>fs.readFile()</code></td>
      </tr>
      <tr>
        <td>Ctrl+S</td>
        <td><code>electronAPI.saveFile({path, content})</code></td>
        <td><code>ipcRenderer.invoke('save-file', args)</code></td>
        <td><code>fs.writeFile()</code> + <code>Notification</code></td>
      </tr>
      <tr>
        <td>Menu → Enregistrer</td>
        <td><code>onMenuAction('save')</code></td>
        <td><code>ipcRenderer.on('menu-action')</code></td>
        <td><code>win.webContents.send('menu-action', 'save')</code></td>
      </tr>
      <tr>
        <td>Ferme la fenêtre</td>
        <td><code>onBeforeClose()</code> → <code>confirmClose(ok)</code></td>
        <td><code>ipcRenderer.on('before-close')</code> + <code>ipcRenderer.send('confirm-close')</code></td>
        <td><code>win.on('close')</code> → <code>e.preventDefault()</code></td>
      </tr>
    </tbody>
  </table>
</div>

<div class="callout success">
  <strong>Points clés à retenir</strong>
  <ul>
    <li><strong>contextIsolation + contextBridge</strong> sont la base de sécurité d'Electron.</li>
    <li><strong>invoke/handle</strong> pour les opérations avec retour (fichiers, dialogues) ; <strong>send/on</strong> pour les événements unidirectionnels (menus, fermeture).</li>
    <li>Le renderer ne doit <strong>jamais</strong> appeler Node.js directement — tout passe par <code>preload.js</code>.</li>
    <li>L'app web fonctionne <strong>inchangée</strong> dans le navigateur grâce aux blocs <code>if (isElectron)</code>.</li>
  </ul>
</div>
`;

// ── Template HTML ─────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Correction TP Electron — Ynov Toulouse</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');

  :root {
    --blue:      #1a56db;
    --blue-lt:   #e8f0fd;
    --blue-dk:   #1e3a8a;
    --gray:      #6b7280;
    --border:    #e5e7eb;
    --bg-code:   #f3f4f6;
    --ynov:      #e84393;
    --success:   #059669;
    --warning:   #d97706;
    --info:      #0284c7;
    --code-bg:   #1e1e2e;
    --code-fg:   #cdd6f4;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4;
    margin: 17mm 17mm 20mm 17mm;
    @top-left   { content: "Ynov Toulouse — Correction TP Electron"; font-size: 8pt; color: #9ca3af; font-family: Inter, sans-serif; }
    @top-right  { content: "Jérémy ANGULO"; font-size: 8pt; color: #9ca3af; font-family: Inter, sans-serif; }
    @bottom-center { content: counter(page) " / " counter(pages); font-size: 8pt; color: #9ca3af; font-family: Inter, sans-serif; }
  }

  body {
    font-family: 'Inter', sans-serif;
    font-size: 10pt;
    line-height: 1.6;
    color: #111827;
    background: white;
  }

  /* ── Header ── */
  .cover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 0;
    border-bottom: 3px solid var(--ynov);
    margin-bottom: 28px;
  }
  .school-name { font-size: 18pt; font-weight: 700; color: var(--ynov); }
  .school-sub  { font-size: 9pt; color: var(--gray); font-weight: 500; }
  .cover-meta  { text-align: right; }
  .meta-author { font-size: 11pt; font-weight: 600; }
  .meta-info   { font-size: 8.5pt; color: var(--gray); margin-top: 2px; }
  .cover-badge {
    display: inline-block;
    background: #fdf2f8;
    color: var(--ynov);
    font-size: 8pt; font-weight: 600;
    padding: 3px 10px; border-radius: 20px; margin-top: 5px;
    letter-spacing: 0.5px; text-transform: uppercase;
    border: 1px solid #fbcfe8;
  }

  /* ── Titre doc ── */
  .doc-title-block {
    margin-bottom: 24px;
    padding: 20px 24px;
    background: linear-gradient(135deg, #1e3a8a 0%, #1a56db 100%);
    border-radius: 8px;
    color: white;
  }
  .tp-label { font-size: 8pt; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; opacity: .7; margin-bottom: 6px; }
  .doc-title-block h1 { font-size: 19pt; font-weight: 700; border: none; padding: 0; color: white; margin: 0 0 10px; }
  .doc-meta-row { display: flex; gap: 20px; font-size: 8.5pt; opacity: .85; flex-wrap: wrap; }
  .doc-meta-row span::before { content: "◆ "; font-size: 7pt; }

  /* ── Titres ── */
  h1 { font-size: 15pt; font-weight: 700; color: #111827; margin: 26px 0 10px; padding-bottom: 6px; border-bottom: 2px solid var(--border); page-break-after: avoid; }
  h2 { font-size: 12pt; font-weight: 700; color: var(--blue-dk); margin: 20px 0 8px; padding-left: 10px; border-left: 4px solid var(--blue); page-break-after: avoid; display: flex; align-items: center; gap: 8px; }
  h2 .badge { font-size: 8pt; font-weight: 500; background: var(--blue-lt); color: var(--blue); padding: 2px 8px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; white-space: nowrap; }

  /* ── Paragraphes ── */
  p { margin: 6px 0 8px; }
  section.intro { margin-bottom: 20px; padding: 14px 16px; background: #f9fafb; border-radius: 6px; border: 1px solid var(--border); }
  section.intro p { margin: 4px 0; }

  /* ── Code ── */
  code {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 8.2pt;
    background: var(--bg-code);
    padding: 1px 5px;
    border-radius: 3px;
    color: #be185d;
    border: 1px solid #e5e7eb;
  }

  pre {
    background: var(--code-bg);
    border-radius: 6px;
    padding: 12px 15px;
    margin: 8px 0 12px;
    page-break-inside: avoid;
    border-left: 4px solid var(--blue);
    overflow: hidden;
  }
  pre code {
    font-size: 7.8pt;
    background: none; border: none; padding: 0;
    color: var(--code-fg);
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Coloration syntaxique minimaliste */
  pre code .kw  { color: #cba6f7; } /* keywords */
  pre code .fn  { color: #89b4fa; } /* functions */
  pre code .str { color: #a6e3a1; } /* strings */
  pre code .cmt { color: #585b70; } /* comments */
  pre code .num { color: #fab387; } /* numbers */

  /* ── Listes ── */
  ul, ol { margin: 6px 0 10px 1.4em; }
  li { margin: 3px 0; }

  /* ── Callout boxes ── */
  .callout {
    margin: 10px 0 14px;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  .callout strong { display: block; margin-bottom: 4px; font-size: 9.5pt; }
  .callout ul { margin: 4px 0 0 1.2em; }
  .callout li { margin: 2px 0; }

  .callout.warning { background: #fffbeb; border-left: 3px solid #f59e0b; color: #78350f; }
  .callout.info    { background: #eff6ff; border-left: 3px solid var(--blue); color: #1e3a8a; }
  .callout.success { background: #f0fdf4; border-left: 3px solid var(--success); color: #14532d; }

  /* ── Architecture diagram ── */
  .arch-diagram {
    display: flex;
    align-items: stretch;
    gap: 0;
    margin: 12px 0;
    page-break-inside: avoid;
  }
  .arch-box {
    flex: 1;
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 9pt;
  }
  .process-main     { background: #eff6ff; border: 2px solid var(--blue); }
  .process-renderer { background: #f0fdf4; border: 2px solid var(--success); }
  .arch-title { font-weight: 700; font-size: 10pt; margin-bottom: 8px; }
  .arch-title span { display: block; font-family: 'JetBrains Mono', monospace; font-size: 8pt; font-weight: 400; opacity: .7; }
  .arch-box ul { margin-left: 1em; }
  .arch-box li { margin: 3px 0; font-size: 8.5pt; }

  .arch-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    min-width: 120px;
  }
  .arrow-line { width: 100%; height: 2px; background: var(--gray); margin: 6px 0; position: relative; }
  .arrow-line::after { content: '▶'; position: absolute; right: -6px; top: -8px; color: var(--gray); font-size: 10pt; }
  .arrow-label { font-size: 7pt; color: var(--gray); text-align: center; font-family: 'JetBrains Mono', monospace; }

  .arch-preload {
    margin: 8px 0 14px;
    padding: 8px 12px;
    background: #fdf2f8;
    border: 1px solid #fbcfe8;
    border-radius: 6px;
    font-size: 9pt;
    text-align: center;
    color: #831843;
    page-break-inside: avoid;
  }

  /* ── Flow table ── */
  .flow-table { margin: 12px 0; page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { background: var(--blue-dk); color: white; padding: 7px 9px; text-align: left; font-size: 8.5pt; font-weight: 600; }
  td { padding: 6px 9px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }

  /* ── Misc ── */
  strong { font-weight: 700; }
  .page-break { page-break-after: always; }
  hr { border: none; border-top: 1px solid var(--border); margin: 18px 0; }
  a { color: var(--blue); }
</style>
</head>
<body>

<div class="cover-header">
  <div>
    <div class="school-name">Ynov Toulouse</div>
    <div class="school-sub">Bachelor Informatique &amp; MSc Technologies</div>
  </div>
  <div class="cover-meta">
    <div class="meta-author">Jérémy ANGULO</div>
    <div class="meta-info">Enseignant — Développement Desktop</div>
    <span class="cover-badge">Correction</span>
  </div>
</div>

<div class="doc-title-block">
  <div class="tp-label">TP — Technologies Desktop — Correction</div>
  <h1>Intégration Electron<br><small style="font-size:13pt;opacity:.8">Guide d'implémentation feature par feature</small></h1>
  <div class="doc-meta-row">
    <span>Features F1–F12 + Bonus B1–B3</span>
    <span>electron/main.js · preload.js</span>
    <span>Document enseignant</span>
  </div>
</div>

${SOLUTION_CONTENT}

</body>
</html>`;

// ── Coloration syntaxique simple ──────────────────────────────────────────────
// (on applique des classes sur les mots-clés après le fait)
const colorized = html.replace(
  /<code class="language-(javascript|json|bash|css)">([\s\S]*?)<\/code>/g,
  (_match, lang, code) => {
    let c = code;
    if (lang === 'javascript' || lang === 'json') {
      c = c
        .replace(/\/\/.*/g,           m => `<span class="cmt">${m}</span>`)
        .replace(/\b(const|let|var|function|async|await|return|if|else|new|require|true|false|null|undefined|this|class|extends|export|import|from|of|in|for|switch|case|break|throw|try|catch|delete)\b/g,
                 m => `<span class="kw">${m}</span>`)
        .replace(/'([^'\\]|\\.)*'|"([^"\\]|\\.)*"|`([^`\\]|\\.)*`/g,
                 m => `<span class="str">${m}</span>`)
        .replace(/\b(\d+)\b/g, m => `<span class="num">${m}</span>`);
    }
    if (lang === 'css') {
      c = c
        .replace(/\/\*[\s\S]*?\*\//g, m => `<span class="cmt">${m}</span>`)
        .replace(/(-webkit-app-region|display|background|border|color|font-size|position|width|height)/g,
                 m => `<span class="fn">${m}</span>`);
    }
    return `<code class="language-${lang}">${c}</code>`;
  }
);

// ── Export PDF ────────────────────────────────────────────────────────────────
// Écrire sur le filesystem Windows pour que Chrome puisse le lire via file:///C:/
const tmpHtml = '/mnt/c/Users/Jerem/AppData/Local/Temp/tp-electron-solution.html';
const htmlUrl = 'file:///C:/Users/Jerem/AppData/Local/Temp/tp-electron-solution.html';
const pdfWin  = 'C:\\Users\\Jerem\\OneDrive\\Desktop\\TP-Electron-Correction.pdf';
const chrome  = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';

writeFileSync(tmpHtml, colorized, 'utf-8');
console.log('✓ HTML solution généré');

try {
  execSync(
    `"${chrome}" --headless=new --disable-gpu --no-sandbox \
      --print-to-pdf="${pdfWin}" \
      --print-to-pdf-no-header \
      "${htmlUrl}" 2>&1`,
    { timeout: 30000, stdio: 'inherit' }
  );
  console.log(`✓ PDF Correction → ${pdfWin}`);
} catch (e) {
  console.error('Erreur:', e.message);
  process.exit(1);
}
