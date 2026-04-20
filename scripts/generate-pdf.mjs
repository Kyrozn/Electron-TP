import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── Lecture du markdown ───────────────────────────────────────────────────────
const mdContent = readFileSync(join(root, 'TP-Electron.md'), 'utf-8');

// ── Conversion Markdown → HTML (parser minimal suffisant pour le TP) ──────────
function mdToHtml(md) {
  let html = md
    // Blocs de code (avant tout le reste)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang || 'text'}">${escHtml(code.trimEnd())}</code></pre>`)
    // Titres
    .replace(/^#{6} (.+)$/gm, '<h6>$1</h6>')
    .replace(/^#{5} (.+)$/gm, '<h5>$1</h5>')
    .replace(/^#{4} (.+)$/gm, '<h4>$1</h4>')
    .replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Hr
    .replace(/^---$/gm, '<hr>')
    // Tableaux
    .replace(/(\|.+\|\n)(\|[-| :]+\|\n)((?:\|.+\|\n?)*)/g, parseTable)
    // Listes à cocher
    .replace(/^- \[x\] (.+)$/gm, '<li class="check checked">$1</li>')
    .replace(/^- \[ \] (.+)$/gm, '<li class="check">$1</li>')
    // Listes ul
    .replace(/((?:^- .+\n?)+)/gm, (m) =>
      '<ul>' + m.replace(/^- (.+)$/gm, '<li>$1</li>') + '</ul>')
    // Listes ol
    .replace(/((?:^\d+\. .+\n?)+)/gm, (m) =>
      '<ol>' + m.replace(/^\d+\. (.+)$/gm, '<li>$1</li>') + '</ol>')
    // Blockquote
    .replace(/((?:^> .+\n?)+)/gm, (m) =>
      '<blockquote>' + m.replace(/^> /gm, '') + '</blockquote>')
    // Inline
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Paragraphes
    .replace(/\n{2,}(?!<)/g, '\n</p>\n<p>')
    ;

  // Envelopper dans des <p> les blocs de texte isolés
  html = html.split('\n').map(line => {
    if (/^<(h[1-6]|ul|ol|li|pre|blockquote|hr|table)/.test(line.trim())) return line;
    if (line.trim() === '' || line.trim() === '</p>' || line.startsWith('<p>')) return line;
    return line;
  }).join('\n');

  return html;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseTable(full, header, sep, body) {
  const parseRow = (row, tag) =>
    '<tr>' + row.trim().replace(/^\||\|$/g, '').split('|')
      .map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';

  const align = sep.trim().replace(/^\||\|$/g, '').split('|').map(c => {
    if (c.trim().startsWith(':') && c.trim().endsWith(':')) return 'center';
    if (c.trim().endsWith(':')) return 'right';
    return 'left';
  });

  const hRows = header.trim().split('\n').map(r => parseRow(r, 'th')).join('\n');
  const bRows = body.trim().split('\n').filter(Boolean).map(r => parseRow(r, 'td')).join('\n');
  return `<table><thead>${hRows}</thead><tbody>${bRows}</tbody></table>`;
}

const bodyHtml = mdToHtml(mdContent);

// ── Template HTML complet ─────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>TP — Intégration Electron — Ynov Toulouse</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');

  :root {
    --blue:    #1a56db;
    --blue-lt: #e8f0fd;
    --gray:    #6b7280;
    --border:  #e5e7eb;
    --bg-code: #f3f4f6;
    --accent:  #dc2626;
    --ynov:    #e84393;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4;
    margin: 18mm 18mm 20mm 18mm;
    @top-left   { content: "Ynov Toulouse — TP Electron"; font-size: 8pt; color: #9ca3af; font-family: Inter, sans-serif; }
    @top-right  { content: "Jérémy ANGULO"; font-size: 8pt; color: #9ca3af; font-family: Inter, sans-serif; }
    @bottom-center { content: counter(page) " / " counter(pages); font-size: 8pt; color: #9ca3af; font-family: Inter, sans-serif; }
  }

  body {
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #111827;
    background: white;
  }

  /* ── Header de couverture ── */
  .cover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 0 14px;
    border-bottom: 3px solid var(--ynov);
    margin-bottom: 32px;
  }

  .cover-school {
    display: flex;
    flex-direction: column;
  }

  .cover-school .school-name {
    font-size: 18pt;
    font-weight: 700;
    color: var(--ynov);
    letter-spacing: -0.5px;
  }

  .cover-school .school-sub {
    font-size: 9pt;
    color: var(--gray);
    font-weight: 500;
    letter-spacing: 0.3px;
  }

  .cover-meta {
    text-align: right;
  }

  .cover-meta .meta-author {
    font-size: 11pt;
    font-weight: 600;
    color: #111827;
  }

  .cover-meta .meta-info {
    font-size: 8.5pt;
    color: var(--gray);
    margin-top: 2px;
  }

  .cover-badge {
    display: inline-block;
    background: var(--blue-lt);
    color: var(--blue);
    font-size: 8pt;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 20px;
    margin-top: 5px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* ── Titre du document ── */
  .doc-title-block {
    margin-bottom: 28px;
    padding: 20px 24px;
    background: linear-gradient(135deg, #1e3a8a 0%, #1a56db 100%);
    border-radius: 8px;
    color: white;
  }

  .doc-title-block .tp-label {
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    opacity: 0.7;
    margin-bottom: 6px;
  }

  .doc-title-block h1 {
    font-size: 20pt;
    font-weight: 700;
    border: none;
    padding: 0;
    color: white;
    line-height: 1.2;
    margin-bottom: 10px;
  }

  .doc-meta-row {
    display: flex;
    gap: 20px;
    font-size: 8.5pt;
    opacity: 0.85;
    flex-wrap: wrap;
  }

  .doc-meta-row span::before { content: "◆ "; font-size: 7pt; }

  /* ── Titres ── */
  h1 {
    font-size: 16pt;
    font-weight: 700;
    color: #111827;
    margin: 28px 0 10px;
    padding-bottom: 6px;
    border-bottom: 2px solid var(--border);
    page-break-after: avoid;
  }

  h2 {
    font-size: 13pt;
    font-weight: 700;
    color: #1e3a8a;
    margin: 22px 0 8px;
    padding-left: 10px;
    border-left: 4px solid var(--blue);
    page-break-after: avoid;
  }

  h3 {
    font-size: 11pt;
    font-weight: 600;
    color: #374151;
    margin: 16px 0 6px;
    page-break-after: avoid;
  }

  h4 {
    font-size: 10.5pt;
    font-weight: 600;
    color: var(--gray);
    margin: 12px 0 4px;
  }

  /* ── Paragraphes ── */
  p { margin: 6px 0 8px; }

  /* ── Code ── */
  code {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 8.5pt;
    background: var(--bg-code);
    padding: 1px 5px;
    border-radius: 3px;
    color: #be185d;
    border: 1px solid #e5e7eb;
  }

  pre {
    background: #1e1e2e;
    border-radius: 6px;
    padding: 14px 16px;
    margin: 10px 0 14px;
    overflow: hidden;
    page-break-inside: avoid;
    border-left: 4px solid var(--blue);
  }

  pre code {
    font-size: 8pt;
    background: none;
    border: none;
    padding: 0;
    color: #cdd6f4;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* ── Listes ── */
  ul, ol {
    margin: 6px 0 10px 1.4em;
  }

  li { margin: 3px 0; }

  li.check { list-style: none; margin-left: -1em; }
  li.check::before { content: "☐ "; color: var(--gray); }
  li.check.checked::before { content: "☑ "; color: var(--blue); }

  /* ── Blockquote ── */
  blockquote {
    border-left: 4px solid #f59e0b;
    background: #fffbeb;
    padding: 10px 14px;
    margin: 10px 0;
    border-radius: 0 6px 6px 0;
    font-style: italic;
    color: #78350f;
    page-break-inside: avoid;
  }

  /* ── Tables ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 16px;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }

  th {
    background: #1e3a8a;
    color: white;
    padding: 7px 10px;
    text-align: left;
    font-weight: 600;
    font-size: 9pt;
  }

  td {
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
  }

  tr:nth-child(even) td { background: #f9fafb; }

  /* ── HR ── */
  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 20px 0;
  }

  /* ── Liens ── */
  a { color: var(--blue); }

  /* ── Strong / em ── */
  strong { font-weight: 700; }
  em { font-style: italic; color: #374151; }

  /* ── Sauts de page ── */
  h1 { page-break-before: auto; }
  h2 { page-break-before: auto; }
</style>
</head>
<body>

<!-- En-tête Ynov -->
<div class="cover-header">
  <div class="cover-school">
    <span class="school-name">Ynov Toulouse</span>
    <span class="school-sub">Bachelor Informatique &amp; MSc Technologies</span>
  </div>
  <div class="cover-meta">
    <div class="meta-author">Jérémy ANGULO</div>
    <div class="meta-info">Enseignant — Développement Desktop</div>
    <span class="cover-badge">Travaux Pratiques</span>
  </div>
</div>

<!-- Titre document -->
<div class="doc-title-block">
  <div class="tp-label">TP — Technologies Desktop</div>
  <h1>Intégration Electron<br><small style="font-size:13pt;opacity:.8">Du Web vers le Bureau</small></h1>
  <div class="doc-meta-row">
    <span>Durée : 3 heures</span>
    <span>Niveau : Intermédiaire</span>
    <span>Rendu : dépôt GitHub</span>
  </div>
</div>

${bodyHtml.replace(/<h1>.*?<\/h1>/, '')}

</body>
</html>`;

// ── Écriture du HTML temporaire (chemin WSL lisible par Chrome Windows) ──────
// Écrire sur le filesystem Windows pour que Chrome puisse le lire via file:///C:/
const tmpHtml    = '/mnt/c/Users/Jerem/AppData/Local/Temp/tp-electron.html';
const htmlWinUrl = 'file:///C:/Users/Jerem/AppData/Local/Temp/tp-electron.html';
const pdfWin     = 'C:\\Users\\Jerem\\OneDrive\\Desktop\\TP-Electron-Ynov.pdf';
const chrome     = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';

writeFileSync(tmpHtml, html, 'utf-8');
console.log('✓ HTML généré');

// ── Conversion PDF via Chrome headless ───────────────────────────────────────
try {
  execSync(
    `"${chrome}" --headless=new --disable-gpu --no-sandbox \
      --print-to-pdf="${pdfWin}" \
      --print-to-pdf-no-header \
      "${htmlWinUrl}" 2>&1`,
    { timeout: 30000, stdio: 'inherit' }
  );
  console.log(`✓ PDF disponible sur le bureau Windows : ${pdfWin}`);
} catch (e) {
  console.error('Erreur Chrome:', e.message);
  process.exit(1);
}
