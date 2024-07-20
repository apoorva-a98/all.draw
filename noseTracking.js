let video;
let bodyPose;
let poses = [];
let keypointIndex = 0; // Index of the keypoint to track (e.g., 0 for nose, 5 for left shoulder, etc.)
let path = []; // Array to store the path of the keypoint

function preload() {
  // Load the bodyPose model
  bodyPose = ml5.bodyPose();
}

function setup() {
    let myCanvas = createCanvas(640, 480);
    myCanvas.parent("canvasContainer"); // Use the ID of the div where you want the canvas to be

  // Create the video and hide it
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // Start detecting poses in the webcam video
  bodyPose.detectStart(video, gotPoses);
}

function draw() {
  // Draw the webcam video
  image(video, 0, 0, width, height);

  // Draw the path of the keypoint
  noFill();
  stroke(0, 0, 255);
  strokeWeight(2);
  beginShape();
  for (let pt of path) {
    vertex(pt.x, pt.y);
  }
  endShape();

  // Draw the keypoint
  if (poses.length > 0) {
    let pose = poses[0];
    let keypoint = pose.keypoints[keypointIndex];
    if (keypoint.score > 0.1) {
      fill(0, 255, 0);
      noStroke();
      circle(keypoint.x, keypoint.y, 10);
    }
  }
}

function gotPoses(results) {
  // Save the output to the poses variable
  poses = results;
  updatePath();
}

function updatePath() {
  if (poses.length > 0) {
    let pose = poses[0];
    let keypoint = pose.keypoints[keypointIndex];
    if (keypoint.score > 0.1) {
      path.push(createVector(keypoint.x, keypoint.y));
    }
  }
}

function distance(p1, p2) {
  return dist(p1.x, p1.y, p2.x, p2.y);
}

function angle(p1, p2) {
  return atan2(p2.y - p1.y, p2.x - p1.x);
}

// Cleanup function to be called when sketch is stopped
function remove() {
    bodyPose.detectStop(); // Stop the bodyPose detection
    video.remove(); // Remove video capture
    clear(); // Clear the canvas
  }
