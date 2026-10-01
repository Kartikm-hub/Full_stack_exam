const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentAPI", {
  getState: () => ipcRenderer.invoke("get-agent-state"),

  endFocus: () => ipcRenderer.invoke("end-focus"),

  quit: () => ipcRenderer.invoke("quit-agent"),

  onStateChange: (callback) => {
    ipcRenderer.on("agent-state", (_event, state) => {
      callback(state);
    });
  }
});
