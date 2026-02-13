"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { scale } from "chroma-js";
import { blue, yellow, pink } from "../color";
import { LANDMARK_GROUPINGS, FACEMESH_FACE_OVAL, POSE_LANDMARKS } from "./landmark";
import { landmarkToCoordinates, objMap } from "./poseDrawerHelper";

// Color configuration and scales for similarity scoring
const COLORS = {
  fill: yellow,
  stroke: blue,
  scales: {
    fill: scale([yellow.toString(16), pink.toString(16)]).domain([0, 100]),
    stroke: scale([blue.toString(16), pink.toString(16)]).domain([0, 100])
  }
};

// Drawing configuration constants
const LINE_WIDTH = 4;
const DEFAULT_ARM_WIDTH = 15;
const CIRCLE_RADIUS = 2;

// Utility function to calculate distance between two points
const magnitude = (point1, point2) => (
  Math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2)
);

// Convert hex color to CSS format
const hexToCSS = (hex) => {
  const r = (hex >> 16) & 0xFF;
  const g = (hex >> 8) & 0xFF;
  const b = hex & 0xFF;
  return `rgb(${r}, ${g}, ${b})`;
};

// Get colors based on similarity scores for a given segment
const getSegmentColors = (similarityScores, segmentName) => {
  if (!similarityScores?.length || !segmentName) {
    return { 
      fill: hexToCSS(COLORS.fill), 
      stroke: hexToCSS(COLORS.stroke) 
    };
  }

  const score = similarityScores.find(s => s.segment === segmentName);
  if (!score) return {
    fill: hexToCSS(COLORS.fill),
    stroke: hexToCSS(COLORS.stroke)
  };

  return {
    fill: COLORS.scales.fill(score.similarityScore).hex(),
    stroke: COLORS.scales.stroke(score.similarityScore).hex()
  };
};

// Draw a connected path with the given landmarks
const drawPath = (ctx, landmarks, width, height, segmentName = '', similarityScores = [], shouldClose = true) => {
  if (!landmarks?.length || landmarks.some(l => l.x > width || l.y > height)) return;

  const { fill, stroke } = getSegmentColors(similarityScores, segmentName);
  const [first, ...rest] = landmarks;

  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  
  rest.forEach(coord => ctx.lineTo(coord.x, coord.y));
  if (shouldClose) ctx.lineTo(first.x, first.y);
  
  ctx.fillStyle = fill;
  ctx.fill();
  
  ctx.strokeStyle = stroke;
  ctx.lineWidth = LINE_WIDTH;
  ctx.stroke();
};

// Calculate arm width based on shoulder to solar plexus distance
const calculateArmWidth = (poseData, width, height) => {
  if (!poseData?.poseLandmarks) return DEFAULT_ARM_WIDTH;

  const { RIGHT_SHOULDER, SOLAR_PLEXIS } = POSE_LANDMARKS;
  const coords = objMap(
    { RIGHT_SHOULDER, SOLAR_PLEXIS },
    landmarkToCoordinates(poseData.poseLandmarks, width, height)
  );

  return coords.RIGHT_SHOULDER && coords.SOLAR_PLEXIS
    ? magnitude(coords.RIGHT_SHOULDER, coords.SOLAR_PLEXIS) * 0.04
    : DEFAULT_ARM_WIDTH;
};

// Drawing functions for different body parts
const drawingFunctions = {
  torso: (poseData, ctx, { width, height, similarityScores }) => {
    const torsoCoords = objMap(
      LANDMARK_GROUPINGS.TORSO_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );
    drawPath(ctx, Object.values(torsoCoords), width, height, 'TORSO', similarityScores);
  },

  abdomen: (poseData, ctx, { width, height }) => {
    const abdomenCoords = objMap(
      LANDMARK_GROUPINGS.ABDOMEN_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );
    const radius = magnitude(abdomenCoords.PELVIS, abdomenCoords.LEFT_HIP);
    
    ctx.beginPath();
    ctx.arc(abdomenCoords.PELVIS.x, abdomenCoords.PELVIS.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = hexToCSS(COLORS.fill);
    ctx.fill();
  },

  biceps: (poseData, ctx, { armWidth, width, height, similarityScores }) => {
    const coords = objMap(
      LANDMARK_GROUPINGS.BICEP_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );

    ['RIGHT', 'LEFT'].forEach(side => {
      const shoulder = coords[`${side}_SHOULDER`];
      const elbow = coords[`${side}_ELBOW`];
      const bicepCoords = [
        { x: shoulder.x + armWidth, y: shoulder.y + armWidth },
        { x: shoulder.x - armWidth, y: shoulder.y - armWidth },
        elbow
      ];
      drawPath(ctx, bicepCoords, width, height, `${side}_BICEP`, similarityScores);
    });
  },

  forearms: (poseData, ctx, { armWidth, width, height, similarityScores }) => {
    const coords = objMap(
      LANDMARK_GROUPINGS.FOREARM_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );

    ['RIGHT', 'LEFT'].forEach(side => {
      const handData = poseData[`${side.toLowerCase()}HandLandmarks`];
      const wrist = handData
        ? objMap(
            LANDMARK_GROUPINGS.WRIST_LANDMARK,
            landmarkToCoordinates(handData, width, height)
          ).WRIST
        : coords[`${side}_WRIST`];

      const elbow = coords[`${side}_ELBOW`];
      const forearmCoords = [
        { x: elbow.x + armWidth, y: elbow.y + armWidth },
        { x: elbow.x - armWidth, y: elbow.y - armWidth },
        wrist
      ];
      drawPath(ctx, forearmCoords, width, height, `${side}_FOREARM`, similarityScores);
    });
  },

  thighs: (poseData, ctx, { armWidth, width, height, similarityScores }) => {
    const coords = objMap(
      LANDMARK_GROUPINGS.THIGH_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );

    ['RIGHT', 'LEFT'].forEach(side => {
      if (coords[`${side}_KNEE`]?.visibility <= 0.6) return;

      const hip = coords[`${side}_HIP`];
      const knee = coords[`${side}_KNEE`];
      const pelvis = coords.PELVIS;
      const magnitude1 = magnitude(pelvis, hip);
      
      const thighCoords = [
        { x: knee.x + armWidth, y: knee.y - magnitude1 + armWidth },
        { x: hip.x + armWidth, y: hip.y + magnitude1 + armWidth },
        { x: hip.x - armWidth, y: hip.y + magnitude1 - armWidth },
        { x: knee.x - armWidth, y: knee.y - magnitude1 - armWidth }
      ];
      drawPath(ctx, thighCoords, width, height, `${side}_THIGH`, similarityScores);
    });
  },

  shins: (poseData, ctx, { armWidth, width, height, similarityScores }) => {
    const coords = objMap(
      LANDMARK_GROUPINGS.SHIN_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );

    ['RIGHT', 'LEFT'].forEach(side => {
      if (coords[`${side}_KNEE`]?.visibility <= 0.6) return;

      const knee = coords[`${side}_KNEE`];
      const ankle = coords[`${side}_ANKLE`];
      const shinCoords = [
        { x: knee.x + armWidth, y: knee.y + armWidth },
        { x: knee.x - armWidth, y: knee.y - armWidth },
        ankle
      ];
      drawPath(ctx, shinCoords, width, height, `${side}_SHIN`, similarityScores);
    });
  },

  face: (poseData, ctx, { width, height, similarityScores }) => {
    if (!poseData.faceLandmarks) return;

    // Draw face oval
    const faceOvalCoords = FACEMESH_FACE_OVAL.map(([index]) => {
      const coords = poseData.faceLandmarks[index];
      return { x: coords.x * width, y: coords.y * height };
    });
    drawPath(ctx, faceOvalCoords, width, height, 'FACE', similarityScores);

    // Draw individual landmarks
    ctx.fillStyle = hexToCSS(COLORS.fill);
    ctx.strokeStyle = hexToCSS(COLORS.stroke);
    ctx.lineWidth = LINE_WIDTH;

    poseData.faceLandmarks.forEach(landmark => {
      const x = landmark.x * width;
      const y = landmark.y * height;
      if (x <= width && y <= height) {
        ctx.beginPath();
        ctx.arc(x, y, CIRCLE_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  },

  hands: (poseData, ctx, { width, height, similarityScores }) => {
    ['right', 'left'].forEach(side => {
      const handData = poseData[`${side}HandLandmarks`];
      if (!handData) return;

      // Draw palm
      const palmCoords = objMap(
        LANDMARK_GROUPINGS.PALM_LANDMARKS,
        landmarkToCoordinates(handData, width, height)
      );
      drawPath(ctx, Object.values(palmCoords), width, height, `${side.toUpperCase()}_PALM`, similarityScores);

      // Draw fingers
      const fingerGroups = [
        LANDMARK_GROUPINGS.THUMB_LANDMARKS,
        LANDMARK_GROUPINGS.INDEX_FINGER_LANDMARKS,
        LANDMARK_GROUPINGS.MIDDLE_FINGER_LANDMARKS,
        LANDMARK_GROUPINGS.RING_FINGER_LANDMARKS,
        LANDMARK_GROUPINGS.PINKY_LANDMARKS
      ];

      fingerGroups.forEach(group => {
        const fingerCoords = objMap(
          group,
          landmarkToCoordinates(handData, width, height)
        );
        drawPath(ctx, Object.values(fingerCoords), width, height, '', similarityScores, false);
      });
    });
  }
};

const PoseDrawer = forwardRef(({ 
  poseData, 
  width = 640, 
  height = 480, 
  similarityScores = [] 
}, ref) => {
  const canvasRef = useRef(null);

  useImperativeHandle(ref, () => canvasRef.current);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!poseData) {
      console.log('No pose data available');
      return;
    }

    const params = {
      armWidth: calculateArmWidth(poseData, width, height),
      width,
      height,
      similarityScores
    };

    // Draw body parts in specific order for proper layering
    if (poseData.poseLandmarks) {
      [
        'torso',
        'abdomen',
        'biceps',
        'forearms',
        'thighs',
        'shins'
      ].forEach(part => drawingFunctions[part](poseData, ctx, params));
    }

    if (poseData.faceLandmarks) {
      drawingFunctions.face(poseData, ctx, params);
    }

    drawingFunctions.hands(poseData, ctx, params);
  }, [poseData, width, height, similarityScores]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    />
  );
});

PoseDrawer.displayName = 'PoseDrawer';

export default PoseDrawer;