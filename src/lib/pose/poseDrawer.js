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

function getSegmentColor(similarityScores, segmentName, fallbackHex) {
  if (!segmentName || !Array.isArray(similarityScores) || similarityScores.length === 0) {
    return fallbackHex;
  }
  const entry = similarityScores.find((s) => s.segment === segmentName);
  if (!entry) return fallbackHex;

  const score = clamp01to100(entry.similarityScore);
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

  const baseFill = "#60a5fa";   // fallback (blue-ish)
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
        ? objMap(
            LANDMARK_GROUPINGS.WRIST_LANDMARK,
            landmarkToCoordinates(handData, width, height)
          ).WRIST
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

    // Face oval (keep neutral)
    const oval = FACEMESH_FACE_OVAL.map(([idx]) => {
      const p = poseData.faceLandmarks[idx];
      return { x: p.x * width, y: p.y * height };
    });

    drawPath(ctx, oval, null, null);

    // Dots
    ctx.fillStyle = "#93c5fd";
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1;

    for (const lm of poseData.faceLandmarks) {
      const x = lm.x * width;
      const y = lm.y * height;
      if (x <= width && y <= height) {
        ctx.beginPath();
        ctx.arc(x, y, CIRCLE_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  hands(poseData, ctx, { width, height }) {
    for (const side of ["right", "left"]) {
      const hand = poseData[`${side}HandLandmarks`];
      if (!hand) continue;

      const palm = objMap(
        LANDMARK_GROUPINGS.PALM_LANDMARKS,
        landmarkToCoordinates(hand, width, height)
      );

      drawPath(ctx, Object.values(palm), null, null);

      const fingerGroups = [
        LANDMARK_GROUPINGS.THUMB_LANDMARKS,
        LANDMARK_GROUPINGS.INDEX_FINGER_LANDMARKS,
        LANDMARK_GROUPINGS.MIDDLE_FINGER_LANDMARKS,
        LANDMARK_GROUPINGS.RING_FINGER_LANDMARKS,
        LANDMARK_GROUPINGS.PINKY_LANDMARKS,
      ];

      for (const group of fingerGroups) {
        const finger = objMap(group, landmarkToCoordinates(hand, width, height));
        drawPath(ctx, Object.values(finger), null, null, { closePath: false });
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
