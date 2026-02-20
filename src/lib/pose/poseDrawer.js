// src/lib/pose/poseDrawer.jsx
"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { scale } from "chroma-js";
import { LANDMARK_GROUPINGS, FACEMESH_FACE_OVAL, POSE_LANDMARKS } from "./landmark";
import { landmarkToCoordinates, objMap } from "./poseDrawerHelper";

/* ----------------------------- color scaling ----------------------------- */
/**
 * similarityScore: 0..100
 * 0   => red (very wrong)
 * 50  => yellow (close)
 * 100 => green (correct)
 */
const COLOR_SCALE = scale(["#ef4444", "#facc15", "#22c55e"]).domain([0, 50, 100]);

function clamp01to100(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * Supports both:
 * - legacy: [{ segment: "RIGHT_BICEP", similarityScore: 80 }, ...]
 * - feature-style: [{ id: "LH_INDEX_PIP", score: 80 }, ...]
 *
 * We color by segmentName; if segmentName isn't found in .segment, we also try .id.
 */
function getSegmentColor(similarityScores, segmentName, fallbackHex) {
  if (!segmentName || !Array.isArray(similarityScores) || similarityScores.length === 0) {
    return fallbackHex;
  }

  const entry =
    similarityScores.find((s) => s.segment === segmentName) ||
    similarityScores.find((s) => s.id === segmentName);

  if (!entry) return fallbackHex;

  const score = clamp01to100(entry.similarityScore ?? entry.score ?? entry.value ?? 0);
  return COLOR_SCALE(score).hex();
}

/* ----------------------------- drawing constants ----------------------------- */

const LINE_WIDTH = 4;
const DEFAULT_ARM_WIDTH = 15;
const CIRCLE_RADIUS = 2;

function magnitude(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function calculateArmWidth(poseData, width, height) {
  if (!poseData?.poseLandmarks) return DEFAULT_ARM_WIDTH;

  const { RIGHT_SHOULDER, SOLAR_PLEXIS } = POSE_LANDMARKS;
  const coords = objMap(
    { RIGHT_SHOULDER, SOLAR_PLEXIS },
    landmarkToCoordinates(poseData.poseLandmarks, width, height)
  );

  return coords.RIGHT_SHOULDER && coords.SOLAR_PLEXIS
    ? magnitude(coords.RIGHT_SHOULDER, coords.SOLAR_PLEXIS) * 0.04
    : DEFAULT_ARM_WIDTH;
}

function drawPath(ctx, points, segmentName, similarityScores, { closePath = true } = {}) {
  if (!points?.length) return;

  const baseFill = "#60a5fa"; // fallback (blue-ish)
  const baseStroke = "#1d4ed8"; // fallback (darker blue)

  const fill = getSegmentColor(similarityScores, segmentName, baseFill);
  const stroke = getSegmentColor(similarityScores, segmentName, baseStroke);

  const [first, ...rest] = points;

  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const p of rest) ctx.lineTo(p.x, p.y);
  if (closePath) ctx.lineTo(first.x, first.y);

  ctx.fillStyle = fill;
  ctx.fill();

  ctx.strokeStyle = stroke;
  ctx.lineWidth = LINE_WIDTH;
  ctx.stroke();
}

/* ----------------------------- helpers for hands ----------------------------- */

// order of landmarks for each finger polyline (MediaPipe Hands)
const HAND_FINGER_INDEX_PATHS = {
  THUMB: [0, 1, 2, 3, 4],
  INDEX: [0, 5, 6, 7, 8],
  MIDDLE: [0, 9, 10, 11, 12],
  RING: [0, 13, 14, 15, 16],
  PINKY: [0, 17, 18, 19, 20],
};

// segments between joints (for per-segment coloring if you want it)
const HAND_FINGER_BONE_SEGMENTS = {
  THUMB: [
    ["CMC", [0, 1, 2]],
    ["MCP", [1, 2, 3]],
    ["IP", [2, 3, 4]],
  ],
  INDEX: [
    ["MCP", [0, 5, 6]],
    ["PIP", [5, 6, 7]],
    ["DIP", [6, 7, 8]],
  ],
  MIDDLE: [
    ["MCP", [0, 9, 10]],
    ["PIP", [9, 10, 11]],
    ["DIP", [10, 11, 12]],
  ],
  RING: [
    ["MCP", [0, 13, 14]],
    ["PIP", [13, 14, 15]],
    ["DIP", [14, 15, 16]],
  ],
  PINKY: [
    ["MCP", [0, 17, 18]],
    ["PIP", [17, 18, 19]],
    ["DIP", [18, 19, 20]],
  ],
};

function toHandPoint(lm, width, height) {
  if (!lm) return null;
  const x = lm.x * width;
  const y = lm.y * height;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function getHandPolylinePoints(hand, idxs, width, height) {
  const pts = [];
  for (const idx of idxs) {
    const p = toHandPoint(hand[idx], width, height);
    if (!p) return null;
    pts.push(p);
  }
  return pts;
}

/* ----------------------------- part drawing ----------------------------- */

const draw = {
  torso(poseData, ctx, { width, height, similarityScores }) {
    const torsoCoords = objMap(
      LANDMARK_GROUPINGS.TORSO_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );
    drawPath(ctx, Object.values(torsoCoords), "TORSO", similarityScores);
  },

  abdomen(poseData, ctx, { width, height }) {
    const abdomenCoords = objMap(
      LANDMARK_GROUPINGS.ABDOMEN_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );

    if (!abdomenCoords?.PELVIS || !abdomenCoords?.LEFT_HIP) return;

    const radius = magnitude(abdomenCoords.PELVIS, abdomenCoords.LEFT_HIP);
    ctx.beginPath();
    ctx.arc(abdomenCoords.PELVIS.x, abdomenCoords.PELVIS.y, radius, 0, 2 * Math.PI);

    ctx.fillStyle = "#60a5fa";
    ctx.fill();
  },

  biceps(poseData, ctx, { armWidth, width, height, similarityScores }) {
    const coords = objMap(
      LANDMARK_GROUPINGS.BICEP_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );

    for (const side of ["RIGHT", "LEFT"]) {
      const shoulder = coords[`${side}_SHOULDER`];
      const elbow = coords[`${side}_ELBOW`];
      if (!shoulder || !elbow) continue;

      const pts = [
        { x: shoulder.x + armWidth, y: shoulder.y + armWidth },
        { x: shoulder.x - armWidth, y: shoulder.y - armWidth },
        elbow,
      ];

      drawPath(ctx, pts, `${side}_BICEP`, similarityScores);
    }
  },

  forearms(poseData, ctx, { armWidth, width, height, similarityScores }) {
    const coords = objMap(
      LANDMARK_GROUPINGS.FOREARM_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );

    for (const side of ["RIGHT", "LEFT"]) {
      const elbow = coords[`${side}_ELBOW`];
      if (!elbow) continue;

      const handData = poseData[`${side.toLowerCase()}HandLandmarks`];
      const wrist = handData
        ? objMap(LANDMARK_GROUPINGS.WRIST_LANDMARK, landmarkToCoordinates(handData, width, height))
            .WRIST
        : coords[`${side}_WRIST`];

      if (!wrist) continue;

      const pts = [
        { x: elbow.x + armWidth, y: elbow.y + armWidth },
        { x: elbow.x - armWidth, y: elbow.y - armWidth },
        wrist,
      ];

      drawPath(ctx, pts, `${side}_FOREARM`, similarityScores);
    }
  },

  thighs(poseData, ctx, { armWidth, width, height, similarityScores }) {
    const coords = objMap(
      LANDMARK_GROUPINGS.THIGH_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );

    for (const side of ["RIGHT", "LEFT"]) {
      const hip = coords[`${side}_HIP`];
      const knee = coords[`${side}_KNEE`];
      const pelvis = coords.PELVIS;

      if (!hip || !knee || !pelvis) continue;
      if (knee?.visibility != null && knee.visibility <= 0.6) continue;

      const mag1 = magnitude(pelvis, hip);

      const pts = [
        { x: knee.x + armWidth, y: knee.y - mag1 + armWidth },
        { x: hip.x + armWidth, y: hip.y + mag1 + armWidth },
        { x: hip.x - armWidth, y: hip.y + mag1 - armWidth },
        { x: knee.x - armWidth, y: knee.y - mag1 - armWidth },
      ];

      drawPath(ctx, pts, `${side}_THIGH`, similarityScores);
    }
  },

  shins(poseData, ctx, { armWidth, width, height, similarityScores }) {
    const coords = objMap(
      LANDMARK_GROUPINGS.SHIN_LANDMARKS,
      landmarkToCoordinates(poseData.poseLandmarks, width, height)
    );

    for (const side of ["RIGHT", "LEFT"]) {
      const knee = coords[`${side}_KNEE`];
      const ankle = coords[`${side}_ANKLE`];

      if (!knee || !ankle) continue;
      if (knee?.visibility != null && knee.visibility <= 0.6) continue;

      const pts = [
        { x: knee.x + armWidth, y: knee.y + armWidth },
        { x: knee.x - armWidth, y: knee.y - armWidth },
        ankle,
      ];

      drawPath(ctx, pts, `${side}_SHIN`, similarityScores);
    }
  },

  face(poseData, ctx, { width, height }) {
    if (!poseData.faceLandmarks) return;

    const oval = FACEMESH_FACE_OVAL
      .map(([idx]) => {
        const p = poseData.faceLandmarks?.[idx];
        if (!p || p.x == null || p.y == null) return null;

        return { x: p.x * width, y: p.y * height };
      })
      .filter(Boolean);

    // keep neutral for now (no segmentName)
    drawPath(ctx, oval, null, null);

    ctx.fillStyle = "#93c5fd";
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1;

   for (const lm of poseData.faceLandmarks ?? []) {
    if (!lm || lm.x == null || lm.y == null) continue;

    const x = lm.x * width;
    const y = lm.y * height;
      if (x <= width && y <= height) {
        ctx.beginPath();
        ctx.arc(x, y, CIRCLE_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  hands(poseData, ctx, { width, height, similarityScores }) {
    for (const side of ["right", "left"]) {
      const hand = poseData[`${side}HandLandmarks`];
      if (!hand) continue;

      const SIDE = side.toUpperCase(); // RIGHT / LEFT

      // Palm polygon (from your landmark grouping)
      const palm = objMap(
        LANDMARK_GROUPINGS.PALM_LANDMARKS,
        landmarkToCoordinates(hand, width, height)
      );

      // ✅ palm colored
      drawPath(ctx, Object.values(palm), `${SIDE}_PALM`, similarityScores);

      // ✅ draw each finger polyline (whole finger color)
      for (const fingerName of Object.keys(HAND_FINGER_INDEX_PATHS)) {
        const idxs = HAND_FINGER_INDEX_PATHS[fingerName];
        const pts = getHandPolylinePoints(hand, idxs, width, height);
        if (!pts) continue;

        drawPath(ctx, pts, `${SIDE}_${fingerName}`, similarityScores, { closePath: false });
      }

      // ✅ OPTIONAL: draw each finger joint-segment (more granular color)
      // This overlays the polyline above with segment-level colors from poseMatching.
      for (const fingerName of Object.keys(HAND_FINGER_BONE_SEGMENTS)) {
        for (const [jointName, tri] of HAND_FINGER_BONE_SEGMENTS[fingerName]) {
          const pts = getHandPolylinePoints(hand, tri, width, height);
          if (!pts) continue;
          drawPath(ctx, pts, `${SIDE}_${fingerName}_${jointName}`, similarityScores, {
            closePath: false,
          });
        }
      }
    }
  },
};

/* ----------------------------- component ----------------------------- */

const PoseDrawer = forwardRef(function PoseDrawer(
  { poseData, width = 640, height = 480, similarityScores = [] },
  ref
) {
  const canvasRef = useRef(null);
  useImperativeHandle(ref, () => canvasRef.current);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!poseData) return;

    const params = {
      armWidth: calculateArmWidth(poseData, width, height),
      width,
      height,
      similarityScores: Array.isArray(similarityScores) ? similarityScores : [],
    };

    if (poseData.poseLandmarks) {
      draw.torso(poseData, ctx, params);
      draw.abdomen(poseData, ctx, params);
      draw.biceps(poseData, ctx, params);
      draw.forearms(poseData, ctx, params);
      draw.thighs(poseData, ctx, params);
      draw.shins(poseData, ctx, params);
    }

    if (poseData.faceLandmarks) {
      draw.face(poseData, ctx, params);
    }

    draw.hands(poseData, ctx, params);
  }, [poseData, width, height, similarityScores]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block", maxWidth: "100%", height: "auto" }}
    />
  );
});

export default PoseDrawer;
