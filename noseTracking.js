let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true};

let shapes = []; // Array to store random shapes
let shapeTimer = 0;
let nosePath = []; // Store the path of the moving nose
let lastNoseVector = null; // Store the last nose position to calculate movement threshold
const movementThreshold = 30; // Minimum movement required to register a new point
let paths = []; 
let currentPath = [];
let drawingEnabled = false; // Track if drawing is enabled or not
let usingMouthControl = false; // Track if mouth control is active or not
let usingVoiceControl = false; // Track if voice control is active or not
let myRec;
let speechRec;

let printing = false;


// Indices for specific eyes and nose landmarks
const leftEyeIndex = 130;  // Left eye
const rightEyeIndex = 359; // Right eye
const noseIndex = 1;       // Nose tip
const upperLipIndex = 13;  // Upper lip
const lowerLipIndex = 14;  // Lower lip

function preload() {
  // Load the faceMesh model
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  let myCanvas = createCanvas(windowWidth, windowHeight);
  myCanvas.parent("canvasContainer"); // Use the ID of the div where you want the canvas to be
  frameRate(35); 
  
  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  // Start detecting faces from the webcam video
  faceMesh.detectStart(video, gotFaces);

  shapeTimer = millis(); // Start the timer when the sketch runs

  // Setup speech recognition
  // myRec = new p5.SpeechRec('en-US', parseResult);
  // myRec.start(true, false); // Start continuous recognition, no interim results

  document.getElementById('saveArtButton').addEventListener('click', function() {
    printing = true; // Hide overlays  
    
    // Wait a frame before saving
    setTimeout(() => {
      let ctx = canvas.getContext('2d');
      let text1 = "all.draw";

      // Set the font properties
      let fontFamily = 'Lexend, Inter, Sans-serif';
      let fontSize = '48px';
      let fontWeight = '800';

      // Set the font style
      ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
      ctx.fillStyle = 'black'; // Set text color

      // text1.style
      // text1.style.fontFamily = "Lexend";
      // // Lexend, Inter, sans-serif
      let text2 = " by " + document.getElementById('artistname').value;

      ctx.fillText(text1, 30, 50); // 30 is a little lower than y=10 to account for font size
      let canvasHeight = canvas.clientHeight;
      ctx.fillText(text2, 10, canvasHeight - 20); // Adjust y for font size

      // saveArt();
      saveCanvas(text2, 'png');
      printing = false;
      clearCanvas();   
    }, 100);         
  });
}

function draw() {
  clear();
  background(255);

  if (!printing) {
    // Mirror the video feed
    push();
    translate(width, 0); // Move to the right side
    scale(-1, 1); // Flip horizontally
    tint(255, 77) //transparency
    image(video, 0, 0, width, height);
    pop();

    for (let face of faces) {
      let nose = face.keypoints[noseIndex];
      let leftEye = face.keypoints[leftEyeIndex];
      let rightEye = face.keypoints[rightEyeIndex];

      let noseX = map(nose.x, 0, 640, 0, width);
      let noseY = map(nose.y, 0, 480, 0, height);

      let yaw = (nose.x - (leftEye.x + rightEye.x) / 2) * 2;  // Nose deviation from midpoint of eyes
      let pitch = (nose.y - ((leftEye.y + rightEye.y) / 2)) * 2; // Nose deviation from eyes in Y direction

      // Scale yaw & pitch to control nose movement
      let movementX = map(yaw, -30, 30, -200, 200);   // The more sideways, the more X shift
      let movementY = map(pitch, -30, 30, -200, 50);   // The more up/down, the more Y shift

      // Convert movement into a vector
      let newNoseVector = createVector(noseX + movementX * 2, noseY + movementY * 2);

      // Apply smoothing - prevent small jittery movements
      if (lastNoseVector) {
        let distance = dist(newNoseVector.x, newNoseVector.y, lastNoseVector.x, lastNoseVector.y);

        if (distance > movementThreshold) { // Only register movement above threshold
            let smoothedVector = p5.Vector.lerp(lastNoseVector, newNoseVector, 0.2); // Smooth transition
            nosePath.push(smoothedVector);
            lastNoseVector = smoothedVector;
        }
      } else {
          lastNoseVector = newNoseVector; // Initialize first position
          nosePath.push(newNoseVector);
      }
      // Draw a circle at the nose position
      fill(255, 0, 0); // Red color for nose
      noStroke();
      ellipse(noseX, noseY, 25, 25); // Larger red dot at nose
      ellipse(lastNoseVector.x, lastNoseVector.y, 25, 25); // Nose moves dynamically
      stroke(0, 0, 255);
      strokeWeight(5);
      line(noseX, noseY, lastNoseVector.x, lastNoseVector.y);
      stroke(0);
      // Draw dynamically moving nose circle
      // ellipse(noseX + movementX * 2, noseY + movementY * 2, 25, 25); // Nose moves dynamically

      // line(noseX, noseY, noseX + movementX * 2, noseY + movementY * 2);
    }
  }
  
  for (let face of faces) {    
    // Draw the path of the nose movement
    noFill();
    stroke(0);
    strokeWeight(2);
    beginShape();
    for (let pt of nosePath) {
        vertex(pt.x, pt.y);
    }
    endShape();
    }
  }   
    // // Call the function to draw the shapes
    // drawShapes();

    // // Generate random shapes for 1 minute
    // if (millis() - shapeTimer < 60000) { // If less than 1 minute has passed
    //     if (frameCount % 60000 === 0) { // Spawn a shape every second
    //     spawnRandomShape();
    //     }
    // }

// function spawnRandomShape() {
//     let shapeType = int(random(3)); // Randomly choose between 4 types of shapes
//     let x = random(50,width-50);
//     let y = random(50,height-50);
//     // let size = random(100, 200);
//     // let color = color(random(255), random(255), random(255));
//     let size = 100;
//     let color = color(0);
  
//     switch (shapeType) {
//       case 0:
//         shapes.push({ type: 'triangle', x1: x, y1: y, x2: x + size, y2: y, x3: x + size / 2, y3: y - size, color });
//         break;
//       case 1:
//         shapes.push({ type: 'rectangle', x: x, y: y, w: size, h: size, color });
//         break;
//       case 2:
//         shapes.push({ type: 'circle', x: x, y: y, r: size / 2, color });
//         break;
//     }
//   }
  
//   function drawShapes() {
//     for (let shape of shapes) {
//       fill(shape.color);
//       stroke(shape.color);
//       strokeWeight(5);
//       switch (shape.type) {
//         case 'triangle':
//           triangle(shape.x1, shape.y1, shape.x2, shape.y2, shape.x3, shape.y3);
//           break;
//         case 'rectangle':
//           rect(shape.x, shape.y, shape.w, shape.h);
//           break;
//         case 'circle':
//           ellipse(shape.x, shape.y, shape.r * 2, shape.r * 2);
//           break;
//       }
//     }
//   }


// Callback function for when faceMesh outputs data
function gotFaces(results) {
  faces = results;
}

// Cleanup function to be called when sketch is stopped
function remove() {
    faceMesh.detectStop(); // Stop the faceMesh detection
    video.remove(); // Remove video capture
    clear(); // Clear the canvas
}

function keyPressed() {
  // Toggle between mouth control and Enter key control when 'm' is pressed
  if (key === 'm') {
    usingMouthControl = !usingMouthControl; // Switch modes
    usingVoiceControl = false; // Track if voice control is active or not
  }

  if (key === 'v') {
    usingVoiceControl = !usingVoiceControl;
    if (usingVoiceControl) {
      // Disable mouth control and Enter key control
      usingMouthControl = false;
      drawingEnabled = false;
      speechRec.start(true, false); // Start speech recognition
    } else {
      speechRec.stop(); // Stop speech recognition
      // Enable Enter key control
      drawingEnabled = false;
      usingMouthControl = false;
    }
  }

  if (!usingMouthControl && !usingVoiceControl) {
    // if (key === ' ') {
    //   drawingEnabled = !drawingEnabled; // Toggle drawing
    // }
    if(key === 'Enter') {
      drawingEnabled = !drawingEnabled; // Toggle drawing
      if (!drawingEnabled) {
        paths.push(currentPath);
        currentPath = []; // Reset the current path
      }
    }
  }
}


function isMouthOpen(keypoints) {
  if (usingMouthControl) { // Only run this if mouth control is enabled
    const upperLip = keypoints[upperLipIndex];
    const lowerLip = keypoints[lowerLipIndex];

    // Calculate the vertical distance between the upper lip and lower lip
    let mouthDistance = dist(upperLip.x, upperLip.y, lowerLip.x, lowerLip.y);

    // Define a threshold to detect if the mouth is open
    const mouthOpenThreshold = 10; // Adjust this based on testing

    if (mouthDistance > mouthOpenThreshold){
      drawingEnabled = false;
      if (!drawingEnabled) {
        paths.push(currentPath);
        currentPath = []; // Reset the current path
      }
    }
    else {
      drawingEnabled = true;
    }
  }
}

function parseResult() {
  if (speechRec.resultString.includes("start")) {
    drawingEnabled = true;
  } else if (speechRec.resultString.includes("stop")) {
    drawingEnabled = false;
    paths.push(currentPath);
    currentPath = [];
  }
}

function clearCanvas() {
  currentPath = [];
  clear();
  let drawingEnabled = false;
}

// // Cleanup function to be called when sketch is stopped
// function remove() {
//   faceMesh.detectStop();
//   video.remove();
//   clear();
// }