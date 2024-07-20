let currentSketch;

document.addEventListener('DOMContentLoaded', (event) => {
    document.getElementById('fingerButton').addEventListener('click', function() {
        loadSketch('handTracking.js');
    });

    document.getElementById('noseButton').addEventListener('click', function() {
        loadSketch('noseTracking.js');
    });

    document.getElementById('minuteNeckButton').addEventListener('click', function() {
        loadSketch('neckTracking.js');
    });

    document.getElementById('moveAroundButton').addEventListener('click', function() {
        loadSketch('moveAround.js');
    });

    document.getElementById('saveArtButton').addEventListener('click', function() {
        saveArt();
    });
});

function loadSketch(sketchName) {
    // Remove existing canvas if there is one
    const frame2 = document.getElementById('canvasContainer');
    const existingCanvas = frame2.querySelector('canvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }

    // Remove the previous sketch script if present
    if (currentSketch) {
        const oldScript = document.querySelector(`script[src="${currentSketch}"]`);
        if (oldScript) {
            oldScript.remove();
        }
    }

    // Dynamically load the new sketch.js file
    const script = document.createElement('script');
    script.src = sketchName;
    document.body.appendChild(script);

    // Set the current sketch to the newly loaded one
    currentSketch = sketchName;

    // Append the canvas to Frame2 after the script has loaded
    script.onload = function() {
        // const canvas = document.querySelector('canvas');
        // if (canvas) {
        //     canvas.parentElement.removeChild(canvas); // Remove old canvas if exists
            document.getElementById('canvasContainer').appendChild(canvas); // Append the new canvas
        // }
    };
}

function saveArt() {
    const frame2 = document.querySelector('.Frame2');
    const canvas = frame2.querySelector('canvas');
    if (canvas) {
        // Use p5.js function to save the canvas as an image
        saveCanvas(canvas, 'artwork', 'png');
        // Remove the canvas after saving
        canvas.remove();
        // Optionally, reset button states if needed
        resetButtons();
    }
}

function resetButtons() {
    // Example: Enable all buttons if they were disabled or reset their states
    const buttons = document.querySelectorAll('.Button');
    buttons.forEach(button => {
        button.disabled = false;
    });
}