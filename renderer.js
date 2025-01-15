// renderer.js
const { ipcRenderer } = require('electron');
const videoElement = document.querySelector('#videoElement');
const startBtn = document.querySelector('#startBtn');
const stopBtn = document.querySelector('#stopBtn');
const videoSource = document.querySelector('#videoSource');

let mediaRecorder;
let recordedChunks = [];

// Get available video sources
async function getVideoSources() {
    try {
        const sources = await ipcRenderer.invoke('get-sources');
        console.log('Available sources:', sources);
        
       
        videoSource.innerHTML = sources
            .map(source => `<option value="${source.id}">${source.name}</option>`)
            .join('');
    } catch (error) {
        console.error('Error getting sources:', error);
    }
}


// Start recording
async function startRecording() {
    await ipcRenderer.invoke('start-recording');
    const sourceId = videoSource.value;
  
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId
                }
            }
        });

        videoElement.srcObject = stream;

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.onstop = handleStop;

        mediaRecorder.start();
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } catch (error) {
        console.error('Error accessing media devices:', error);
    }
}

// Stop recording
function stopRecording() {
   
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
}

// Handle recorded data
function handleDataAvailable(e) {
    if (e.data.size > 0) {
        recordedChunks.push(e.data);
    }
}

// Save the recording
async function handleStop() {
    const clicks = await ipcRenderer.invoke('stop-recording')
    console.log(clicks);
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `screen-recording-${Date.now()}.webm`;
    
    document.body.appendChild(a);
    a.click();
    
    URL.revokeObjectURL(url);
    recordedChunks = [];
}

// Event listeners
startBtn.onclick = startRecording;
stopBtn.onclick = stopRecording;

// Initialize available sources when the app loads
getVideoSources();