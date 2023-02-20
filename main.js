const { app, BrowserWindow, ipcMain } = require('electron');
if (require('electron-squirrel-startup')) app.quit();
try {
    if (require.resolve("electron-reload")) require("electron-reload")(__dirname);
} catch (error) { /* empty */ }
const path = require('path');
const WebSocketClient = require('websocket').client;
const client = new WebSocketClient();
const JSON = require('JSON');
const IDs = {};
const API_KEY = "pFHo7hTo8CLNlrVriMiD9lhcicrpRkEx4PskvKGovJYhvVdxmvtr3jmgSfp1IXUk";
const API_URL = "wss://app.hyperate.io/socket/websocket?token=" + API_KEY;
const hearthbeat = JSON.stringify({
    "topic": "phoenix",
    "event": "heartbeat",
    "payload": {},
    "ref": 0
});
let mainWindow;
let connectionSocket;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 100,
        height: 100,
        frame: false,
        resizable: false,
        autoHideMenuBar: true,
        transparent: true,
        alwaysOnTop: true,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
    })

    ipcMain.on("close-app", () => mainWindow.close())
    ipcMain.on("add-tracker", (event, data) => {
        addHeartRateTracker(data.ID, data.name);
    });

    mainWindow.loadFile('index.html')
    // Open the DevTools.
    // mainWindow.webContents.openDevTools({ mode: 'undocked' })

    client.connect(API_URL);

    setInterval(() => {
        updateHeartRate();
    }, 30 * 1000);
}
app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

client.on('connectFailed', function (error) {
    console.log('Connect Error: ' + error.toString());
});

client.on('connect', function (connection) {
    connectionSocket = connection;
    console.log('Client Connected');
    client.on('error', function (error) {
        console.log('Connect Error: ' + error.toString());
    });
    connection.on("close", function () {
        console.log("Connection Closed");
        client.connect(API_URL);
    });
    connection.on("message", function (message) {
        if (!message.type === "utf8") {
            return console.error("Message is not of type \"UTF8\"");
        }
        try {
            message.utf8Data = JSON.parse(message.utf8Data);

            onMessage(message);
        } catch (error) {
            console.log(JSON.stringify(message));
            return console.error("Unprocessed request due to crappy parse: " + error);
        }
    });
    Object.keys(IDs).forEach((ID) => {
        connection.sendUTF(JSON.stringify({
            "topic": "hr:" + ID,
            "event": "phx_join",
            "payload": {},
            "ref": 0
        }));
    });

    setInterval(() => {
        connection.sendUTF(hearthbeat);
    }, 30 * 1000);
});

async function onMessage(message) {
    switch (message.utf8Data.event) {
        case "phx_reply":
            onPhxReply(message.utf8Data);
            break;
        case "hr_update":
            onHrUpdate(message.utf8Data);
            break;
        default:
            break;
    }
    debugMessages(message);
}

async function debugMessages(message) {
    console.info("[" + message.utf8Data.event + "] " + JSON.stringify(message));
}

// {"type":"utf8","utf8Data":{"event":"phx_reply","payload":{"response":{},"status":"ok"},"ref":0,"topic":"hr:Rhl"}}
async function onPhxReply(data) {
    try {
        console.log("[" + data.topic + "] status " + data.payload.status);
    } catch (error) {
        console.log(JSON.stringify(data));
        return console.error(error);
    }
}

// {"type":"utf8","utf8Data":{"event":"hr_update","payload":{"hr":59},"ref":null,"topic":"hr:Rhl"}}
async function onHrUpdate(data) {
    try {
        let ID = data.topic.split(":")[1];
        IDs[ID].lastUpdate = Date.now();
        IDs[ID].lastHeartrate = data.payload.hr;
    } catch (error) {
        console.log(JSON.stringify(data));
        return console.error(error);
    }
    updateHeartRate();
}

async function addHeartRateTracker(ID, name) {
    IDs[ID] = {
        name,
        lastUpdate: 0,
        lastHeartrate: 0,
    };

    try {
        if (connectionSocket.connected) {
            connectionSocket.sendUTF(JSON.stringify({
                "topic": "hr:" + ID,
                "event": "phx_join",
                "payload": {},
                "ref": 0
            }));
        }
    } catch (error) {
        return console.error(error);
    }
    updateHeartRate();
}

async function updateHeartRate() {
    mainWindow.webContents.send('update-heart-rate', IDs);
}