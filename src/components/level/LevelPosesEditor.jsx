"use client";

import React, { useMemo, useState, useCallback } from "react";
import PoseCapture from "@/components/Pose/poseCapture";
import PoseDrawer from "@/lib/pose/poseDrawer";

const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

const clamp = (n, min, max, fallback) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
};

/**
 * Stored record shape (new):
 *  { pose: <raw mediapipe pose obj>, tolerancePct: number }
 *
 * Backward compatible with legacy:
 *  <raw mediapipe pose obj>
 */
function normalizePoseRecord(value, fallbackTol = 70) {
  if (value && typeof value === "object" && value.pose && typeof value.pose === "object") {
    const tol = Number(value.tolerancePct);
    return {
      pose: value.pose,
      tolerancePct: Number.isFinite(tol) ? clamp(tol, 0, 100, fallbackTol) : fallbackTol,
    };
  }

  // legacy pose object
  if (value && typeof value === "object" && value.poseLandmarks) {
    return { pose: value, tolerancePct: fallbackTol };
  }

  return null;
}

function parsePoseMap(poses, poseTolerancePctById, fallbackTol = 70) {
  const incoming = isPlainObject(poses) ? poses : {};
  const tolMap = isPlainObject(poseTolerancePctById) ? poseTolerancePctById : {};

  const parsed = {};
  for (const [key, raw] of Object.entries(incoming)) {
    try {
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      const rec = normalizePoseRecord(obj, fallbackTol);
      if (!rec) continue;

      const externalTol = Number(tolMap[key]);
      const tol = Number.isFinite(externalTol) ? clamp(externalTol, 0, 100, rec.tolerancePct) : rec.tolerancePct;

      parsed[key] = { pose: rec.pose, tolerancePct: tol };
    } catch {
      // skip bad entries
    }
  }
  return parsed;
}

function stringifyPoseMap(records) {
  const out = {};
  for (const [k, rec] of Object.entries(records || {})) {
    try {
      const safe = normalizePoseRecord(rec, 70);
      if (safe) out[k] = JSON.stringify(safe);
    } catch {
      // skip
    }
  }
  return out;
}

/**
 * Pose capture section.
 * - Always shows a preview gallery (with tolerance controls)
 * - "Show/Hide Pose Capture" only toggles the camera/capture studio
 */
export default function LevelPosesEditor({
  poses = {},
  onPosesUpdate,
  onRemovePose,
  disabled = false,

  // OPTIONAL: external tolerance map (preferred long-term store)
  poseTolerancePctById = {},
  onPoseToleranceUpdate,
}) {
  const [openCapture, setOpenCapture] = useState(false);

  const records = useMemo(
    () => parsePoseMap(poses, poseTolerancePctById, 70),
    [poses, poseTolerancePctById]
  );

  const keys = useMemo(() => Object.keys(records), [records]);
  const count = keys.length;

  const setExternalTol = useCallback(
    (key, tol) => {
      if (!key) return;
      if (typeof onPoseToleranceUpdate !== "function") return;

      const nextTol = clamp(tol, 0, 100, 70);
      const prev = isPlainObject(poseTolerancePctById) ? poseTolerancePctById : {};
      onPoseToleranceUpdate({ ...prev, [key]: nextTol });
    },
    [onPoseToleranceUpdate, poseTolerancePctById]
  );

  const updateTolInPoseRecord = useCallback(
    (key, tol) => {
      if (!key) return;
      const nextTol = clamp(tol, 0, 100, 70);

      // Prefer writing to external map if available.
      if (typeof onPoseToleranceUpdate === "function") {
        setExternalTol(key, nextTol);
        return;
      }

      // Otherwise, persist tolerance into the stored pose record itself.
      if (typeof onPosesUpdate !== "function") return;

      const nextRecords = { ...records, [key]: { ...records[key], tolerancePct: nextTol } };
      onPosesUpdate(stringifyPoseMap(nextRecords));
    },
    [onPoseToleranceUpdate, onPosesUpdate, records, setExternalTol]
  );

  const removePoseKey = useCallback(
    (key) => {
      if (!key) return;

      // If parent gave a remove handler, use it.
      if (typeof onRemovePose === "function") {
        onRemovePose(key);
        return;
      }

      // Otherwise, remove via onPosesUpdate by rewriting the map.
      if (typeof onPosesUpdate !== "function") return;

      const next = { ...records };
      delete next[key];
      onPosesUpdate(stringifyPoseMap(next));

      // If using external tolerance map, also remove that entry.
      if (typeof onPoseToleranceUpdate === "function") {
        const prev = isPlainObject(poseTolerancePctById) ? poseTolerancePctById : {};
        if (Object.prototype.hasOwnProperty.call(prev, key)) {
          const nextTol = { ...prev };
          delete nextTol[key];
          onPoseToleranceUpdate(nextTol);
        }
      }
    },
    [onRemovePose, onPosesUpdate, records, onPoseToleranceUpdate, poseTolerancePctById]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Captured Poses</h3>
          <p className="text-sm text-gray-600">Total: {count}</p>
        </div>

        <button
          type="button"
          onClick={() => setOpenCapture((v) => !v)}
          disabled={disabled}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {openCapture ? "Hide Pose Capture" : "Show Pose Capture"}
        </button>
      </div>

      {/* ✅ ALWAYS-ON PREVIEW GALLERY (not tied to openCapture) */}
      {count === 0 ? (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-sm text-gray-500">
            No poses yet. Open Pose Capture and click “Capture Pose”.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {keys.map((key) => {
            const rec = records[key];
            const tol = clamp(rec?.tolerancePct, 0, 100, 70);

            return (
              <div
                key={key}
                className="border border-gray-200 rounded-xl bg-white overflow-hidden"
              >
                <div className="bg-gray-50 border-b border-gray-100 flex items-center justify-center">
                  <PoseDrawer poseData={rec?.pose ?? null} width={220} height={160} similarityScores={[]} />
                </div>

                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-700 truncate" title={key}>
                      {key}
                    </div>

                    <button
                      type="button"
                      onClick={() => removePoseKey(key)}
                      disabled={disabled}
                      className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-600 whitespace-nowrap">Tolerance</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={tol}
                      disabled={disabled}
                      onChange={(e) => updateTolInPoseRecord(key, e.target.value)}
                      className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white text-black
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-[11px] text-gray-500">%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Capture Studio (toggle only affects camera UI) */}
      {openCapture && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <PoseCapture
            poses={poses}
            onPosesUpdate={onPosesUpdate}
            disabled={disabled}
            poseTolerancePctById={poseTolerancePctById}
            onPoseToleranceUpdate={onPoseToleranceUpdate}
          />
        </div>
      )}

      <p className="text-sm text-gray-500">
        These poses can be used for pose matching during gameplay.
      </p>
    </div>
  );
}