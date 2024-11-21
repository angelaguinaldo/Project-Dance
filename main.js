// DOM Elements
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const scoreElement = document.getElementById('score');
const pausePlayButton = document.getElementById('pause-play');
const muteUnmuteButton = document.getElementById('mute-unmute');
const modeSelector = document.getElementById('mode');
const toggleButton = document.getElementById('toggle-dashboard');
const dashboard = document.getElementById('dashboard');
const mainContent = document.getElementById('main-content');
const pauseOverlay = document.getElementById('pause-overlay'); // The overlay that shows up when the game is paused
const gameModeDescription = document.getElementById('game-mode-description'); // Where we display the description of the current game mode

// State Variables
let isDashboardOpen = false;
let isMuted = false;  // Are we muted or not?
let isPaused = false;  // Is the game currently paused?
let score = 0;
let currentMode = 'game';
let currentVolume = 1;
let lastNote = null;
let isPlayingNote = false;
let noteDebounce = false;  // To prevent rapid note changes

// Initialize Enemy Position
function initializeEnemyPosition() {
    // Place the enemy at a random position within the canvas boundaries
    x_enemy = getRandomInt(25, canvasElement.width - 25);
    y_enemy = getRandomInt(25, canvasElement.height - 25);
}
let x_enemy, y_enemy;
initializeEnemyPosition();

function initializeTargetLandmarks(){
    Ax = Math.floor(((1/3)*(canvasElement.width-50))+25);
    Ay = Math.floor(((1/3)*(canvasElement.height-50))+25);
    Bx = Math.floor(((2/3)*(canvasElement.width-50))+25);
    By = Math.floor(((1/3)*(canvasElement.height-50))+25);
    Cx = Math.floor((canvasElement.width-50)+25);
    Cy = Math.floor(((1/3)*(canvasElement.height-50))+25);

    Dx = Math.floor(((1/3)*(canvasElement.width-50))+25);
    Dy = Math.floor(((2/3)*(canvasElement.height-50))+25);
    Ex = Math.floor(((2/3)*(canvasElement.width-50))+25);
    Ey = Math.floor(((2/3)*(canvasElement.height-50))+25);
    Fx = Math.floor((canvasElement.width-50)+25);
    Fy = Math.floor(((2/3)*(canvasElement.height-50))+25);

    Gx = Math.floor(((1/3)*(canvasElement.width-50))+25);
    Gy = Math.floor((canvasElement.height-50)+25);
    Hx = Math.floor(((2/3)*(canvasElement.width-50))+25);
    Hy = Math.floor((canvasElement.height-50)+25);
    Ix = Math.floor((canvasElement.width-50)+25);
    Iy = Math.floor((canvasElement.height-50)+25);
}

let Ax,Bx,Cx,Dx,Ex,Fx,Gx,Hx,Ix;
let Ay,By,Cy,Dy,Ey,Fy,Gy,Hy,Iy;
initializeTargetLandmarks();

const targetArr = [[Ax,Ay],[Bx,By], [Cx,Cy], [Dx,Dy],[Ex,Ey], [Fx,Fy], [Gx,Gy],[Hx,Hy], [Ix,Iy]]

// Variables for active hand selection in hand tracking mode
let activeHandLabel = null;
let needToSelectActiveHand = true;

// Variables for active limb selection in full body tracking mode
let activeLimbIndex = null;
let needToSelectActiveLimb = true;

// Web Audio API setup for game mode (used for hand tracking game mode)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let oscillator = null;
let gainNode = null;  // We'll use this to control the volume in game mode

// Tone.js setup for keyboard mode
const synth = new Tone.Synth().toDestination();

// Load Hit Sounds for Hand and Body Tracking with Fallbacks
function loadHitSounds() {
    // Load the sound effects for when you "hit" something, with support for both MP3 and OGG formats
    const hitHand = new Audio('hit_hand.mp3'); // Sound for hand hit
    const hitHandOgg = new Audio('hit_hand.ogg'); // OGG version as a fallback
    const hitBody = new Audio('hit_body.mp3'); // Sound for body hit
    const hitBodyOgg = new Audio('hit_body.ogg'); // OGG version as a fallback

    // Preload the audio so it's ready to play immediately
    hitHand.preload = 'auto';
    hitHandOgg.preload = 'auto';
    hitBody.preload = 'auto';
    hitBodyOgg.preload = 'auto';

    // Function to play a sound with a fallback option
    function playSound(primary, fallback) {
        if (primary.canPlayType('audio/mpeg')) {
            primary.currentTime = 0; // Start from the beginning
            primary.play().catch(error => {
                console.error('Error playing hit_hand sound:', error);
            });
            console.log('Hit Hand sound played.');
        } else if (fallback.canPlayType('audio/ogg')) {
            fallback.currentTime = 0; // Start from the beginning
            fallback.play().catch(error => {
                console.error('Error playing hit_hand sound (fallback):', error);
            });
            console.log('Hit Hand sound played (fallback).');
        }
    }

    function playBodySound(primary, fallback) {
        if (primary.canPlayType('audio/mpeg')) {
            primary.currentTime = 0;
            primary.play().catch(error => {
                console.error('Error playing hit_body sound:', error);
            });
            console.log('Hit Body sound played.');
        } else if (fallback.canPlayType('audio/ogg')) {
            fallback.currentTime = 0;
            fallback.play().catch(error => {
                console.error('Error playing hit_body sound (fallback):', error);
            });
            console.log('Hit Body sound played (fallback).');
        }
    }

    return {
        playHitHand: () => playSound(hitHand, hitHandOgg),
        playHitBody: () => playBodySound(hitBody, hitBodyOgg),
        setVolume: (volume) => {
            // Set the volume for all the hit sounds
            hitHand.volume = volume;
            hitHandOgg.volume = volume;
            hitBody.volume = volume;
            hitBodyOgg.volume = volume;
        }
    };
}

const { playHitHand, playHitBody, setVolume } = loadHitSounds();

// Function to start the pitch sound in game mode
function startPitchSound() {
    if (!oscillator) {
        // Create an oscillator to generate a tone
        oscillator = audioContext.createOscillator();
        oscillator.type = 'sine'; // We'll use a sine wave
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);

        gainNode = audioContext.createGain();  // Create a gain node to control the volume
        gainNode.gain.value = currentVolume;  // Set the initial volume based on whether we're muted

        oscillator.connect(gainNode).connect(audioContext.destination);
        oscillator.start();
        console.log('Pitch sound started.');
    }
}

// Function to stop the pitch sound in game mode
function stopPitchSound() {
    if (oscillator) {
        oscillator.stop();
        oscillator.disconnect(); // Disconnect the oscillator to clean up
        oscillator = null;
        gainNode = null;  // Reset the gain node
        console.log('Pitch sound stopped.');
    }
}

// Mute/Unmute functionality for both game mode and keyboard mode
muteUnmuteButton.addEventListener('click', () => {
    isMuted = !isMuted;  // Toggle the mute state
    muteUnmuteButton.innerText = isMuted ? 'Unmute' : 'Mute';
    console.log(`Mute state changed: ${isMuted ? 'Muted' : 'Unmuted'}`);

    // Handle mute/unmute for keyboard mode using Tone.js synth
    if (currentMode === 'keyboard') {
        synth.volume.value = isMuted ? -Infinity : 0;  // Set volume to -Infinity to mute
        console.log(`Keyboard mode synth volume set to: ${isMuted ? 'Muted' : 'Unmuted'}`);
    }

    // Handle mute/unmute for game and full body modes
    if (currentMode === 'game' || currentMode === 'fullbody') {
        currentVolume = isMuted ? 0 : 1;  // Update the current volume
        setVolume(currentVolume); // Update the volume for hit sounds
        console.log(`Hit sounds volume set to: ${currentVolume}`);
    }

    // If the gain node exists (we're in game mode and sound is playing), update its volume
    if (gainNode) {
        gainNode.gain.value = isMuted ? 0 : currentVolume;
        console.log(`Gain node volume set to: ${gainNode.gain.value}`);
    }
});

// Hand Game Mode Logic (with Web Audio API)
function handleGameMode(results) {
    drawEnemy();
    scoreElement.innerText = score;

    // Keep track of whether we've found the active hand
    let activeHandFound = false;

    // If we need to select an active hand
    if (needToSelectActiveHand && results.multiHandedness && results.multiHandedness.length > 0) {
        // Get the labels of detected hands ('Left' or 'Right')
        const handLabels = results.multiHandedness.map(hand => hand.label);
        // Randomly select one of the hands to be active
        const randomIndex = getRandomInt(0, handLabels.length);
        activeHandLabel = handLabels[randomIndex];
        needToSelectActiveHand = false;
        console.log(`Active hand selected: ${activeHandLabel}`);
    }

    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i];

            // Check if this is the active hand
            const isActiveHand = handedness.label === activeHandLabel;

            // Set the color for drawing: red for active hand, white for others
            let handColor = '#FFFFFF'; // Default color for non-active hand
            if (isActiveHand) {
                handColor = 'rgb(255, 0, 0)'; // Active hand is red
                activeHandFound = true;
            }

            // Draw the hand landmarks and connections
            drawLandmarks(canvasCtx, landmarks, { color: '#6A0DAD', lineWidth: 2 });
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: handColor, lineWidth: 2 });

            // Only process the active hand for interaction
            if (isActiveHand) {
                const indexTip = landmarks[8]; // Tip of the index finger
                const x = indexTip.x * canvasElement.width;
                const y = indexTip.y * canvasElement.height;

                const dx = x - x_enemy;
                const dy = y - y_enemy;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Update pitch and volume based on distance
                updatePitchAndVolume(distance);

                // Check for collision with the enemy
                if (distance < 35) {
                    score += 1;
                    initializeEnemyPosition();
                    if (currentMode === 'game') {
                        playHitHand(); // Play the hit sound
                    }
                    // Restart the pitch sound
                    stopPitchSound();
                    startPitchSound();
                    needToSelectActiveHand = true; // Need to select a new active hand
                    activeHandLabel = null;
                    break; // Exit the loop since we've handled the collision
                }
            }
        }
    }

    // If the active hand is not found among detected hands, we need to select a new one
    if (!activeHandFound && !needToSelectActiveHand) {
        needToSelectActiveHand = true;
        activeHandLabel = null;
        console.log('Active hand not found. Resetting active hand selection.');
    }
}

// Function to update pitch and volume based on distance
function updatePitchAndVolume(distance) {
    if (oscillator && gainNode) {
        // Adjust frequency: closer to enemy means higher pitch
        const frequency = Math.max(100, Math.min(2000, 2000 - distance * 5));
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        console.log(`Oscillator frequency set to: ${frequency} Hz`);

        // Adjust volume: closer to enemy means louder
        const maxDistance = 500; // Maximum distance considered
        const volume = Math.max(0, Math.min(1, (maxDistance - distance) / maxDistance));

        gainNode.gain.value = currentVolume * volume; // Adjust volume based on mute state
        console.log(`Gain node volume set to: ${gainNode.gain.value}`);
    }
}

// Helper functions
function getRandomInt(min, max) {
    // Generate a random integer between min (inclusive) and max (exclusive)
    return Math.floor(Math.random() * (max - min)) + min;
}

function drawEnemy() {
    // Draw the enemy as a green circle
    canvasCtx.beginPath();
    canvasCtx.arc(x_enemy, y_enemy, 25, 0, 2 * Math.PI);
    canvasCtx.lineWidth = 5;
    canvasCtx.strokeStyle = 'rgb(0, 200, 0)';
    canvasCtx.stroke();
    console.log(`Enemy drawn at (${x_enemy}, ${y_enemy})`);
}

function drawTargetLandmarks(){
    //draw circle for each target location
    targetArr.forEach(pos => {
        canvasCtx.beginPath();
        canvasCtx.arc(pos[0], pos[1], 25, 0, 2 * Math.PI);
        canvasCtx.lineWidth = 5;
        canvasCtx.strokeStyle = 'rgb(0, 200, 0)';
        canvasCtx.stroke();
    });
    
}


// Mediapipe Hands Setup
const hands = new Hands({
    locateFile: (file) => {
        // Tell Mediapipe where to find its files
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    selfieMode: true, // Use the front-facing camera
    maxNumHands: 2,   // Detect up to two hands
    modelComplexity: 1,
    minDetectionConfidence: 0.7, // Confidence thresholds
    minTrackingConfidence: 0.5
});

hands.onResults(onResultsHands);

// Mediapipe Pose Setup
const pose = new Pose({
    locateFile: (file) => {
        // Tell Mediapipe where to find its files
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
});

pose.setOptions({
    selfieMode: true, // Use the front-facing camera
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

pose.onResults(onResultsPose);

// Function to handle results from Hands
function onResultsHands(results) {
    if (isPaused) return;

    console.log('Hands results received:', results);

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw the video frame as-is
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (currentMode === 'game') {
        handleGameMode(results);
    } else if (currentMode === 'keyboard') {
        handleKeyboardMode(results);
    } else if (currentMode === 'fingercount') {
        handleFingerCountMode(results);
    }

    canvasCtx.restore();
}

// Function to handle results from Pose
function onResultsPose(results) {
    if (isPaused || currentMode !== 'fullbody') return;

    console.log('Pose results received:', results);

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw the video frame as-is
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    handleFullBodyMode(results);

    canvasCtx.restore();
}

// Function to handle Full Body Mode
function handleFullBodyMode(results) {
    drawEnemy();
    scoreElement.innerText = score;

    if (results.poseLandmarks) {
        // Draw the pose landmarks and connections
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#FFFFFF', lineWidth: 4 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#6A0DAD', lineWidth: 2 });

        // We'll track these limbs
        const landmarksToTrack = [
            { landmark: results.poseLandmarks[15], name: 'Right Wrist' }, // Right wrist
            { landmark: results.poseLandmarks[16], name: 'Left Wrist' },  // Left wrist
            { landmark: results.poseLandmarks[27], name: 'Right Ankle' }, // Right ankle
            { landmark: results.poseLandmarks[28], name: 'Left Ankle' }   // Left ankle
        ];

        // Select active limb if needed
        if (needToSelectActiveLimb) {
            activeLimbIndex = getRandomInt(0, landmarksToTrack.length);
            needToSelectActiveLimb = false;
            console.log(`Active limb selected: ${landmarksToTrack[activeLimbIndex].name}`);
        }

        let activeLimbFound = false;

        for (let i = 0; i < landmarksToTrack.length; i++) {
            const limbInfo = landmarksToTrack[i];
            const landmark = limbInfo.landmark;

            // Check if the landmark is visible enough
            if (landmark.visibility < 0.5) {
                continue; // Skip if not visible
            }

            const isActiveLimb = i === activeLimbIndex;

            // Draw a circle at the landmark position
            const x = landmark.x * canvasElement.width;
            const y = landmark.y * canvasElement.height;

            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 10, 0, 2 * Math.PI);
            canvasCtx.fillStyle = isActiveLimb ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 0, 0.8)';
            canvasCtx.fill();

            if (isActiveLimb) {
                activeLimbFound = true;

                const dx = x - x_enemy;
                const dy = y - y_enemy;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Update pitch and volume based on distance
                updatePitchAndVolume(distance);

                // Check for collision with the enemy
                if (distance < 35) {
                    score += 1;
                    initializeEnemyPosition();
                    if (currentMode === 'fullbody') {
                        playHitBody(); // Play hit body sound
                    }
                    // Restart the pitch sound
                    stopPitchSound();
                    startPitchSound();
                    needToSelectActiveLimb = true; // Need to select a new active limb
                    activeLimbIndex = null;
                    break; // Exit the loop since we've handled the collision
                }
            }
        }

        // If active limb is not found, reset selection
        if (!activeLimbFound && !needToSelectActiveLimb) {
            needToSelectActiveLimb = true;
            activeLimbIndex = null;
            console.log('Active limb not found. Resetting active limb selection.');
        }
    }
}

// Keyboard Mode - C Major Scale on X and Pitch on Y
function handleKeyboardMode(results) {
    drawTargetLandmarks();
    
    if (results.multiHandLandmarks && !isPaused) {
        for (const landmarks of results.multiHandLandmarks) {
            const indexTip = landmarks[8];  // The tip of the index finger
            const x = indexTip.x * canvasElement.width;
            const y = indexTip.y * canvasElement.height;

            // Visual feedback for hand tracking (optional)
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 10, 0, 2 * Math.PI);
            canvasCtx.fillStyle = 'rgba(0, 255, 0, 0.5)';
            canvasCtx.fill();

            // Get note based on the X-axis (C Major scale)
            const note = getNoteFromX(x);

            // Adjust pitch (detune) based on Y-axis
            const detuneValue = getDetuneFromY(y);

            if (!noteDebounce && (note !== lastNote || !isPlayingNote)) {
                // If the note changes or no note is playing, release the last note and play the new one
                if (isPlayingNote) {
                    synth.triggerRelease(Tone.now());
                    console.log(`Released note: ${lastNote}`);
                }
                synth.triggerAttack(note, Tone.now());  // Play the note
                synth.detune.value = detuneValue;  // Apply detune based on Y-axis
                console.log(`Playing note: ${note} with detune: ${detuneValue} cents`);
                lastNote = note;
                isPlayingNote = true;

                // Set a debounce period to avoid triggering notes too rapidly
                noteDebounce = true;
                setTimeout(() => {
                    noteDebounce = false;
                }, 200);  // 200 milliseconds debounce
            }

            // Continuously adjust detune for the current note based on Y-axis movement
            synth.detune.value = detuneValue;
            console.log(`Synth detune adjusted to: ${detuneValue} cents`);
        }
    } else {
        stopPlayingNote();
    }
}

// Function to handle Finger Count Mode
function handleFingerCountMode(results) {
    if (results.multiHandLandmarks && results.multiHandedness && !isPaused) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i];

            // We're not drawing the skeleton in this mode

            const fingerCount = countFingers(landmarks, handedness);
            // Display the number of raised fingers
            canvasCtx.font = 'bold 60px Arial';
            canvasCtx.fillStyle = 'rgba(87, 82, 196, 1)'; // Purple color
            // Position the text near the hand
            const x = landmarks[0].x * canvasElement.width;
            const y = landmarks[0].y * canvasElement.height;
            canvasCtx.fillText(fingerCount.toString(), x - 30, y - 30);
            console.log(`Detected ${fingerCount} fingers for ${handedness.label} hand.`);
        }
    }
}

// Function to count fingers
function countFingers(landmarks, handedness) {
    const isRightHand = handedness.label === 'Right';

    // Thumb: Compare tip and base x-coordinates
    let thumbIsOpen;
    if (isRightHand) {
        thumbIsOpen = landmarks[4].x < landmarks[3].x;
    } else {
        thumbIsOpen = landmarks[4].x > landmarks[3].x;
    }

    // Other fingers: Compare tip and PIP y-coordinates
    const fingers = [
        landmarks[8].y < landmarks[6].y,   // Index finger
        landmarks[12].y < landmarks[10].y, // Middle finger
        landmarks[16].y < landmarks[14].y, // Ring finger
        landmarks[20].y < landmarks[18].y  // Pinky finger
    ];

    const numOpenFingers = fingers.filter(isOpen => isOpen).length;
    const totalFingers = (thumbIsOpen ? 1 : 0) + numOpenFingers;
    return totalFingers;
}

function getNoteFromX(x) {
    // Divide the X-axis into 8 regions for the C Major scale: C4, D4, E4, F4, G4, A4, B4, C5
    const notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
    const index = Math.floor((x / canvasElement.width) * notes.length);
    return notes[index] || "C4";  // Default to "C4" if no valid index
}

function getDetuneFromY(y) {
    // The detune value will range from -1200 cents (one octave lower) to +1200 cents (one octave higher)
    const maxDetune = 1200;  // 1200 cents is one octave
    const normalizedY = y / canvasElement.height;  // Normalize Y position (0 at top, 1 at bottom)
    const detuneValue = (1 - normalizedY) * maxDetune * 2 - maxDetune;  // Calculate detune in cents
    return detuneValue;  // Return detune in cents (-1200 to +1200)
}

function stopPlayingNote() {
    if (isPlayingNote) {
        synth.triggerRelease(Tone.now());
        console.log(`Released note: ${lastNote}`);
        isPlayingNote = false;
    }
}

// Pause/Play button functionality
pausePlayButton.addEventListener('click', () => {
    isPaused = !isPaused;  // Toggle paused state
    if (isPaused) {
        stopPlayingNote();  // Stop any currently playing notes
        stopPitchSound();   // Stop the oscillator in game mode
        pausePlayButton.innerText = 'Play';  // Update button text to "Play"
        pauseOverlay.style.visibility = 'visible';  // Show the purple pause overlay
        console.log('Game paused.');
    } else {
        pausePlayButton.innerText = 'Pause';  // Update button text to "Pause"
        pauseOverlay.style.visibility = 'hidden';  // Hide the purple pause overlay
        if (currentMode === 'game' || currentMode === 'fullbody') {
            startPitchSound(); // Start the oscillator if resuming game mode or full body mode
        }
        console.log('Game resumed.');
    }
});

// Overlay click to resume
pauseOverlay.addEventListener('click', () => {
    if (isPaused) {
        isPaused = false;  // Unpause the game
        pausePlayButton.innerText = 'Pause';  // Update button text
        pauseOverlay.style.visibility = 'hidden';  // Hide the purple pause overlay
        if (currentMode === 'game' || currentMode === 'fullbody') {
            startPitchSound(); // Start the oscillator if resuming game mode or full body mode
        }
        console.log('Game resumed via overlay.');
    }
});

// Handle mode switching
modeSelector.addEventListener('change', (event) => {
    // Stop the oscillator when switching modes
    stopPitchSound();
    currentMode = event.target.value;
    resetMode();
    updateGameModeDescription(); // Update the description when mode changes
    console.log(`Mode changed to: ${currentMode}`);
});

function resetMode() {
    stopPlayingNote(); // Stop any ongoing sounds from keyboard mode
    stopPitchSound();  // Stop any oscillator from game mode

    if (currentMode === 'fullbody') {
        pose.onResults(onResultsPose);
        hands.onResults(null);
        startPitchSound(); // Start the oscillator when entering full body mode
        console.log('Switched to Full Body Tracking mode.');
    } else {
        hands.onResults(onResultsHands);
        pose.onResults(null);
        if (currentMode === 'game') {
            startPitchSound(); // Start the oscillator when entering game mode
            console.log('Switched to Hand Tracking Game mode.');
        }
    }
}

// Camera setup with responsive resolution
const camera = new Camera(videoElement, {
    onFrame: async () => {
        if (!isPaused) {
            try {
                if (currentMode === 'fullbody') {
                    await pose.send({ image: videoElement });
                } else {
                    await hands.send({ image: videoElement });
                }
            } catch (error) {
                console.error('Error processing frame:', error);
            }
        }
    },
    width: window.innerWidth < 768 ? 320 : 640, // Lower resolution for mobile
    height: window.innerWidth < 768 ? 240 : 480
});

// Start the camera after the page has fully loaded
window.addEventListener('load', () => {
    console.log('Attempting to start the camera...');
    camera.start().then(() => {
        console.log('Camera started successfully.');
    }).catch(error => {
        console.error('Error starting camera:', error);
        alert('Unable to access the camera. Please check your permissions.');
    });
});

// Handle orientation changes
window.addEventListener('resize', () => {
    adjustCanvasSize();
});

// Dashboard toggle functionality
toggleButton.addEventListener('click', () => {
    if (isDashboardOpen) {
        dashboard.classList.remove('open');
        mainContent.classList.remove('open');
        toggleButton.classList.remove('open');
        console.log('Dashboard closed.');
    } else {
        dashboard.classList.add('open');
        mainContent.classList.add('open');
        toggleButton.classList.add('open');
        console.log('Dashboard opened.');
    }
    isDashboardOpen = !isDashboardOpen;
});

// Adjust canvas size to match video size
function adjustCanvasSize() {
    if (videoElement.videoWidth && videoElement.videoHeight) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        initializeEnemyPosition(); // Re-initialize enemy position after canvas size changes
        console.log(`Canvas size adjusted to: ${canvasElement.width}x${canvasElement.height}`);
    }
}

// Adjust canvas size once the video metadata is loaded
videoElement.addEventListener('loadedmetadata', adjustCanvasSize);

// Game Mode Descriptions
const gameModeDescriptions = {
    'game': 'In Hand Tracking Game mode, only one randomly selected hand can interact with the target. The active hand is highlighted. Try to reach the target and increase your score!',
    'keyboard': 'In Keyboard Mode, play musical notes using your hand movements. Move your hand across the screen to play different notes.',
    'fullbody': 'In Full Body Tracking mode, only one randomly selected limb (hand or foot) can interact with the target. The active limb is highlighted. Get closer to the target to increase the sound volume!',
    'fingercount': 'In Finger Count Mode, hold up fingers to see how many are detected. This mode counts the number of fingers you are holding up.'
};

// Function to update the game mode description
function updateGameModeDescription() {
    const description = gameModeDescriptions[currentMode] || '';
    gameModeDescription.textContent = description;
    console.log(`Game mode description updated for: ${currentMode}`);
}

// Call the function initially to set the default description
updateGameModeDescription();

// Audio Context Resume on User Interaction (for browsers that require it)
document.getElementById('start-button').addEventListener('click', () => {
    if (audioContext.state !== 'running') {
        audioContext.resume().then(() => {
            console.log('AudioContext resumed.');
        });
    }
    // Also resume Tone.js context
    if (Tone.context.state !== 'running') {
        Tone.context.resume().then(() => {
            console.log('Tone.js AudioContext resumed.');
        });
    }
    // Hide the start button after interaction
    document.getElementById('start-button').style.display = 'none';
}, { once: true });

