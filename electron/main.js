const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Notification,
} = require("electron");
const path = require("path");
const fs = require("fs").promises;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../app/dist/index.html"));
  }

  // Gestion de la fermeture avec confirmation (si sale)
  win.on("close", (e) => {
    if (win.isForceClosing) return;
    e.preventDefault();
    win.webContents.send("window:before-close");
  });

  // Permettre l'envoi d'actions de menu vers le rendu
  win.onMenuAction = (action) => {
    win.webContents.send("menu-action", action);
  };
}

// ─── Handlers IPC ────────────────────────────────────────────────────────────

ipcMain.on("window:confirm-close", (event, allow) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && allow) {
    win.isForceClosing = true;
    win.close();
  }
});
ipcMain.on("window:toast", (_event, message, type) => {
  const n = new Notification({
    title: "Notification",
    subtitle: type,
    body: message,
  });

  n.show();
});
ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md", "txt", "markdown"] }],
  });

  if (canceled) return null;

  const content = await fs.readFile(filePaths[0], "utf-8");
  return { path: filePaths[0], content };
});

ipcMain.handle(
  "dialog:saveFile",
  async (event, { path: filePath, content }) => {
    await fs.writeFile(filePath, content, "utf-8");
    return true;
  },
);

ipcMain.handle("dialog:saveFileAs", async (event, { content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });

  if (canceled) return null;

  await fs.writeFile(filePath, content, "utf-8");
  return { path: filePath };
});

ipcMain.on("window:setModified", (event, modified) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setDocumentEdited(modified); // macOS principalement
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
