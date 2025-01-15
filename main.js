// main.js
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const iohook = require('iohook');
const ioHook = require('iohook');
const path = require('path');

let mainWindow;
let isRecording = false;
let clickEvents = [];
let recordingStartTime;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
mainWindow.webContents.openDevTools();
  mainWindow.loadFile('index.html');
}

let clickedonce = false;
// Handle mouse clicks globally
ioHook.on('mouseclick', event => {
  clickedonce = true;

  
});

iohook.on('mousemove',event=>{
  if (isRecording && clickedonce) {
    mainWindow.webContents.send('mousemove',event)
  }
 

})


// Start recording
ipcMain.handle('start-recording', () => {
  
  clickEvents = [];
  isRecording = true;

  recordingStartTime = Date.now();
});

// Stop recording
ipcMain.handle('stop-recording', () => {
  clickedonce = false;
  isRecording = false;

  
});

// Get screen sources
ipcMain.handle('get-sources', async () => {
  try {
      const sources = await desktopCapturer.getSources({ 
          types: ['screen', 'window']
      });
      
      // Return only the necessary, clonable data
      return sources.map(source => ({
          id: source.id,
          name: source.name,
          display_id: source.display_id,
          thumbnail: source.thumbnail.toDataURL()
      }));
  } catch (error) {
      console.error('Error getting sources:', error);
      return [];
  }
});


app.whenReady().then(() => {
  createWindow();
  // Register global keyboard and mouse hooks
  ioHook.start();
});

app.on('window-all-closed', () => {
  ioHook.unload(); // Unload iohook
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});