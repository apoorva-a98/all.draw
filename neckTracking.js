// Pen by Vinzel. from <a href="https://thenounproject.com/browse/icons/term/pen/" target="_blank" title="Pen Icons">Noun Project</a> (CC BY 3.0)

let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };

let ballX, ballY;
let ballSize = 10;
let ballSpeed = 0.0000000000000001;
let steerX = 0, steerY = 0;
let paths = []; 
let currentPath = [];
let drawingEnabled = false; // Track if drawing is enabled or not
let usingMouthControl = false; // Track if mouth control is active or not
let usingVoiceControl = false; // Track if voice control is active or not
let myRec;
let speechRec;

let penImg;
let printing = false;
let uploadedBgImg = null;


// Indices for specific eyes and nose landmarks
const leftEyeIndex = 130;  // Left eye
const rightEyeIndex = 359; // Right eye
const noseIndex = 1;       // Nose tip
const upperLipIndex = 13;  // Upper lip
const lowerLipIndex = 14;  // Lower lip

function preload() {
  faceMesh = ml5.faceMesh(options);
  penImg = loadImage('pen.png'); 
}

function setup() {
  let myCanvas = createCanvas(windowWidth, windowHeight);
  myCanvas.parent("canvasContainer"); // Use the ID of the div where you want the canvas to be
  frameRate(27.5); 
  
  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  // Start detecting faces from the webcam video
  faceMesh.detectStart(video, gotFaces);
  
  // Initialize the ball position at the center of the canvas
  ballX = width / 2;
  ballY = height / 2;

  // Setup speech recognition
  // myRec = new p5.SpeechRec('en-US', parseResult);
  // myRec.start(true, false); // Start continuous recognition, no interim results

  document.getElementById('saveArtButton').addEventListener('click', function() {
    
    printing = true; // To hide pen before printing
    
    setTimeout(() => {
      let ctx = canvas.getContext('2d');
      let text1 = "all.draw";

      // Set the font properties
      let fontFamily = 'Lexend, Inter, Sans-serif';
      let fontSize = '48px';
      let fontWeight = '800';

      // Set the font style
      ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;

      // text1.style
      // text1.style.fontFamily = "Lexend";
      // // Lexend, Inter, sans-serif
      let text2 = " by " + document.getElementById('artistname').value;
      


      ctx.fillText(text1, 30, 80); // 30 is a little lower than y=10 to account for font size
      let canvasHeight = canvas.clientHeight;
      ctx.fillText(text2, 10, canvasHeight - 20); // Adjust y for font size
      
      saveCanvas(text2, 'png');
        // window.print();
        printing = false; // Reset after print (in case user returns)
        clearCanvas();
    }, 100);
    // saveArt();
  
    // window.print();
    // clearCanvas();
  });

  document.getElementById('imageUploadInput').addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        uploadedBgImg = loadImage(e.target.result); // Load uploaded image as p5.Image
      };
      reader.readAsDataURL(file);
    }
  });
}

function drawUploadedBackground() {
  if (uploadedBgImg && !printing) {
    push();
    imageMode(CENTER);
    tint(255, 178); // 70% opacity

    let canvasAspect = width / height;
    let imgAspect = uploadedBgImg.width / uploadedBgImg.height;

    let drawWidth, drawHeight;

    if (imgAspect > canvasAspect) {
      drawHeight = height * 0.5;
      drawWidth = drawHeight * imgAspect;
    } else {
      drawWidth = width * 0.5;
      drawHeight = drawWidth / imgAspect;
    }

    image(uploadedBgImg, width / 3, height / 2, drawWidth, drawHeight); // Centered position
    pop();
  } else {
    background(255);
  }
}


function draw() {
  // if (!drawingEnabled) return;
  // Draw the webcam video
  // image(video, 0, 0, width, height);
  clear();
  drawUploadedBackground();

  // Draw the reference points
  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    
    if (face.keypoints.length > 0) {
      const keypointsToDraw = [
        face.keypoints[leftEyeIndex],
        face.keypoints[rightEyeIndex],
        face.keypoints[noseIndex],
        face.keypoints[upperLipIndex],
        face.keypoints[lowerLipIndex],
      ];

      isMouthOpen(face.keypoints);

      const nose = face.keypoints[noseIndex];

      // Calculate and display yaw, pitch, and roll
      let angles = calculateHeadAngles(face.keypoints);
      fill(0);
      textSize(16);
      
      // Update the ball position based on angles
      steerBall(angles);
        // Draw the path of the keypoint
        noFill();
        // stroke(0, 0, 255);
        stroke(0)
        strokeWeight(2);
        for (let path of paths) {
          beginShape();
          for (let pt of path) {
            vertex(pt.x, pt.y);
          }
          endShape();
        }
        beginShape();
        for (let pt of currentPath) {
          vertex(pt.x, pt.y);
        }
        endShape();
    }
  }
}

// Callback function for when faceMesh outputs data
function gotFaces(results) {
  faces = results;
}

function moveBall() {
  // Move the ball with some constant speed
  ballX += ballSpeed;
  ballY += ballSpeed;

  // Constrain the ball within the canvas
  ballX = constrain(ballX, 50, windowHeight+200);
  ballY = constrain(ballY, 50, windowHeight-50);
}

function steerBall(angles) {
  // Update the ball position based on yaw and pitch
  let dx = (angles.yaw * 0.25 + angles.roll * 0.25)/2; // Combine yaw and roll for x-axis movement
  let dy = 0; 

  // ballX += angles.yaw * 0.25;   // Reduced speed for yaw
  // ballX += angles.roll * 0.25;   // Reduced speed for yaw
  
  // Check if pitch exceeds the threshold to allow vertical movement
  if (angles.pitch < 90) {
    dy += angles.pitch * 0.025; // Increased impact for pitch
  }
  else if (angles.pitch > 100) {
    dy -= angles.pitch * 0.025; // Increased impact for pitch
  }
  else {
    dy = 0;
  }

  // Normalize the direction vector (dx, dy)
  let magnitude = Math.sqrt(dx * dx + dy * dy);
  if (magnitude > 0) {
    dx /= magnitude;
    dy /= magnitude;
  }

  // Applying constant speed to the direction
  const speed = 2; // Adjust this value to set the ball's speed
  ballX += dx * speed;
  if (angles.pitch < 90 || angles.pitch > 100) {
    ballY += dy * speed;
  }
  else {
    ballY += 0;
  }
  
  // Constrain the ball within the canvas
  ballX = constrain(ballX, 50, windowHeight+200);
  ballY = constrain(ballY, 50, windowHeight-50);
  
  moveBall();
  circle(ballX, ballY, 2);
       if (!printing && penImg) {
        imageMode(CENTER);
        image(penImg, ballX+24, ballY-45, 50, 90); // Adjust size as needed
      }

  if (drawingEnabled) {
    // Only add points to the path if drawing is enabled
    currentPath.push(createVector(ballX, ballY));
  }
}

function drawVectorPath(x, y, size) {
  // Draw a custom vector path instead of an ellipse
  noFill();
  stroke(255, 0, 0);
  strokeWeight(3);
  beginShape();
  vertex(x, y);
  endShape(CLOSE);
}

function calculateHeadAngles(keypoints) {
  const leftEye = keypoints[leftEyeIndex];
  const rightEye = keypoints[rightEyeIndex];
  const nose = keypoints[noseIndex];

  // Calculate the roll (tilt)
  let roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

  // Calculate the pitch (up-down rotation)
  let pitch = Math.atan2(nose.y - (leftEye.y + rightEye.y) / 2, nose.z - (leftEye.z + rightEye.z) / 2) * (180 / Math.PI)-45;
//   console.log(pitch);

  // Calculate the yaw (left-right rotation)
  // let yaw = 0
  let mideye = (leftEye.x + rightEye.x) / 2;
  let yaw = Math.atan2(nose.x - mideye, - nose.z) * (180 / Math.PI);
  // let roll = 0;

  return { yaw, pitch, roll };
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
  paths = [];
  clear();
  drawingEnabled = false;
}

// // Cleanup function to be called when sketch is stopped
// function remove() {
//   faceMesh.detectStop();
//   video.remove();
//   clear();
// }