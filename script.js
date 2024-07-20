let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };

let ballX, ballY;
let ballSize = 10;
let ballSpeed = 0.0000000000000001;
let steerX = 0, steerY = 0;
let path = [];

// Indices for specific eyes and nose landmarks
const leftEyeIndex = 130;  // Left eye
const rightEyeIndex = 359; // Right eye
const noseIndex = 1;       // Nose tip

function preload() {
  // Load the faceMesh model
  faceMesh = ml5.faceMesh(options);
}

function setup() {
    let myCanvas = createCanvas(windowWidth, windowHeight);
    myCanvas.parent("canvasContainer"); // Use the ID of the div where you want the canvas to be
  frameRate(20); // Set the frame rate to 15 frames per second
  
  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  // Start detecting faces from the webcam video
  faceMesh.detect(video, gotFaces);
  
  // Initialize the ball position at the center of the canvas
  ballX = width / 2;
  ballY = height / 2;

  // Add event listener for Save Art button
  document.getElementById('saveArtButton').addEventListener('click', () => {
    saveCanvas('neck-tracking-path', 'png');
    clearCanvas();
  });
}

function draw() {
  // Draw the webcam video
  // image(video, 0, 0, width, height);
  // background(255);

  // Draw the reference points
  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    
    if (face.keypoints.length > 0) {
      const keypointsToDraw = [
        face.keypoints[leftEyeIndex],
        face.keypoints[rightEyeIndex],
        face.keypoints[noseIndex],
      ];

      // Calculate and display yaw, pitch, and roll
      let angles = calculateHeadAngles(face.keypoints);
      fill(0);
      textSize(16);
      

      // Update the ball position based on angles
      steerBall(angles);
      
      // Draw the path of the keypoint
      noFill();
      stroke(0, 0, 255);
      strokeWeight(2);
      beginShape();
      for (let pt of path) {
        vertex(pt.x, pt.y);
      }
      endShape();
    }
  }
}

// Callback function for when faceMesh outputs data
function gotFaces(results) {
  // Save the output to the faces variable
  faces = results;
}

function moveBall() {
  // Move the ball with some constant speed
  ballX += ballSpeed;
  ballY += ballSpeed;

  // Constrain the ball within the canvas
  ballX = constrain(ballX, 50, width-50);
  ballY = constrain(ballY, 50, height-50);
}

function steerBall(angles) {
  // Update the ball position based on yaw and pitch
  ballX += angles.yaw * 0.25;   // Reduced speed for yaw
  ballX += angles.roll * 0.5;   // Reduced speed for yaw
  
  // Check if pitch exceeds the threshold to allow vertical movement
  if (angles.pitch < 90) {
    ballY += angles.pitch * 0.05; // Increased impact for pitch
  }
  if (angles.pitch > 100) {
    ballY -= angles.pitch * 0.05; // Increased impact for pitch
  }
  
  // Constrain the ball within the canvas
  ballX = constrain(ballX, 50, width-50);
  ballY = constrain(ballY, 50, height-50);
  
  moveBall();
  
  path.push(createVector(ballX, ballY));
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
  let pitch = Math.atan2(nose.y - (leftEye.y + rightEye.y) / 2, nose.z - (leftEye.z + rightEye.z) / 2) * (180 / Math.PI) - 65;
//   console.log(pitch);

  // Calculate the yaw (left-right rotation)
  // let yaw = 0
  let mideye = (leftEye.x + rightEye.x) / 2;
  let yaw = Math.atan2(nose.x - mideye, -nose.z) * (180 / Math.PI);

  return { yaw, pitch, roll };
}

function clearCanvas() {
  path = [];
  clear();
}

// Cleanup function to be called when sketch is stopped
function remove() {
  faceMesh.detectStop(); // Stop the faceMesh detection
  video.remove(); // Remove video capture
  clear(); // Clear the canvas
}
