const { ipcRenderer,  } = require('electron');
const videoElement = document.querySelector('#videoElement');
const startBtn = document.querySelector('#startBtn');
const stopBtn = document.querySelector('#stopBtn');
const videoSource = document.querySelector('#videoSource');
const loading =    document.getElementById("loading");

//this all is just to tell ffmpeg fluent where is our ffmpeg binaries.
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static').replace(
  'app.asar',
  'app.asar.unpacked'
);
ffmpeg.setFfmpegPath(ffmpegPath);

let mediaRecorder;
let recordedChunks = [];


//this function is just to get the screen size
  let width = 1920;
  let height = 1080;

  const updatesize = async ()=>{
    
     size = await ipcRenderer.invoke('getscreen')
     width = size.width;
     height = size.height
  }
  updatesize()



//the main juice of this app, this function takes in the mouse click events and then makes and applies the zoom filters and then save it
  async function applyVideoZoom(events,path) {

    //this function took the longest time, this function generates the zoomfilter from the events, THERE WASNT ANY RESOURCE ON THIS 
      function generateZoomFilter(events, options = {}) {
        const {
            outputWidth = 1280,
            outputHeight = 720,
            fps = 30,
            zoomDuration = 1,
            zoomFactor = 2,
            holdDuration = 1  
        } = options;
    
        if (!events || events.length === 0) {
            return 'scale=1280:720';
        }
    
      
        events.sort((a, b) => a.time - b.time);  //just sorting out events just in case
        
        const normalizedEvents = events.map(event => ({
            ...event,
            xRel: Math.round(event.x / outputWidth * 1000) / 1000,
            yRel: Math.round(event.y / outputHeight * 1000) / 1000,
            timeSeconds: Math.round(event.time / 1000 * 1000) / 1000
        }));
    
       //base filter start
        let zExpr = '1';  
        let xExpr = 'iw*0.5-(iw*0.5/zoom)';  
        let yExpr = 'ih*0.5-(ih*0.5/zoom)';  
    
        for (let i = normalizedEvents.length - 1; i >= 0; i--) {
          //here we make the zoom filter for each click and then concatenate it
            const event = normalizedEvents[i]; 
          
            const t1 = 2*( event.timeSeconds) >4?2*( event.timeSeconds)-2.5:2*( event.timeSeconds)-1.5;   //this is when the zoom in start, so its about 1-2 sec before the actual click
            const t2 = t1 + zoomDuration;                    
            const t3 = t2 + holdDuration;                    
            const t4 = t3 + zoomDuration;                    
    
          
            zExpr = `if(between(it, ${t1}, ${t2}), 
                        1+${zoomFactor-1}*sin((it-${t1})*PI/2), 
                        if(between(it, ${t2}, ${t3}), 
                            ${zoomFactor},
                            if(between(it, ${t3}, ${t4}), 
                                ${zoomFactor}-${zoomFactor-1}*sin((it-${t3})*PI/2), 
                                ${zExpr})))`;
    
          
            xExpr = `if(between(it, ${t1}, ${t4}), 
                        iw*${event.xRel}-(iw*${event.xRel}/zoom), 
                        ${xExpr})`;
    
          
            yExpr = `if(between(it, ${t1}, ${t4}), 
                        ih*${event.yRel}-(ih*${event.yRel}/zoom), 
                        ${yExpr})`;
        }
    
      
        zExpr = zExpr.replace(/\s+/g, ' ').trim();
        xExpr = xExpr.replace(/\s+/g, ' ').trim();
        yExpr = yExpr.replace(/\s+/g, ' ').trim();
    
      //this is the final filter string
        return `scale=10*iw:10*ih,zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=1:s=${outputWidth}x${outputHeight}:fps=${fps}`;
    }
      
      


    // the below string is a fliter string which was all i could find from internet, I dissected this, and this saved the app fr 
  //"scale=10*iw:10*ih,zoompan=z='if(between(it, 0, 1), 1+2*sin(it*PI/2), if(between(it, 1, 2), 3,if(between(it, 2, 3), 3-2*sin((it-2)*PI/2), 1)))':x='iw*0.25-(iw*0.25/zoom)':y='ih*0.15-(ih*0.15/zoom)':d=1:s=1280x720:fps=30"


  // this is a long ffmpeg chain
      ffmpeg()
      .input(`${path}/video.webm`)  //input video, the path is a common directory which is shared by both the main and the renderer
      .inputFormat('webm')
      .withVideoFilter("setpts=2.0*PTS") //just to make the video a lil bit slow, i know i can make this customizable, but i am lazy
      .withVideoFilter(generateZoomFilter(events,{outputWidth: width, outputHeight:height})) //applying the zoom filter
      .outputOptions([
        '-movflags', 'frag_keyframe+empty_moov',
        '-pix_fmt', 'yuv420p',
        '-vcodec', 'libx264', 
        '-preset', 'fast'     
      ])  //just smth gpt generated
      .toFormat('mp4')  
      .save(`${path}/output.mp4`)  //saving the file
      .on('start', command => {
        console.log('FFmpeg command:', command);
      })    //just for debugging
      .on('error', (e) => {
        console.log("Error:", e);
        startBtn.disabled = false;
             stopBtn.innerHTML = "Stop"
             loading.style.display = "none";
      })
      .on('progress', (progress) => {
        //this shifts the app to loading state
        console.log(JSON.stringify(progress))
        console.log('Processing: ' + progress.percent + '% done');
        stopBtn.innerHTML = "Processing"
        loading.style.display = "block";
     
      })
      .on('end',async () => {
        //prompts user to download the final video
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = `${path}/output.mp4`;
        a.download = `screen-recording-${Date.now()}.mp4`;

        //this ends the loading state
        loading.style.display = "none";
        document.body.appendChild(a);
        a.click();
        startBtn.disabled = false;
            stopBtn.innerHTML = "Stop Recording"
        console.log("Saved");
      });
    
    
       
    
  }

  //just for debugging
  ipcRenderer.on('show-alert', (event, message) => {
    alert(message); 
  });
  
// this function gets the available video sources, and then make those sources, i know there are other methods, but here we are.
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


//this starts recording
async function startRecording() {
    await ipcRenderer.invoke('start-recording');
    const sourceId = videoSource.value;
  
    //this is the code to acshually capture the screen
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    maxWidth: width,  
            maxHeight: height, 
            maxFrameRate: 60 
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


function stopRecording() {
   
    mediaRecorder.stop();
    stopBtn.disabled = true;
}


function handleDataAvailable(e) {
  //this is pushing the new chunk to the recordedChunks array
    if (e.data.size > 0) {
        recordedChunks.push(e.data);
    }
}


async function handleStop() {
 
    const blob = new Blob(recordedChunks, { type: 'video/webm' }); // we make a blob out of those recorded chunks

    const buffer = Buffer.from( await blob.arrayBuffer() ); //then we make a buffer
    const {clickEvents, path} = await ipcRenderer.invoke('stop-recording',buffer) //then we pass that buffer to the main function to write the file for us

 await applyVideoZoom( clickEvents, path); 
     recordedChunks = []; 


    
 
  
}


startBtn.onclick = startRecording;
stopBtn.onclick = stopRecording;


getVideoSources();