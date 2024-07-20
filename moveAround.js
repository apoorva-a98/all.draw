/*
 * 👋 Hello! This is an ml5.js example made and shared with ❤️.
 * Learn more about the ml5.js project: https://ml5js.org/
 * ml5.js license and Code of Conduct: https://github.com/ml5js/ml5-next-gen/blob/main/LICENSE.md
 *
 * This example demonstrates drawing skeletons on poses for the MoveNet model.
 */

let video;
let bodyPose;
let poses = [];
let connections;

const leftEyeIndex = 1;  // Left eye
const rightEyeIndex = 2; // Right eye
const noseIndex = 0;       // Nose tip
let path = []; // Array to store the path of the keypoint
const smoothingFactor = 0.1; // How much to smooth, 0 to 1 (higher means smoother)

function preload() {
  // Load the bodyPose model
  bodyPose = ml5.bodyPose();
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Create the video and hide it
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // Start detecting poses in the webcam video
  bodyPose.detectStart(video, gotPoses);
  //get the skeleton connection information
  connections = bodyPose.getSkeleton();
}

function draw() {
  // Draw the webcam video
  // image(video, 0, 0, width, height);

  // Draw the path of the keypoint
  noFill();
  stroke(0);
  strokeWeight(2);
  beginShape();
  for (let pt of path) {
    vertex(pt.x, pt.y);
  }
  endShape();
}

// Callback function for when bodyPose outputs data
function gotPoses(results) {
  // Save the output to the poses variable
  poses = results;
  updatePath();
}

function updatePath() { 
  // Draw the keypoint
  if (poses.length > 0) {
    let pose = poses[0];
    let leftEye = pose.keypoints[leftEyeIndex];
    let rightEye = pose.keypoints[rightEyeIndex];
    let nose = pose.keypoints[noseIndex];

    // Ensure both eyes are detected with sufficient confidence
    // if (leftEye.score > 0.1 && rightEye.score > 0.1) {
      // Compute face width using leftEye and rightEye
      let faceWidth = dist(leftEye.x, leftEye.y, rightEye.x, rightEye.y);
      let faceWidthRatio = faceWidth / width;

      // Compute the angle of the nose from the center of the screen
      let screenCenter = createVector(width / 2, height / 2);
      let nosePos = createVector(nose.x, nose.y);
      let angle = atan2(nosePos.y - screenCenter.y, nosePos.x - screenCenter.x);

      // Calculate the mapped position on the canvas
      let mappedY = map(faceWidthRatio*10, 0, 1, 0, height); // Inverse relation, closer -> higher on y-axis
      // console.log(faceWidthRatio);
      let mappedX = map(angle, -PI, 0, width, 0); // Angle mapping to x-axis
    // console.log(angle);

      // Smoothen the path
      if (path.length > 0) {
        let lastPoint = path[path.length - 1];
        mappedX = lerp(lastPoint.x, mappedX, smoothingFactor);
        mappedY = lerp(lastPoint.y, mappedY, smoothingFactor);
      }
    
    path.push(createVector(mappedX, mappedY));

    // Draw the nose at mapped position
    // fill(0, 255, 0);
    // noStroke();
    // circle(mappedX, mappedY, 10);
  // }
  }
}

// Cleanup function to be called when sketch is stopped
function remove() {
    bodyPose.detectStop(); // Stop the bodyPose detection
    video.remove(); // Remove video capture
    clear(); // Clear the canvas
  }