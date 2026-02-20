// src/components/Pose/poseCapture.jsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Play, StopCircle, ChevronDown } from "lucide-react";

import { useRafTick } from "@/lib/gamePlayer/runtime/useRafTick";
import getPoseData from "@/lib/mediapipe/getPoseData";
import PoseDrawer from "@/lib/pose/poseDrawer";

import { computePoseMatch, perFeatureToPerSegment } from "@/lib/pose/poseMatching";

/** Make a deterministic signature for a poses map (keys sorted). */
function posesSignature(map) {
  if (!map || typeof map !== "object") return "";
  const keys = Object.keys(map).sort();
  let out = "";
  for (const k of keys) {
    const v = map[k];
    out += `${k}:${typeof v === "string" ? v : JSON.stringify(v)}|`;
  }
  return out;
}

/**
 * Stored record shape (new):
 *  {
 *    pose: <raw mediapipe pose obj>,
 *    tolerancePct: number
 *  }
 *
 * Backward compatible with legacy:
 *  <raw mediapipe pose obj>
 */
function normalizePoseRecord(value, fallbackTol = 70) {
  // already in new shape
  if (value && typeof value === "object" && value.pose && typeof value.pose === "object") {
    const tol = Number(value.tolerancePct);
    return {
      pose: value.pose,
      tolerancePct: Number.isFinite(tol) ? Math.max(0, Math.min(100, tol)) : fallbackTol,
    };
  }

  // legacy pose object
  if (value && typeof value === "object" && value.poseLandmarks) {
    return { pose: value, tolerancePct: fallbackTol };
  }

  return null;
}

/**
 * Convert incoming poses (stringified or object) into parsed pose-records.
 * If poseTolerancePctById contains a value for that key, it wins.
 */
function parseIncomingPoses(map, poseTolerancePctById, fallbackTol = 70) {
  const incoming = map && typeof map === "object" ? map : {};
  const tolMap = poseTolerancePctById && typeof poseTolerancePctById === "object" ? poseTolerancePctById : {};
  const parsed = {};

  for (const [key, value] of Object.entries(incoming)) {
    try {
      const obj = typeof value === "string" ? JSON.parse(value) : value;
      const rec = normalizePoseRecord(obj, fallbackTol);
      if (!rec) continue;

      const externalTol = Number(tolMap?.[key]);
      const tol =
        Number.isFinite(externalTol)
          ? Math.max(0, Math.min(100, externalTol))
          : Math.max(0, Math.min(100, Number(rec.tolerancePct) || fallbackTol));

      parsed[key] = { pose: rec.pose, tolerancePct: tol };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Error parsing pose:", key, e);
    }
  }
  return parsed;
}

/** Convert parsed pose-records to JSON strings (for storage). */
function stringifyPoses(recordsMap) {
  const out = {};
  for (const [k, rec] of Object.entries(recordsMap || {})) {
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
 * Derive latest pose for PoseDrawer without storing 30-60fps pose in React state.
 * (Same idea as GamePlayer)
 */
function usePoseDrawerPose(poseDataRef) {
  const [poseForDrawer, setPoseForDrawer] = useState(null);

  useRafTick({
    enabled: true,
    onTick: () => {
      const cur = poseDataRef.current ?? null;
      setPoseForDrawer((prev) => (prev === cur ? prev : cur));
    },
  });

  return poseForDrawer;
}

export default function PoseCapture({
  poses = {},
  onPosesUpdate,

  // ✅ NEW: external tolerance map stored on the level
  poseTolerancePctById = {},
  onPoseToleranceUpdate,

  disabled = false,
}) {
  // Stored poses as pose-records: key -> { pose, tolerancePct }
  const [capturedPoses, setCapturedPoses] = useState({});

  // UI state
  const [selectedPoseKey, setSelectedPoseKey] = useState(null); // view a captured pose
  const [isTestMode, setIsTestMode] = useState(false);
  const [testTargetKey, setTestTargetKey] = useState(""); // which pose to test against

  // This input edits the selected target pose's tolerance (stored per pose)
  const [thresholdPct, setThresholdPct] = useState(70);

  // Match output (updates repeatedly when test mode is on)
  const [liveMatch, setLiveMatch] = useState(null);

  // Required hidden video element for getPoseData
  const videoRef = useRef(null);

  // ✅ Live pose data stays in a ref (prevents re-render loops)
  const poseDataRef = useRef(null);

  // Keep track of incoming/outgoing signatures to avoid ping-pong
  const lastIncomingSigRef = useRef("");
  const lastSentSigRef = useRef("");

  // Throttle repeated match computations
  const lastMatchAtRef = useRef(0);

  // Sizes
  const width = 640;
  const height = 480;
  const thumbnailWidth = 120;
  const thumbnailHeight = 90;

  /* -------------------- Pose stream hook -------------------- */

  const handlePoseData = useCallback((data) => {
    poseDataRef.current = data ?? null;
  }, []);

  const { loading, error } = getPoseData({
    videoRef,
    width,
    height,
    onPoseData: handlePoseData,
  });

  // Live pose for PoseDrawer (updated via RAF, safe)
  const poseForDrawer = usePoseDrawerPose(poseDataRef);

  /* -------------------- Parent -> Local hydrate -------------------- */

  const incomingSig = useMemo(() => posesSignature(poses), [poses]);

  // ✅ also rehydrate if tolerance map changes (even if poses didn't)
  const tolSig = useMemo(() => posesSignature(poseTolerancePctById), [poseTolerancePctById]);

  useEffect(() => {
    const combinedSig = `${incomingSig}__tol__${tolSig}`;
    if (combinedSig === lastIncomingSigRef.current) return;
    lastIncomingSigRef.current = combinedSig;

    const parsed = parseIncomingPoses(poses, poseTolerancePctById, 70);
    setCapturedPoses(parsed);

    // If selection removed, clear it
    if (selectedPoseKey && !parsed[selectedPoseKey]) setSelectedPoseKey(null);

    // Ensure test target stays valid and keep threshold in sync with target pose tolerance
    const keys = Object.keys(parsed);
    if (keys.length === 0) {
      setTestTargetKey("");
      setIsTestMode(false);
      setLiveMatch(null);
      setThresholdPct(70);
    } else {
      setTestTargetKey((prev) => {
        const nextKey = prev && parsed[prev] ? prev : keys[0];
        const tol = Number(parsed?.[nextKey]?.tolerancePct);
        setThresholdPct(Number.isFinite(tol) ? tol : 70);
        return nextKey;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSig, tolSig]);

  /* -------------------- Local -> Parent sync (poses) -------------------- */

  const outgoingStringified = useMemo(() => stringifyPoses(capturedPoses), [capturedPoses]);
  const outgoingSig = useMemo(() => posesSignature(outgoingStringified), [outgoingStringified]);

  useEffect(() => {
    if (typeof onPosesUpdate !== "function") return;

    // Avoid ping-pong: compare with combined incoming signature piece for poses only
    // (We used combinedSig above; here we just avoid resending the same pose payload.)
    if (outgoingSig === lastSentSigRef.current) return;

    lastSentSigRef.current = outgoingSig;
    onPosesUpdate(outgoingStringified);
  }, [outgoingSig, outgoingStringified, onPosesUpdate]);

  /* -------------------- Derived helpers -------------------- */

  const capturedKeys = useMemo(() => Object.keys(capturedPoses || {}), [capturedPoses]);
  const capturedCount = capturedKeys.length;

  const getTargetTolerance = useCallback(
    (key) => {
      const tol = Number(capturedPoses?.[key]?.tolerancePct);
      return Number.isFinite(tol) ? Math.max(0, Math.min(100, tol)) : 70;
    },
    [capturedPoses]
  );

  const setExternalTolerance = useCallback(
    (key, tol) => {
      if (typeof onPoseToleranceUpdate !== "function" || !key) return;

      const nextTol = Math.max(0, Math.min(100, Number(tol) || 0));
      const prevMap =
        poseTolerancePctById && typeof poseTolerancePctById === "object" ? poseTolerancePctById : {};

      onPoseToleranceUpdate({
        ...prevMap,
        [key]: nextTol,
      });
    },
    [onPoseToleranceUpdate, poseTolerancePctById]
  );

  const removeExternalTolerance = useCallback(
    (key) => {
      if (typeof onPoseToleranceUpdate !== "function" || !key) return;

      const prevMap =
        poseTolerancePctById && typeof poseTolerancePctById === "object" ? poseTolerancePctById : {};

      if (!Object.prototype.hasOwnProperty.call(prevMap, key)) return;

      const next = { ...prevMap };
      delete next[key];
      onPoseToleranceUpdate(next);
    },
    [onPoseToleranceUpdate, poseTolerancePctById]
  );

  /* -------------------- Actions -------------------- */

  const handleCapture = useCallback(() => {
    const live = poseDataRef.current;
    if (!live?.poseLandmarks) {
      alert("No pose detected. Please ensure your camera is on and you're in frame.");
      return;
    }

    const key = `pose_${Date.now()}`;
    const poseCopy = JSON.parse(JSON.stringify(live)); // deep copy

    const tol = Number.isFinite(Number(thresholdPct))
      ? Math.max(0, Math.min(100, Number(thresholdPct)))
      : 70;

    setCapturedPoses((prev) => ({
      ...(prev ?? {}),
      [key]: { pose: poseCopy, tolerancePct: tol },
    }));

    // ✅ ALSO persist to level.poseTolerancePctById
    setExternalTolerance(key, tol);

    // UX
    setSelectedPoseKey((prev) => prev ?? key);
    setIsTestMode(false);
    setLiveMatch(null);
    setTestTargetKey((prev) => prev || key);
  }, [thresholdPct, setExternalTolerance]);

  const handleDelete = useCallback(
    (key) => {
      setCapturedPoses((prev) => {
        const next = { ...(prev ?? {}) };
        delete next[key];
        return next;
      });

      // ✅ ALSO remove from level.poseTolerancePctById
      removeExternalTolerance(key);

      setSelectedPoseKey((prev) => (prev === key ? null : prev));
      setLiveMatch(null);
      setTestTargetKey((prev) => (prev === key ? "" : prev));
    },
    [removeExternalTolerance]
  );

  const handleView = useCallback((key) => {
    setSelectedPoseKey(key);
    setIsTestMode(false);
    setLiveMatch(null);
  }, []);

  const updatePoseTolerance = useCallback(
    (key, nextTol) => {
      const tol = Math.max(0, Math.min(100, Number(nextTol) || 0));

      setCapturedPoses((prev) => {
        const cur = prev?.[key];
        if (!cur) return prev;
        return { ...prev, [key]: { ...cur, tolerancePct: tol } };
      });

      // ✅ ALSO persist to level.poseTolerancePctById
      setExternalTolerance(key, tol);
    },
    [setExternalTolerance]
  );

  /* -------------------- Repeated match computation (RAF + throttle) -------------------- */

  useRafTick({
    enabled: isTestMode,
    onTick: ({ now }) => {
      // throttle to ~5Hz (200ms)
      if (now - lastMatchAtRef.current < 200) return;
      lastMatchAtRef.current = now;

      const live = poseDataRef.current;
      const targetRec = testTargetKey ? capturedPoses?.[testTargetKey] : null;
      const targetPose = targetRec?.pose ?? null;

      if (!live || !targetPose) {
        setLiveMatch((prev) => (prev ? null : prev));
        return;
      }

      // Use per-pose tolerance
      const tol = getTargetTolerance(testTargetKey);

      const match = computePoseMatch({
        livePose: live,
        targetPose,
        thresholdPct: tol,
      });

      const perSegment = perFeatureToPerSegment(match.perFeature);

      setLiveMatch((prev) => {
        const prevOverall = Number(prev?.overall ?? -1);
        const nextOverall = Number(match?.overall ?? 0);
        const prevMatched = !!prev?.matched;
        const nextMatched = !!match?.matched;

        if (Math.abs(prevOverall - nextOverall) < 0.5 && prevMatched === nextMatched) return prev;
        return { ...match, perSegment };
      });
    },
  });

  /* -------------------- Derived display pose + overlay colors -------------------- */

  const displayPose = useMemo(() => {
    if (selectedPoseKey && capturedPoses?.[selectedPoseKey]?.pose) {
      return capturedPoses[selectedPoseKey].pose;
    }
    return poseForDrawer ?? null;
  }, [selectedPoseKey, capturedPoses, poseForDrawer]);

  const similarityScores = useMemo(() => {
    if (!isTestMode || !liveMatch?.perSegment) return [];
    return liveMatch.perSegment;
  }, [isTestMode, liveMatch]);

  const optionInputClass =
    "border border-gray-300 p-2 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  /* -------------------- UI -------------------- */

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-4">
      <h2 className="text-sm font-bold text-gray-900 mb-3">Pose Capture Studio</h2>

      {/* Hidden video element for MediaPipe */}
      <video ref={videoRef} className="input-video" style={{ display: "none" }} playsInline muted />

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Starting camera...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64 bg-red-50 rounded">
          <div className="text-center">
            <p className="text-sm text-red-600">Error: {String(error)}</p>
            <p className="text-xs text-gray-500 mt-2">Please check camera permissions</p>
          </div>
        </div>
      ) : (
        <>
          {/* Preview */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-700">
                {selectedPoseKey
                  ? `Viewing: ${selectedPoseKey}`
                  : isTestMode
                  ? `Test Mode • Target: ${testTargetKey || "—"}`
                  : "Live Preview"}
              </h3>

              {selectedPoseKey && (
                <button
                  type="button"
                  onClick={() => setSelectedPoseKey(null)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                  disabled={disabled}
                >
                  Back to Live
                </button>
              )}
            </div>

            <div className="border border-gray-300 rounded bg-gray-50 flex items-center justify-center overflow-hidden">
              {displayPose ? (
                <PoseDrawer
                  poseData={displayPose}
                  width={640}
                  height={480}
                  similarityScores={similarityScores}
                />
              ) : (
                <div className="h-96 flex items-center justify-center">
                  <p className="text-sm text-gray-500">No pose detected</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={handleCapture}
              disabled={disabled || !poseDataRef.current?.poseLandmarks}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Circle size={14} />
              Capture Pose
            </button>

            <button
              type="button"
              onClick={() => {
                if (isTestMode) {
                  setIsTestMode(false);
                  setLiveMatch(null);
                } else {
                  if (capturedCount === 0) {
                    alert("Capture at least one pose first.");
                    return;
                  }
                  const firstKey = testTargetKey || capturedKeys[0];
                  setTestTargetKey(firstKey);
                  setThresholdPct(getTargetTolerance(firstKey));
                  setSelectedPoseKey(null);
                  setIsTestMode(true);
                }
              }}
              disabled={disabled || !poseDataRef.current?.poseLandmarks || capturedCount === 0}
              className={[
                "flex-1 px-3 py-2 text-white text-sm font-medium rounded flex items-center justify-center gap-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isTestMode ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700",
              ].join(" ")}
            >
              {isTestMode ? (
                <>
                  <StopCircle size={14} />
                  Stop Test
                </>
              ) : (
                <>
                  <Play size={14} />
                  Test Match
                </>
              )}
            </button>
          </div>

          {/* Test controls + live results */}
          <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[240px] flex-1">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Test against</label>
                <div className="relative">
                  <select
                    className={`${optionInputClass} w-full pr-9`}
                    value={testTargetKey}
                    onChange={(e) => {
                      const k = e.target.value;
                      setTestTargetKey(k);
                      setThresholdPct(getTargetTolerance(k));
                    }}
                    disabled={disabled || capturedCount === 0}
                  >
                    {capturedKeys.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  />
                </div>
              </div>

              <div className="w-[180px]">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Pose tolerance (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={thresholdPct}
                  onChange={(e) => {
                    const v = Number(e.target.value || 0);
                    setThresholdPct(v);
                    if (testTargetKey) updatePoseTolerance(testTargetKey, v);
                  }}
                  className={`${optionInputClass} w-full`}
                  disabled={disabled || !testTargetKey}
                />
                <div className="text-[11px] text-gray-500 mt-1">
                  Saved to <code className="font-mono">poseTolerancePctById</code>.
                </div>
              </div>

              <div className="text-xs text-gray-600">
                {isTestMode ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                    Live updating…
                  </span>
                ) : (
                  <span className="text-gray-500">Start Test Match to see live score.</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-700">
                {liveMatch ? (
                  <>
                    <span className="font-semibold text-gray-900">{Math.round(liveMatch.overall)}%</span>{" "}
                    <span className={liveMatch.matched ? "text-green-700" : "text-red-700"}>
                      {liveMatch.matched ? "MATCH" : "NO MATCH"}
                    </span>{" "}
                    <span className="text-gray-500">(tolerance {liveMatch.thresholdPct}%)</span>
                  </>
                ) : (
                  <span className="text-gray-500">No score yet.</span>
                )}
              </div>

              {isTestMode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsTestMode(false);
                    setLiveMatch(null);
                  }}
                  className="text-xs text-red-600 hover:text-red-700"
                  disabled={disabled}
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Captured poses grid */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">
              Captured Poses ({capturedCount})
            </h3>

            {capturedCount === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No poses captured yet. Strike a pose and click Capture!
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {Object.entries(capturedPoses).map(([key, rec]) => {
                  const pose = rec?.pose ?? null;
                  const tol = Number.isFinite(Number(rec?.tolerancePct)) ? Number(rec.tolerancePct) : 70;

                  return (
                    <div
                      key={key}
                      className={[
                        "border rounded p-2 cursor-pointer transition",
                        selectedPoseKey === key
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400",
                      ].join(" ")}
                      onClick={() => handleView(key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") handleView(key);
                      }}
                    >
                      <div className="mb-1 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                        <PoseDrawer
                          poseData={pose}
                          width={120}
                          height={90}
                          similarityScores={[]}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs text-gray-600 truncate">{key}</span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(key);
                          }}
                          className="text-red-600 hover:text-red-700 shrink-0 disabled:opacity-50"
                          aria-label={`Delete ${key}`}
                          disabled={disabled}
                        >
                          <span className="text-xs">✕</span>
                        </button>
                      </div>

                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <span className="text-[11px] text-gray-600 whitespace-nowrap">Tol</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={tol}
                          onChange={(e) => updatePoseTolerance(key, e.target.value)}
                          disabled={disabled}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-xs bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        />
                        <span className="text-[11px] text-gray-500">%</span>

                        <button
                          type="button"
                          className="ml-auto text-[11px] text-blue-600 hover:text-blue-700 disabled:opacity-50"
                          onClick={() => {
                            setTestTargetKey(key);
                            setThresholdPct(getTargetTolerance(key));
                            setSelectedPoseKey(null);
                            setIsTestMode(true);
                          }}
                          disabled={disabled}
                        >
                          Test this
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}