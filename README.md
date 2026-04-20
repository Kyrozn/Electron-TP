# Markdownitor — Base TP Electron

Application web **Markdownitor** servant de base pour le TP d'intégration Electron.

## Lancer l'app web seule

```bash
cd app
npm install
npm run dev
```

→ Ouvre http://localhost:5173

## Lancer avec Electron (après le TP)

```bash
# Racine du projet
npm install
npm run dev
```

## Structure

```
├── app/                  ← Application web (Vite + JS vanilla)
│   ├── src/
│   │   ├── main.js       ← Logique app (appels window.electronAPI déjà en place)
│   │   └── style.css
│   ├── index.html
│   └── package.json
├── electron/             ← À CRÉER pendant le TP
│   ├── main.js
│   └── preload.js
├── TP-Electron.md        ← Énoncé du TP
└── package.json
```

## Le dossier `electron/` est vide intentionnellement — c'est votre travail !
