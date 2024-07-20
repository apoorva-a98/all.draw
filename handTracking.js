/*
 * 👋 Hello! This is an ml5.js example made and shared with ❤️.
 * Learn more about the ml5.js project: https://ml5js.org/
 * ml5.js license and Code of Conduct: https://github.com/ml5js/ml5-next-gen/blob/main/LICENSE.md
 *
 * This example demonstrates hand tracking on live video through ml5.handPose.
 */

let handPose;
let video;
let hands = [];
let path = [];
const smoothingFactor = 0.1; // How much to smooth, 0 to 1 (higher means smoother)

function preload() {
  // Load the handPose model
  handPose = ml5.handPose();
}

function setup() {
  let myCanvas = createCanvas(640, 480);
  myCanvas.parent("canvasContainer"); // Use the ID of the div where you want the canvas to be

  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  // start detecting hands from the webcam video
  handPose.detectStart(video, gotHands);
}

function draw() {
  // Flip the canvas horizontally
  translate(width, 0); // Move the origin to the right edge of the canvas
  scale(-1, 1); // Flip the canvas horizontally
  
  // Draw the webcam video
  // image(video, 0, 0, width, height);

  // Draw using the index finger tip (keypoint 8)
  if (hands.length > 0) {
    let hand = hands[0]; // Assuming we are only interested in the first detected hand
    let indexFingerTip = hand.keypoints[8];
    if (indexFingerTip) {
      // fill(0, 255, 0);
      // noStroke();
      // circle(indexFingerTip.x, indexFingerTip.y, 10);
      
      // Smoothen the path
      if (path.length > 0) {
        let lastPoint = path[path.length - 1];
        let mappedX = lerp(lastPoint.x, indexFingerTip.x, smoothingFactor);
        let mappedY = lerp(lastPoint.y, indexFingerTip.y, smoothingFactor);
        path[path.length - 1] = createVector(mappedX, mappedY); // Update last point in path
      }

      // Add the position of the index fingertip to the path
      path.push(createVector(indexFingerTip.x, indexFingerTip.y));
    }
  }

  // Draw the path
  noFill();
  stroke(0);
  strokeWeight(2);
  beginShape();
  for (let v of path) {
    vertex(v.x, v.y);
  }
  endShape();
  
  // Reset the transformation matrix
  resetMatrix();
}

// Callback function for when handPose outputs data
function gotHands(results) {
  // Save the output to the hands variable
  hands = results;
}

// // Save canvas as an image when mouse is clicked
// function mousePressed() {
//   saveCanvas('hand-tracking-path', 'png');
// }

// Cleanup function to be called when sketch is stopped
function remove() {
    handPose.detectStop(); // Stop the handPose detection
    video.remove(); // Remove video capture
    clear(); // Clear the canvas
  }
