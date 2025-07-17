let audioContext, sourceNode, omnitoneDecoder, audioBuffer;
let isPlaying = false;
let orientationEnabled = false;
let currentYaw = 0, currentPitch = 0, currentRoll = 0;

const playSampleButton = document.getElementById('playSampleButton');
const stopButton = document.getElementById('stopButton');
const enableOrientationBtn = document.getElementById('enableOrientation');
const resetOrientationBtn = document.getElementById('resetOrientation');
const orientationStatus = document.getElementById('orientationStatus');
const yawSlider = document.getElementById('yawSlider');
const pitchSlider = document.getElementById('pitchSlider');
const rollSlider = document.getElementById('rollSlider');
const yawValue = document.getElementById('yawValue');
const pitchValue = document.getElementById('pitchValue');
const rollValue = document.getElementById('rollValue');
const currentYawSpan = document.getElementById('currentYaw');
const currentPitchSpan = document.getElementById('currentPitch');
const currentRollSpan = document.getElementById('currentRoll');
const audioInfo = document.getElementById('audioInfo');

function updateOrientationDisplay() {
  currentYawSpan.textContent = `${currentYaw}°`;
  currentPitchSpan.textContent = `${currentPitch}°`;
  currentRollSpan.textContent = `${currentRoll}°`;
  yawValue.textContent = `${currentYaw}°`;
  pitchValue.textContent = `${currentPitch}°`;
  rollValue.textContent = `${currentRoll}°`;
}

function setRotation(yaw, pitch, roll) {
  currentYaw = Math.round(yaw);
  currentPitch = Math.round(pitch);
  currentRoll = Math.round(roll);
  if (omnitoneDecoder) {
    // Omnitone expects yaw, pitch, roll in radians
    omnitoneDecoder.setRotation(
      yaw * Math.PI / 180,
      pitch * Math.PI / 180,
      roll * Math.PI / 180
    );
  }
  updateOrientationDisplay();
}

function resetOrientation() {
  setRotation(0, 0, 0);
  yawSlider.value = 0;
  pitchSlider.value = 0;
  rollSlider.value = 0;
}

function enableManualControls() {
  yawSlider.disabled = false;
  pitchSlider.disabled = false;
  rollSlider.disabled = false;
}

function disableManualControls() {
  yawSlider.disabled = true;
  pitchSlider.disabled = true;
  rollSlider.disabled = true;
}

async function playSample() {
  if (isPlaying) {
    // If already playing, stop first
    stopPlayback();
  }
  
  const sampleUrl = 'audio/sample.wav';
  try {
    console.log('Starting to load sample from:', sampleUrl);
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('AudioContext state:', audioContext.state);
    
    const response = await fetch(sampleUrl);
    console.log('Fetch response status:', response.status, response.ok);
    if (!response.ok) throw new Error('Failed to fetch sample audio');
    const arrayBuffer = await response.arrayBuffer();
    console.log('ArrayBuffer size:', arrayBuffer.byteLength);
    
    console.log('About to decode audio data...');
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log('Decoded sample:', audioBuffer);
    console.log('AudioBuffer details - length:', audioBuffer.length, 'duration:', audioBuffer.duration, 'channels:', audioBuffer.numberOfChannels, 'sampleRate:', audioBuffer.sampleRate);
    
    audioInfo.textContent = `sample.wav (${Math.round(audioBuffer.duration)}s, ${audioBuffer.numberOfChannels}ch)`;
    
    if (omnitoneDecoder && typeof omnitoneDecoder.dispose === 'function') {
      console.log('Disposing previous omnitoneDecoder');
      omnitoneDecoder.dispose();
    }
    
    console.log('Creating FOARenderer for sample...');
    try {
      omnitoneDecoder = Omnitone.createFOARenderer(audioContext);
      console.log('Calling omnitoneDecoder.initialize()...');
      let initTimedOut = false;
      const timeout = setTimeout(() => {
        initTimedOut = true;
        console.warn('FOARenderer initialization is taking too long or is stuck.');
      }, 5000); // 5 seconds
      await omnitoneDecoder.initialize();
      clearTimeout(timeout);
      if (!initTimedOut) {
        console.log('FOARenderer initialized successfully');
        startPlayback();
      }
    } catch (err) {
      console.error('FOARenderer initialization failed:', err);
      omnitoneDecoder = null;
      audioInfo.textContent += ' (Omnitone initialization failed)';
    }
  } catch (err) {
    console.error('Failed to load or decode sample audio:', err);
    audioInfo.textContent = 'Failed to load sample.wav';
  }
}

async function startPlayback() {
  if (!audioBuffer || !omnitoneDecoder) {
    console.warn('No audioBuffer or omnitoneDecoder');
    return;
  }
  
  console.log('=== STARTING PLAYBACK ===');
  console.log('About to play:', audioBuffer, omnitoneDecoder);
  console.log('AudioContext state before resume:', audioContext.state);
  
  // Resume audio context if it's suspended (required for autoplay policy)
  if (audioContext.state === 'suspended') {
    console.log('AudioContext is suspended, resuming...');
    await audioContext.resume();
    console.log('AudioContext resumed, new state:', audioContext.state);
  }

  console.log('Creating source node...');
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  console.log('Source node created with buffer:', sourceNode.buffer);
  
  console.log('Connecting audio graph...');
  sourceNode.connect(omnitoneDecoder.input);
  omnitoneDecoder.output.connect(audioContext.destination);
  console.log('Audio graph connected: sourceNode -> omnitoneDecoder.input -> omnitoneDecoder.output -> destination');
  
  console.log('Starting playback...');
  sourceNode.start();
  console.log('Playback started');
  isPlaying = true;
  playSampleButton.disabled = true;
  stopButton.disabled = false;
  
  sourceNode.onended = () => {
    isPlaying = false;
    playSampleButton.disabled = false;
    stopButton.disabled = true;
    console.log('Playback ended');
  };
}

function stopPlayback() {
  if (audioContext && sourceNode) {
    sourceNode.stop();
    isPlaying = false;
    playSampleButton.disabled = false;
    stopButton.disabled = true;
    console.log('Playback stopped');
  }
}

playSampleButton.addEventListener('click', playSample);
stopButton.addEventListener('click', stopPlayback);

yawSlider.addEventListener('input', (e) => {
  if (!orientationEnabled) setRotation(e.target.value, currentPitch, currentRoll);
});
pitchSlider.addEventListener('input', (e) => {
  if (!orientationEnabled) setRotation(currentYaw, e.target.value, currentRoll);
});
rollSlider.addEventListener('input', (e) => {
  if (!orientationEnabled) setRotation(currentYaw, currentPitch, e.target.value);
});

enableOrientationBtn.addEventListener('click', () => {
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(permissionState => {
      if (permissionState === 'granted') {
        orientationEnabled = true;
        orientationStatus.textContent = 'Orientation: Enabled';
        disableManualControls();
      }
    });
  } else {
    orientationEnabled = true;
    orientationStatus.textContent = 'Orientation: Enabled';
    disableManualControls();
  }
});

resetOrientationBtn.addEventListener('click', () => {
  orientationEnabled = false;
  orientationStatus.textContent = 'Orientation: Disabled';
  enableManualControls();
  resetOrientation();
});

window.addEventListener('deviceorientation', (event) => {
  if (!orientationEnabled) return;
  // alpha: 0-360 (z), beta: -180 to 180 (x), gamma: -90 to 90 (y)
  // We'll use alpha as yaw, beta as pitch, gamma as roll
  setRotation(event.alpha || 0, event.beta || 0, event.gamma || 0);
});

// Initialize
resetOrientation();
enableManualControls();
updateOrientationDisplay(); 