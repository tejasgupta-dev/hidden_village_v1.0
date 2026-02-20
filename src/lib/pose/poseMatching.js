// src/lib/pose/poseMatching.js
// Angle-based pose similarity engine.
// Works with poseLandmarks, leftHandLandmarks, rightHandLandmarks, faceLandmarks.
// You can define any "body part" by defining angle features based on landmark indices.

const DEG = 180 / Math.PI;

/* ----------------------------- basic utils ----------------------------- */

export function toPct(value) {
  const t = Number(value);
  if (!Number.isFinite(t)) return null;
  return t <= 1 ? t * 100 : t;
}

export function clampPct(v, fallback = 70) {
  const n = toPct(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function isFinitePoint(p) {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function getPoint(poseObj, dataKey, index) {
  const arr = poseObj?.[dataKey];
  if (!Array.isArray(arr)) return null;
  const p = arr[index];
  return isFinitePoint(p) ? p : null;
}

function vec(a, b) {
  // vector from a -> b
  return { x: b.x - a.x, y: b.y - a.y, z: (b.z ?? 0) - (a.z ?? 0) };
}

function dot(u, v) {
  return u.x * v.x + u.y * v.y + u.z * v.z;
}

function mag(u) {
  return Math.sqrt(dot(u, u));
}

function angleBetweenVectors(u, v) {
  const mu = mag(u);
  const mv = mag(v);
  if (!Number.isFinite(mu) || !Number.isFinite(mv) || mu <= 1e-9 || mv <= 1e-9) return null;
  const c = clamp(dot(u, v) / (mu * mv), -1, 1);
  return Math.acos(c) * DEG; // 0..180
}

/**
 * Angle at B in triangle A-B-C (between BA and BC).
 * returns degrees 0..180
 */
function angleABC(a, b, c) {
  const u = vec(b, a); // B->A
  const v = vec(b, c); // B->C
  return angleBetweenVectors(u, v);
}

/**
 * Angle between line A->B and line C->D.
 * returns degrees 0..180
 */
function angleLineToLine(a, b, c, d) {
  const u = vec(a, b);
  const v = vec(c, d);
  return angleBetweenVectors(u, v);
}

/* -------------------------- feature definitions -------------------------- */

export function createABCFeature({
  id,
  label,
  dataKey,
  A,
  B,
  C,
  weight = 1,
  maxDiffDeg = 45,
}) {
  return {
    id,
    label: label ?? id,
    type: "ABC",
    dataKey,
    points: [A, B, C],
    weight,
    maxDiffDeg,
  };
}

export function createLineLineFeature({
  id,
  label,
  dataKey,
  A,
  B,
  C,
  D,
  weight = 1,
  maxDiffDeg = 45,
}) {
  return {
    id,
    label: label ?? id,
    type: "LINE_LINE",
    dataKey,
    points: [A, B, C, D],
    weight,
    maxDiffDeg,
  };
}

/* -------------------------- registry helpers -------------------------- */

function addHandFingerFeatures(R, side /* "LH"|"RH" */, dataKey) {
  // Hand indices (MediaPipe):
  // wrist=0
  // thumb: 1-4 (CMC, MCP, IP, TIP)
  // index: 5-8 (MCP, PIP, DIP, TIP)
  // middle: 9-12
  // ring: 13-16
  // pinky: 17-20

  const sideName = side === "LH" ? "Left" : "Right";

  const mk = (id, label, A, B, C) =>
    createABCFeature({
      id: `${side}_${id}`,
      label: `${sideName} ${label}`,
      dataKey,
      A,
      B,
      C,
      maxDiffDeg: 25,
    });

  // Thumb
  R[`${side}_THUMB_CMC`] = mk("THUMB_CMC", "thumb CMC (wrist-CMC-MCP)", 0, 1, 2);
  R[`${side}_THUMB_MCP`] = mk("THUMB_MCP", "thumb MCP (CMC-MCP-IP)", 1, 2, 3);
  R[`${side}_THUMB_IP`] = mk("THUMB_IP", "thumb IP (MCP-IP-TIP)", 2, 3, 4);

  // Index
  R[`${side}_INDEX_MCP`] = mk("INDEX_MCP", "index MCP (wrist-MCP-PIP)", 0, 5, 6);
  R[`${side}_INDEX_PIP`] = mk("INDEX_PIP", "index PIP (MCP-PIP-DIP)", 5, 6, 7);
  R[`${side}_INDEX_DIP`] = mk("INDEX_DIP", "index DIP (PIP-DIP-TIP)", 6, 7, 8);

  // Middle
  R[`${side}_MIDDLE_MCP`] = mk("MIDDLE_MCP", "middle MCP (wrist-MCP-PIP)", 0, 9, 10);
  R[`${side}_MIDDLE_PIP`] = mk("MIDDLE_PIP", "middle PIP (MCP-PIP-DIP)", 9, 10, 11);
  R[`${side}_MIDDLE_DIP`] = mk("MIDDLE_DIP", "middle DIP (PIP-DIP-TIP)", 10, 11, 12);

  // Ring
  R[`${side}_RING_MCP`] = mk("RING_MCP", "ring MCP (wrist-MCP-PIP)", 0, 13, 14);
  R[`${side}_RING_PIP`] = mk("RING_PIP", "ring PIP (MCP-PIP-DIP)", 13, 14, 15);
  R[`${side}_RING_DIP`] = mk("RING_DIP", "ring DIP (PIP-DIP-TIP)", 14, 15, 16);

  // Pinky
  R[`${side}_PINKY_MCP`] = mk("PINKY_MCP", "pinky MCP (wrist-MCP-PIP)", 0, 17, 18);
  R[`${side}_PINKY_PIP`] = mk("PINKY_PIP", "pinky PIP (MCP-PIP-DIP)", 17, 18, 19);
  R[`${side}_PINKY_DIP`] = mk("PINKY_DIP", "pinky DIP (PIP-DIP-TIP)", 18, 19, 20);

  // Spread angles (line-to-line): wrist->MCP vs wrist->MCP
  R[`${side}_INDEX_MIDDLE_SPREAD`] = createLineLineFeature({
    id: `${side}_INDEX_MIDDLE_SPREAD`,
    label: `${sideName} index-middle spread (wrist-indexMCP vs wrist-middleMCP)`,
    dataKey,
    A: 0,
    B: 5,
    C: 0,
    D: 9,
    maxDiffDeg: 25,
  });

  R[`${side}_MIDDLE_RING_SPREAD`] = createLineLineFeature({
    id: `${side}_MIDDLE_RING_SPREAD`,
    label: `${sideName} middle-ring spread (wrist-middleMCP vs wrist-ringMCP)`,
    dataKey,
    A: 0,
    B: 9,
    C: 0,
    D: 13,
    maxDiffDeg: 25,
  });

  R[`${side}_RING_PINKY_SPREAD`] = createLineLineFeature({
    id: `${side}_RING_PINKY_SPREAD`,
    label: `${sideName} ring-pinky spread (wrist-ringMCP vs wrist-pinkyMCP)`,
    dataKey,
    A: 0,
    B: 13,
    C: 0,
    D: 17,
    maxDiffDeg: 25,
  });
}

/* -------------------------- default registry -------------------------- */

export const FEATURE_REGISTRY = (() => {
  const R = {};

  // Pose indices (MediaPipe Pose):
  // 11 left shoulder, 13 left elbow, 15 left wrist
  // 12 right shoulder, 14 right elbow, 16 right wrist
  // 23 left hip, 25 left knee, 27 left ankle
  // 24 right hip, 26 right knee, 28 right ankle

  R.POSE_LEFT_ELBOW = createABCFeature({
    id: "POSE_LEFT_ELBOW",
    label: "Left elbow (shoulder-elbow-wrist)",
    dataKey: "poseLandmarks",
    A: 11,
    B: 13,
    C: 15,
    maxDiffDeg: 35,
  });

  R.POSE_RIGHT_ELBOW = createABCFeature({
    id: "POSE_RIGHT_ELBOW",
    label: "Right elbow (shoulder-elbow-wrist)",
    dataKey: "poseLandmarks",
    A: 12,
    B: 14,
    C: 16,
    maxDiffDeg: 35,
  });

  R.POSE_LEFT_SHOULDER = createABCFeature({
    id: "POSE_LEFT_SHOULDER",
    label: "Left shoulder (hip-shoulder-elbow)",
    dataKey: "poseLandmarks",
    A: 23,
    B: 11,
    C: 13,
    maxDiffDeg: 35,
  });

  R.POSE_RIGHT_SHOULDER = createABCFeature({
    id: "POSE_RIGHT_SHOULDER",
    label: "Right shoulder (hip-shoulder-elbow)",
    dataKey: "poseLandmarks",
    A: 24,
    B: 12,
    C: 14,
    maxDiffDeg: 35,
  });

  R.POSE_LEFT_KNEE = createABCFeature({
    id: "POSE_LEFT_KNEE",
    label: "Left knee (hip-knee-ankle)",
    dataKey: "poseLandmarks",
    A: 23,
    B: 25,
    C: 27,
    maxDiffDeg: 35,
  });

  R.POSE_RIGHT_KNEE = createABCFeature({
    id: "POSE_RIGHT_KNEE",
    label: "Right knee (hip-knee-ankle)",
    dataKey: "poseLandmarks",
    A: 24,
    B: 26,
    C: 28,
    maxDiffDeg: 35,
  });

  R.POSE_LEFT_HIP = createABCFeature({
    id: "POSE_LEFT_HIP",
    label: "Left hip (shoulder-hip-knee)",
    dataKey: "poseLandmarks",
    A: 11,
    B: 23,
    C: 25,
    maxDiffDeg: 35,
  });

  R.POSE_RIGHT_HIP = createABCFeature({
    id: "POSE_RIGHT_HIP",
    label: "Right hip (shoulder-hip-knee)",
    dataKey: "poseLandmarks",
    A: 12,
    B: 24,
    C: 26,
    maxDiffDeg: 35,
  });

  R.POSE_LEFT_ARM_BEND = createLineLineFeature({
    id: "POSE_LEFT_ARM_BEND",
    label: "Left arm bend (shoulder->elbow vs elbow->wrist)",
    dataKey: "poseLandmarks",
    A: 11,
    B: 13,
    C: 13,
    D: 15,
    maxDiffDeg: 35,
  });

  R.POSE_RIGHT_ARM_BEND = createLineLineFeature({
    id: "POSE_RIGHT_ARM_BEND",
    label: "Right arm bend (shoulder->elbow vs elbow->wrist)",
    dataKey: "poseLandmarks",
    A: 12,
    B: 14,
    C: 14,
    D: 16,
    maxDiffDeg: 35,
  });

  // Hands (all fingers + spreads)
  addHandFingerFeatures(R, "LH", "leftHandLandmarks");
  addHandFingerFeatures(R, "RH", "rightHandLandmarks");

  return R;
})();

/* ------------------------- feature selection logic ------------------------- */

function featureExistsOnPose(feature, livePose, targetPose) {
  const key = feature.dataKey;
  const liveArr = livePose?.[key];
  const targetArr = targetPose?.[key];
  if (!Array.isArray(liveArr) || !Array.isArray(targetArr)) return false;

  for (const i of feature.points) {
    const lp = liveArr[i];
    const tp = targetArr[i];
    if (!isFinitePoint(lp) || !isFinitePoint(tp)) return false;
  }
  return true;
}

export function chooseFeatures({
  featureIds = null,
  registry = FEATURE_REGISTRY,
  livePose,
  targetPose,
  allowDataKeys = null,
} = {}) {
  let feats = [];

  if (Array.isArray(featureIds) && featureIds.length) {
    feats = featureIds.map((id) => registry[id]).filter(Boolean);
  } else {
    // default = ALL features
    feats = Object.values(registry);
  }

  if (Array.isArray(allowDataKeys) && allowDataKeys.length) {
    feats = feats.filter((f) => allowDataKeys.includes(f.dataKey));
  }

  return feats.filter((f) => featureExistsOnPose(f, livePose, targetPose));
}

/* --------------------------- scoring computation --------------------------- */

export function computeFeatureAngle(feature, poseObj) {
  const key = feature.dataKey;

  if (feature.type === "ABC") {
    const [A, B, C] = feature.points;
    const a = getPoint(poseObj, key, A);
    const b = getPoint(poseObj, key, B);
    const c = getPoint(poseObj, key, C);
    if (!a || !b || !c) return null;
    return angleABC(a, b, c);
  }

  if (feature.type === "LINE_LINE") {
    const [A, B, C, D] = feature.points;
    const a = getPoint(poseObj, key, A);
    const b = getPoint(poseObj, key, B);
    const c = getPoint(poseObj, key, C);
    const d = getPoint(poseObj, key, D);
    if (!a || !b || !c || !d) return null;
    return angleLineToLine(a, b, c, d);
  }

  return null;
}

export function angleDiffToScore(diffDeg, maxDiffDeg = 45) {
  const m = Math.max(1, Number(maxDiffDeg) || 45);
  const d = Math.abs(Number(diffDeg));
  if (!Number.isFinite(d)) return 0;
  return clamp(100 * (1 - d / m), 0, 100);
}

export function computePoseMatch({
  livePose,
  targetPose,
  featureIds = null,
  registry = FEATURE_REGISTRY,
  allowDataKeys = null,
  thresholdPct = 70,
  weightsOverride = null,
} = {}) {
  const th = clampPct(thresholdPct, 70);

  if (!livePose || !targetPose) {
    return {
      overall: 0,
      matched: false,
      thresholdPct: th,
      perFeature: [],
      usedFeatureIds: [],
      debug: { reason: "missing_pose" },
    };
  }

  const features = chooseFeatures({
    featureIds,
    registry,
    livePose,
    targetPose,
    allowDataKeys,
  });

  if (!features.length) {
    return {
      overall: 0,
      matched: false,
      thresholdPct: th,
      perFeature: [],
      usedFeatureIds: [],
      debug: { reason: "no_features_available" },
    };
  }

  const perFeature = features.map((f) => {
    const liveAngle = computeFeatureAngle(f, livePose);
    const targetAngle = computeFeatureAngle(f, targetPose);

    const diffDeg =
      Number.isFinite(liveAngle) && Number.isFinite(targetAngle)
        ? Math.abs(liveAngle - targetAngle)
        : null;

    const score = diffDeg === null ? 0 : angleDiffToScore(diffDeg, f.maxDiffDeg);

    const baseW = Number(weightsOverride?.[f.id] ?? f.weight ?? 1);
    const weight = Number.isFinite(baseW) && baseW > 0 ? baseW : 1;

    return {
      id: f.id,
      label: f.label,
      dataKey: f.dataKey,
      type: f.type,
      points: f.points,
      weight,
      maxDiffDeg: f.maxDiffDeg,
      liveAngle,
      targetAngle,
      diffDeg,
      score,
    };
  });

  let num = 0;
  let den = 0;
  for (const r of perFeature) {
    if (!Number.isFinite(r.score) || !Number.isFinite(r.weight)) continue;
    num += r.score * r.weight;
    den += r.weight;
  }

  const overall = den > 0 ? num / den : 0;
  const matched = overall >= th;

  return {
    overall,
    matched,
    thresholdPct: th,
    perFeature,
    usedFeatureIds: perFeature.map((p) => p.id),
    debug: {
      featuresCount: perFeature.length,
      allowDataKeys: allowDataKeys ?? null,
    },
  };
}

/* ---------------------- perFeature -> perSegment (for PoseDrawer colors) ---------------------- */

/**
 * Your PoseDrawer colors by "segmentName" values like:
 * RIGHT_BICEP, LEFT_BICEP, RIGHT_FOREARM, LEFT_FOREARM, RIGHT_THIGH, LEFT_THIGH, RIGHT_SHIN, LEFT_SHIN, TORSO, etc.
 *
 * This converts angle features (perFeature) into those segment buckets.
 * Hands are returned too (as HAND_LEFT / HAND_RIGHT), but your PoseDrawer currently passes null segmentName for hands,
 * so they won’t color until you wire segment names into the hand drawing functions.
 */
export function perFeatureToPerSegment(perFeature = []) {
  const rows = Array.isArray(perFeature) ? perFeature : [];

  // Map feature IDs -> PoseDrawer segment names
    const featureIdToSegment = (id) => {
    // Arms
    if (id === "POSE_RIGHT_SHOULDER") return "RIGHT_BICEP";
    if (id === "POSE_LEFT_SHOULDER") return "LEFT_BICEP";

    if (id === "POSE_RIGHT_ELBOW" || id === "POSE_RIGHT_ARM_BEND") return "RIGHT_FOREARM";
    if (id === "POSE_LEFT_ELBOW" || id === "POSE_LEFT_ARM_BEND") return "LEFT_FOREARM";

    // Legs
    if (id === "POSE_RIGHT_HIP") return "RIGHT_THIGH";
    if (id === "POSE_LEFT_HIP") return "LEFT_THIGH";

    if (id === "POSE_RIGHT_KNEE") return "RIGHT_SHIN";
    if (id === "POSE_LEFT_KNEE") return "LEFT_SHIN";

    // Hands: map LH_/RH_ features to the drawer segment names
    // Example ids: LH_INDEX_PIP, RH_THUMB_IP, LH_RING_DIP, etc.
    if (id.startsWith("RH_") || id.startsWith("LH_")) {
        const side = id.startsWith("RH_") ? "RIGHT" : "LEFT";
        const rest = id.slice(3); // remove "RH_" or "LH_"

        // rest examples:
        // "INDEX_PIP", "INDEX_DIP", "INDEX_MCP", "THUMB_CMC", "THUMB_MCP", "THUMB_IP",
        // "MIDDLE_PIP", "RING_DIP", "PINKY_MCP",
        // "INDEX_MIDDLE_SPREAD" etc.

        // Spread features: treat as "PALM" (so palm color changes with openness)
        if (rest.endsWith("_SPREAD")) return `${side}_PALM`;

        // Thumb naming: drawer uses RIGHT_THUMB / RIGHT_THUMB_* too (we draw both)
        // Finger-level:
        const finger = rest.split("_")[0]; // THUMB / INDEX / MIDDLE / RING / PINKY
        if (!finger) return `${side}_PALM`;

        // Joint-level:
        const joint = rest.split("_")[1]; // MCP / PIP / DIP / IP / CMC
        if (!joint) return `${side}_${finger}`;

        // Map to both:
        // - overall finger polyline: RIGHT_INDEX / LEFT_THUMB
        // - joint segment overlay: RIGHT_INDEX_PIP / LEFT_THUMB_IP, etc.
        // We'll return the joint segment name so your OPTIONAL overlay gets color.
        return `${side}_${finger}_${joint}`;
    }

    return null;
    };


  // Weighted averaging per segment
  const acc = new Map(); // segment -> { num, den }
  for (const r of rows) {
    const seg = featureIdToSegment(r?.id);
    if (!seg) continue;

    const score = Number(r?.score);
    const weight = Number(r?.weight ?? 1);

    if (!Number.isFinite(score) || !Number.isFinite(weight) || weight <= 0) continue;

    const prev = acc.get(seg) ?? { num: 0, den: 0 };
    prev.num += score * weight;
    prev.den += weight;
    acc.set(seg, prev);
  }

  const out = [];
  for (const [segment, { num, den }] of acc.entries()) {
    out.push({
      segment,
      similarityScore: den > 0 ? num / den : 0,
    });
  }

  return out;
}

/* ---------------------- helpers for building settings UI ---------------------- */

export function listAvailableFeatures(registry = FEATURE_REGISTRY) {
  return Object.values(registry).map((f) => ({
    id: f.id,
    label: f.label,
    dataKey: f.dataKey,
    type: f.type,
    points: f.points,
    defaultWeight: f.weight ?? 1,
    maxDiffDeg: f.maxDiffDeg ?? 45,
  }));
}

export function withExtraFeatures(baseRegistry, extraFeatures = []) {
  const next = { ...(baseRegistry ?? {}) };
  for (const f of extraFeatures) {
    if (f?.id) next[f.id] = f;
  }
  return next;
}
