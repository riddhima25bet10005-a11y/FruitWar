// camera.js
const videoElement = document.querySelector('.input_video');
let cursorX = window.innerWidth / 2;
let cursorY = window.innerHeight / 2;

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // Get index finger tip of the first hand
        const indexFinger = results.multiHandLandmarks[0][8]; 
        // Map to screen coordinates (mirror the x axis since it's a front camera)
        cursorX = (1 - indexFinger.x) * window.innerWidth;
        cursorY = indexFinger.y * window.innerHeight;
        
        // Pass coordinates to game instance to simulate a slice
        if (window.gameInstance && window.gameInstance.isPlaying) {
            window.gameInstance.updateBlade(cursorX, cursorY);
        }
    } else {
        if (window.gameInstance && window.gameInstance.isPlaying) {
            window.gameInstance.endBlade();
        }
    }
}

const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

function startCameraTracking() {
    try {
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement});
            },
            width: 640,
            height: 480
        });
        camera.start().catch(err => {
            console.warn("Camera failed to start:", err);
            // No alert - just fallback silently to mouse
        });
    } catch (e) {
        console.error("Camera setup error:", e);
    }
}
