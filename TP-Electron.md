# TP — Intégration Electron / Tauri

**Durée estimée :** 3h  
**Rendu :** lien vers votre dépôt GitHub (repository public ou privé avec accès enseignant)

---

## Contexte

Les applications web modernes tournent dans un bac à sable navigateur : pas d'accès au système de fichiers, pas de menus natifs, pas de notifications OS. Pour distribuer une application web sous forme d'application desktop, deux solutions dominent aujourd'hui :

- **Electron** — embarque Chromium + Node.js dans un binaire. Utilisé par VS Code, Slack, Discord, Notion, Figma.
- **Tauri** — utilise le WebView natif de l'OS + Rust en backend. Plus léger, plus proche du système.

Dans les deux cas, le principe est le même : votre code frontend web tourne tel quel, et vous gagnez l'accès à des APIs natives via un mécanisme de communication sécurisé (IPC).

---

## Application de base — Markdownitor

Vous travaillez à partir d'un éditeur Markdown existant : **Markdownitor**.

> **Repository de base :** `https://github.com/<à-compléter>/markdownitor`  
> Forkez ce dépôt et travaillez sur votre fork.

L'application est déjà fonctionnelle en mode navigateur. Elle dispose d'une prévisualisation Markdown en temps réel, d'une barre d'outils, et d'une barre de statut. Elle inclut aussi la **détection automatique du contexte** : si `window.electronAPI` est exposé par un preload script, l'application bascule en mode desktop et active les fonctionnalités natives.

Votre travail : **intégrer Electron ou Tauri** pour que ces fonctionnalités native deviennent réelles.

---

## Ressources

Toutes les informations nécessaires sont dans la documentation officielle :

- Electron : https://www.electronjs.org/docs/latest
- Tauri : https://tauri.app/start/
- API fichiers Node.js (`fs`) : https://nodejs.org/api/fs.html
- `contextBridge` / IPC Electron : https://www.electronjs.org/docs/latest/tutorial/ipc

---

## Ce que vous devez livrer

Votre dépôt doit contenir l'application web de base **plus** l'intégration Electron ou Tauri. Le README doit expliquer comment lancer le projet en mode développement.

---

## Grille de validation

### Fondations

| # | Fonctionnalité | Critère de validation |
|---|---|---|
| F1 | Fenêtre Electron/Tauri | L'application se lance en tant qu'app desktop (pas un onglet navigateur) |
| F2 | Chargement de l'app web | L'éditeur Markdown est visible et fonctionnel dans la fenêtre |
| F3 | Mode détecté | La barre de statut affiche "Mode Electron" (ou Tauri) au lieu du warning navigateur |
| F4 | DevTools accessibles | On peut ouvrir les DevTools depuis l'app en mode développement |

### Fichiers natifs

| # | Fonctionnalité | Critère de validation |
|---|---|---|
| F5 | Ouvrir un fichier | Cliquer "Ouvrir" affiche un dialogue natif OS et charge le fichier `.md` dans l'éditeur |
| F6 | Enregistrer | `Ctrl+S` enregistre le fichier sur le disque (sans dialogue si déjà nommé) |
| F7 | Enregistrer sous | Un dialogue natif permet de choisir l'emplacement et le nom du fichier |
| F8 | Titre de fenêtre | Le titre de la fenêtre reflète le nom du fichier courant |

### Intégration OS

| # | Fonctionnalité | Critère de validation |
|---|---|---|
| F9  | Menu natif | L'application possède un menu natif (Fichier, Édition, Affichage…) avec des raccourcis clavier |
| F10 | Confirmation fermeture | Fermer la fenêtre avec des modifications non enregistrées affiche une boîte de confirmation |
| F11 | Notification OS | Une notification système s'affiche après un enregistrement réussi |
| F12 | System Tray | Une icône apparaît dans la zone de notification ; un menu contextuel permet de rouvrir l'app ou de quitter |

### Bonus

| # | Fonctionnalité | Critère de validation |
|---|---|---|
| B1 | Packaging | L'application peut être compilée en binaire distribuable (`.exe`, `.dmg` ou `.AppImage`) |
| B2 | Fenêtre sans cadre | La fenêtre utilise un `titlebar` HTML personnalisé (frame natif désactivé) avec drag fonctionnel |
| B3 | Fichiers récents | Le menu "Fichier" liste les derniers fichiers ouverts et permet de les recharger |
| B4 | Tauri (alternative) | L'intégration est réalisée avec Tauri plutôt qu'Electron — indiquer dans le README les différences observées |

---

## Conseils

- Lisez `app/src/main.js` avant de commencer : tous les appels `window.electronAPI` sont déjà en place, il n'y a qu'à les brancher.
- Commencez par F1 → F4 avant de toucher aux fichiers ou au menu.
- La documentation Electron sur `contextBridge` et `ipcMain` / `ipcRenderer` est essentielle pour F5–F8.
- Pour le tray (F12), cherchez `Tray` dans la doc Electron.
- Tauri suit la même logique mais les APIs sont différentes — la doc Tauri sur les `commands` est l'équivalent de l'IPC Electron.
