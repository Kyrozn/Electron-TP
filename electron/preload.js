const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  saveFile: (data) => ipcRenderer.invoke("dialog:saveFile", data),
  saveFileAs: (data) => ipcRenderer.invoke("dialog:saveFileAs", data),
  setWindowModified: (modified) =>
    ipcRenderer.send("window:setModified", modified),

  // Ecouteurs d'événements provenant du processus principal
  onMenuAction: (callback) => {
    ipcRenderer.on("menu-action", (_event, action) => callback(action));
  },
  onBeforeClose: (callback) => {
    ipcRenderer.on("window:before-close", () => callback());
  },
  confirmClose: (allow) => {
    ipcRenderer.send("window:confirm-close", allow);
  },
  toast: (message, type = "success") => {
    ipcRenderer.send("window:toast", message, type);
  },
});
