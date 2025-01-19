const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');

const ioHook = require('iohook');

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
let mainWindow;
let isRecording = false;
let clickEvents = [];
let recordingStartTime;


const ffmpegPath = require('ffmpeg-static').replace(
  'app.asar',
  'app.asar.unpacked'
);

ffmpeg.setFfmpegPath(ffmpegPath);





function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}



ioHook.on('mouseclick', event => {
  clickEvents.push({ ...event, time: Date.now() - recordingStartTime });


});




// this is just to start capturing the clicks and start our timer
ipcMain.handle('start-recording', () => {

  clickEvents = [];
  isRecording = true;

  recordingStartTime = Date.now();
});

//this is to get out screen size
ipcMain.handle('getscreen', () => {
  const primaryDisplay = screen.getPrimaryDisplay();

  return {
    height: primaryDisplay.size.height,
    width: primaryDisplay.size.width
  }
})

// saves the buffer and then returns all the click events
ipcMain.handle('stop-recording', (event, buffer) => {
 
  isRecording = false;
  fs.writeFile(`${app.getPath("userData")}/video.webm`, buffer, () => console.log('video saved!'));

  return {
    clickEvents: clickEvents,
    path: `${app.getPath("userData")}`
  }

});

// Get screen sources
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window']
    });

    
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

  // Register global mouse hooks
  ioHook.start();
  mainWindow.webContents.openDevTools();
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