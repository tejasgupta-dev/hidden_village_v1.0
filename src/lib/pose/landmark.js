"use client";

/**
 ****************************************************************************
 * MEDIAPIPE CONSTANTS (STANDALONE)
 ****************************************************************************
 * These constants are defined locally to avoid import issues with @mediapipe/holistic
 */

// Pose landmark indices (MediaPipe Holistic standard)
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
  // Custom landmarks (matching your original)
  SOLAR_PLEXIS: 33,
  PELVIS: 34,
};

// Face mesh oval indices (for face outline rendering)
export const FACEMESH_FACE_OVAL = [
  [10, 338],
  [338, 297],
  [297, 332],
  [332, 284],
  [284, 251],
  [251, 389],
  [389, 356],
  [356, 454],
  [454, 323],
  [323, 361],
  [361, 288],
  [288, 397],
  [397, 365],
  [365, 379],
  [379, 378],
  [378, 400],
  [400, 377],
  [377, 152],
  [152, 148],
  [148, 176],
  [176, 149],
  [149, 150],
  [150, 136],
  [136, 172],
  [172, 58],
  [58, 132],
  [132, 93],
  [93, 234],
  [234, 127],
  [127, 162],
  [162, 21],
  [21, 54],
  [54, 103],
  [103, 67],
  [67, 109],
  [109, 10],
];

const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
};

/**
 ****************************************************************************
 * LANDMARK GROUPINGS (matching your original structure)
 ****************************************************************************
 */
const LANDMARK_GROUPINGS = {
  BICEP_LANDMARKS: (({
    RIGHT_SHOULDER,
    LEFT_SHOULDER,
    RIGHT_ELBOW,
    LEFT_ELBOW,
  }) => ({
    RIGHT_SHOULDER,
    LEFT_SHOULDER,
    RIGHT_ELBOW,
    LEFT_ELBOW,
  }))(POSE_LANDMARKS),
  FOREARM_LANDMARKS: (({
    RIGHT_ELBOW,
    RIGHT_WRIST,
    LEFT_ELBOW,
    LEFT_WRIST,
  }) => ({
    RIGHT_ELBOW,
    RIGHT_WRIST,
    LEFT_ELBOW,
    LEFT_WRIST,
  }))(POSE_LANDMARKS),
  THIGH_LANDMARKS: (({
    LEFT_HIP,
    RIGHT_HIP,
    LEFT_KNEE,
    RIGHT_KNEE,
    PELVIS,
  }) => ({
    LEFT_HIP,
    RIGHT_HIP,
    LEFT_KNEE,
    RIGHT_KNEE,
    PELVIS,
  }))(POSE_LANDMARKS),
  TORSO_LANDMARKS: (({ RIGHT_SHOULDER, LEFT_SHOULDER, SOLAR_PLEXIS }) => ({
    RIGHT_SHOULDER,
    LEFT_SHOULDER,
    SOLAR_PLEXIS,
  }))(POSE_LANDMARKS),
  SHIN_LANDMARKS: (({ LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE }) => ({
    LEFT_KNEE,
    RIGHT_KNEE,
    LEFT_ANKLE,
    RIGHT_ANKLE,
  }))(POSE_LANDMARKS),
  ABDOMEN_LANDMARKS: (({ PELVIS, LEFT_HIP }) => ({ PELVIS, LEFT_HIP }))(
    POSE_LANDMARKS
  ),
  WRIST_LANDMARK: (({ WRIST }) => ({ WRIST }))(HAND_LANDMARKS),
  PALM_LANDMARKS: (({
    WRIST,
    THUMB_CMC,
    INDEX_FINGER_MCP,
    MIDDLE_FINGER_MCP,
    RING_FINGER_MCP,
    PINKY_MCP,
  }) => ({
    WRIST,
    THUMB_CMC,
    INDEX_FINGER_MCP,
    MIDDLE_FINGER_MCP,
    RING_FINGER_MCP,
    PINKY_MCP,
  }))(HAND_LANDMARKS),
  THUMB_LANDMARKS: (({ THUMB_CMC, THUMB_MCP, THUMB_IP, THUMB_TIP }) => ({
    THUMB_CMC,
    THUMB_MCP,
    THUMB_IP,
    THUMB_TIP,
  }))(HAND_LANDMARKS),
  INDEX_FINGER_LANDMARKS: (({
    INDEX_FINGER_MCP,
    INDEX_FINGER_PIP,
    INDEX_FINGER_DIP,
    INDEX_FINGER_TIP,
  }) => ({
    INDEX_FINGER_MCP,
    INDEX_FINGER_PIP,
    INDEX_FINGER_DIP,
    INDEX_FINGER_TIP,
  }))(HAND_LANDMARKS),
  MIDDLE_FINGER_LANDMARKS: (({
    MIDDLE_FINGER_MCP,
    MIDDLE_FINGER_PIP,
    MIDDLE_FINGER_DIP,
    MIDDLE_FINGER_TIP,
  }) => ({
    MIDDLE_FINGER_MCP,
    MIDDLE_FINGER_PIP,
    MIDDLE_FINGER_DIP,
    MIDDLE_FINGER_TIP,
  }))(HAND_LANDMARKS),
  RING_FINGER_LANDMARKS: (({
    RING_FINGER_MCP,
    RING_FINGER_PIP,
    RING_FINGER_DIP,
    RING_FINGER_TIP,
  }) => ({
    RING_FINGER_MCP,
    RING_FINGER_PIP,
    RING_FINGER_DIP,
    RING_FINGER_TIP,
  }))(HAND_LANDMARKS),
  PINKY_LANDMARKS: (({ PINKY_MCP, PINKY_PIP, PINKY_DIP, PINKY_TIP }) => ({
    PINKY_MCP,
    PINKY_PIP,
    PINKY_DIP,
    PINKY_TIP,
  }))(HAND_LANDMARKS),
};

/**
 ****************************************************************************
 * SEGMENT ANGLE LANDMARKS (matching your original structure)
 ****************************************************************************
 * Create an object that represents the three points necessary to calculate 
 * a body segment's angle
 */
const SEGMENT_ANGLE_LANDMARKS = {
  RIGHT_BICEP: (({ RIGHT_HIP, RIGHT_SHOULDER, RIGHT_ELBOW }) => ({
    RIGHT_HIP,
    RIGHT_SHOULDER,
    RIGHT_ELBOW,
  }))(POSE_LANDMARKS),
  RIGHT_FOREARM: (({ RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST }) => ({
    RIGHT_SHOULDER,
    RIGHT_ELBOW,
    RIGHT_WRIST,
  }))(POSE_LANDMARKS),
  LEFT_BICEP: (({ LEFT_HIP, LEFT_SHOULDER, LEFT_ELBOW }) => ({
    LEFT_HIP,
    LEFT_SHOULDER,
    LEFT_ELBOW,
  }))(POSE_LANDMARKS),
  LEFT_FOREARM: (({ LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST }) => ({
    LEFT_SHOULDER,
    LEFT_ELBOW,
    LEFT_WRIST,
  }))(POSE_LANDMARKS),
};

export { LANDMARK_GROUPINGS, SEGMENT_ANGLE_LANDMARKS };

/**
 * @param {Object} newResults - an object containing the new pose detection results
 * @returns {Object} - an object containing the pose detection results with calculated
 * results for pelvis and solar plexis
 * @description Calculates and adds the pose detection results for pelvis and solar plexis
 * to the pose detection results object.
 */
const enrichLandmarks = (newResults) => {
  const abdomenLandmarks = (({ RIGHT_HIP, LEFT_HIP, RIGHT_SHOULDER }) => ({
    RIGHT_HIP,
    LEFT_HIP,
    RIGHT_SHOULDER,
  }))(POSE_LANDMARKS);
  let solarPlexis = {};
  let pelvis = {};
  if (newResults.poseLandmarks) {
    pelvis.x =
      (newResults.poseLandmarks[abdomenLandmarks.RIGHT_HIP].x +
        newResults.poseLandmarks[abdomenLandmarks.LEFT_HIP].x) /
      2;
    pelvis.y =
      (newResults.poseLandmarks[abdomenLandmarks.RIGHT_HIP].y +
        newResults.poseLandmarks[abdomenLandmarks.LEFT_HIP].y) /
      2;
    solarPlexis.x = pelvis.x;
    solarPlexis.y =
      (newResults.poseLandmarks[abdomenLandmarks.RIGHT_SHOULDER].y +
        newResults.poseLandmarks[abdomenLandmarks.RIGHT_HIP].y) *
      0.6;
    newResults.poseLandmarks[POSE_LANDMARKS.PELVIS] = pelvis;
    newResults.poseLandmarks[POSE_LANDMARKS.SOLAR_PLEXIS] = solarPlexis;
  }

  return newResults;
};

/**
 * Safely calculates average face depth from pose landmarks.
 * Handles frame drops, partial tracking, and undefined landmarks.
 *
 * @param {Array} poseLandmarks - MediaPipe poseLandmarks array
 * @returns {number|null} - average depth or null if unavailable
 */
export function calculateFaceDepth(poseLandmarks) {
  if (!poseLandmarks || !Array.isArray(poseLandmarks)) {
    return null;
  }

  const faceLandmarks = [
    POSE_LANDMARKS.NOSE,
    POSE_LANDMARKS.LEFT_EYE_INNER,
    POSE_LANDMARKS.LEFT_EYE,
    POSE_LANDMARKS.LEFT_EYE_OUTER,
    POSE_LANDMARKS.RIGHT_EYE_INNER,
    POSE_LANDMARKS.RIGHT_EYE,
    POSE_LANDMARKS.RIGHT_EYE_OUTER,
    POSE_LANDMARKS.LEFT_EAR,
    POSE_LANDMARKS.RIGHT_EAR,
  ];

  let depthSum = 0;
  let validCount = 0;

  for (let i = 0; i < faceLandmarks.length; i++) {
    const index = faceLandmarks[i];
    const landmark = poseLandmarks[index];

    if (!landmark) continue;

    if (typeof landmark.z !== "number" || isNaN(landmark.z)) continue;

    depthSum += landmark.z;
    validCount++;
  }

  if (validCount === 0) {
    return null;
  }

  return depthSum / validCount;
}


export { enrichLandmarks };