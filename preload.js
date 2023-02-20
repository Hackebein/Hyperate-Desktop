const { contextBridge, ipcRenderer } = require("electron")

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const dependency of ['chrome', 'node', 'electron']) {
        replaceText(`${dependency}-version`, process.versions[dependency])
    }
})

contextBridge.exposeInMainWorld("api", {
    close: () => ipcRenderer.send("close-app"),
    addTracker: (ID, name) => ipcRenderer.send("add-tracker", { ID, name }),
    onHeartRateUpdate: (callback) => ipcRenderer.on('update-heart-rate', callback),
})