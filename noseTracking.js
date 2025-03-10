let video;
let bodyPose;
let poses = [];
let keypointIndex = 0; // Index of the keypoint to track (e.g., 0 for nose, 5 for left shoulder, etc.)
let path = []; // Array to store the path of the keypoint
let containerWidth;
let containerHeight;

function preload() {
  // Load the bodyPose model
  bodyPose = ml5.bodyPose();
}

function setup() {
  let container = select("#canvasContainer");
  // containerWidth = container.width;
  // containerHeight = container.height;

  // let aspectRatio = 640 / 480; // Original video aspect ratio

  // if (containerWidth / containerHeight > aspectRatio) {
  //     canvasWidth = containerHeight * aspectRatio;
  //     canvasHeight = containerHeight;
  // } else {
  //     canvasWidth = containerWidth;
  //     canvasHeight = containerWidth / aspectRatio;
  // }

  let myCanvas = createCanvas(container.width, container.height);
  myCanvas.parent("canvasContainer");

  video = createCapture(VIDEO);
  // video.size(width, height);
  video.hide();

  bodyPose.detectStart(video, gotPoses);;
}

function draw() {
  // Mirror the video
  // push();
  translate(width, 0);  // Move to the right
  scale(-1, 1);         // Flip horizontally
  // image(video, 0, 0, windowWidth, windowHeight);
  image(video, 0, 0, video.width, video.height);

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
  // pop();
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
    if (keypoint.score > 0.01) {
      path.push(createVector(keypoint.x, keypoint.y));
    }
  }
}

// function distance(p1, p2) {
//   return dist(p1.x, p1.y, p2.x, p2.y);
// }

// function angle(p1, p2) {
//   return atan2(p2.y - p1.y, p2.x - p1.x);
// }

// Cleanup function to be called when sketch is stopped
function remove() {
    bodyPose.detectStop(); // Stop the bodyPose detection
    video.remove(); // Remove video capture
    clear(); // Clear the canvas
  }
