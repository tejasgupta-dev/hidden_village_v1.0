"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import getPoseData from "@/lib/mediapipe/getPoseData";
import PoseDrawer from "@/lib/pose/poseDrawer";
import { Circle, Play, StopCircle } from "lucide-react";

/** Make a deterministic signature for a poses map (keys sorted). */
function posesSignature(map) {
  if (!map || typeof map !== "object") return "";
  const keys = Object.keys(map).sort();
  let out = "";
  for (const k of keys) {
    const v = map[k];
    // v is typically a JSON string already; keep as-is if string
    out += `${k}:${typeof v === "string" ? v : JSON.stringify(v)}|`;
  }
  return out;
}

/** Convert incoming poses (stringified or object) into parsed objects. */
function parseIncomingPoses(map) {
  const incoming = map && typeof map === "object" ? map : {};
  const parsed = {};
  for (const [key, value] of Object.entries(incoming)) {
    try {
      parsed[key] = typeof value === "string" ? JSON.parse(value) : value;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Error parsing pose:", key, e);
    }
  }
  return parsed;
}

/** Convert parsed pose objects to JSON strings (for storage). */
function stringifyPoses(parsedMap) {
  const out = {};
  for (const [k, v] of Object.entries(parsedMap || {})) {
    try {
      out[k] = typeof v === "string" ? v : JSON.stringify(v);
    } catch {
      // skip unserializable
    }
  }
  return out;
}

export default function PoseCapture({ poses = {}, onPosesUpdate }) {
  const [capturedPoses, setCapturedPoses] = useState({});
  const [selectedPoseKey, setSelectedPoseKey] = useState(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testResults, setTestResults] = useState(null);

  const [poseData, setPoseData] = useState(null);
  const videoRef = useRef(null);

  // Keep track of latest "incoming" signature to prevent ping-pong syncing
  const lastIncomingSigRef = useRef("");
  // Keep track of last "outgoing" signature to avoid repeated sends
  const lastSentSigRef = useRef("");

  // Sizes
  const width = 640;
  const height = 480;
  const thumbnailWidth = 120;
  const thumbnailHeight = 90;

  /* -------------------- MediaPipe hook -------------------- */

  const handlePoseData = useCallback((data) => {
    setPoseData(data ?? null);
  }, []);

  const { loading, error } = getPoseData({
    videoRef,
    width,
    height,
    onPoseData: handlePoseData,
  });

  /* -------------------- Parent -> Local hydrate (signature guarded) -------------------- */

  const incomingSig = useMemo(() => posesSignature(poses), [poses]);

  useEffect(() => {
    // Only hydrate if content actually changed
    if (incomingSig === lastIncomingSigRef.current) return;

    lastIncomingSigRef.current = incomingSig;

    const parsed = parseIncomingPoses(poses);

    setCapturedPoses(parsed);

    // Clear selection if pose removed
    if (selectedPoseKey && !parsed[selectedPoseKey]) {
      setSelectedPoseKey(null);
    }

    // Reset test mode on external changes
    setIsTestMode(false);
    setTestResults(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSig]); // IMPORTANT: depend on sig, not poses object identity

  /* -------------------- Local -> Parent sync (signature guarded) -------------------- */

  const outgoingStringified = useMemo(() => stringifyPoses(capturedPoses), [capturedPoses]);
  const outgoingSig = useMemo(() => posesSignature(outgoingStringified), [outgoingStringified]);

  useEffect(() => {
    if (typeof onPosesUpdate !== "function") return;

    // If outgoing matches incoming, no need to update parent (prevents infinite loop)
    if (outgoingSig === lastIncomingSigRef.current) return;

    // Also avoid re-sending the exact same outgoing value repeatedly
    if (outgoingSig === lastSentSigRef.current) return;

    lastSentSigRef.current = outgoingSig;
    onPosesUpdate(outgoingStringified);
  }, [outgoingSig, outgoingStringified, onPosesUpdate]);

  /* -------------------- Actions -------------------- */

  const handleCapture = useCallback(() => {
    if (!poseData?.poseLandmarks) {
      alert("No pose detected. Please ensure your camera is on and you're in frame.");
      return;
    }

    const key = `pose_${Date.now()}`;
    const poseCopy = JSON.parse(JSON.stringify(poseData)); // deep copy

    setCapturedPoses((prev) => ({ ...prev, [key]: poseCopy }));

    // UX
    setSelectedPoseKey((prev) => prev ?? key);
    setIsTestMode(false);
    setTestResults(null);
  }, [poseData]);

  const handleDelete = useCallback((key) => {
    setCapturedPoses((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    setSelectedPoseKey((prev) => (prev === key ? null : prev));
    setIsTestMode(false);
    setTestResults(null);
  }, []);

  const handleView = useCallback((key) => {
    setSelectedPoseKey(key);
    setIsTestMode(false);
    setTestResults(null);
  }, []);

  const calculatePoseSimilarity = useCallback((pose1, pose2) => {
    if (!pose1?.poseLandmarks || !pose2?.poseLandmarks) return 0;

    const a = pose1.poseLandmarks;
    const b = pose2.poseLandmarks;

    let total = 0;
    let count = 0;

    // Key landmarks
    const keyLandmarks = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

    for (const idx of keyLandmarks) {
      if (!a[idx] || !b[idx]) continue;
      const dx = a[idx].x - b[idx].x;
      const dy = a[idx].y - b[idx].y;
      total += Math.sqrt(dx * dx + dy * dy);
      count++;
    }

    if (!count) return 0;

    const avg = total / count;
    const similarity = Math.max(0, Math.min(100, (1 - avg * 2) * 100));
    return Math.round(similarity);
  }, []);

  const handleTestPose = useCallback(() => {
    if (!poseData?.poseLandmarks) {
      alert("No current pose detected.");
      return;
    }
    const keys = Object.keys(capturedPoses);
    if (!keys.length) {
      alert("No poses to match against. Capture some poses first.");
      return;
    }

    setIsTestMode(true);
    setSelectedPoseKey(null);

    const results = keys
      .map((k) => ({
        key: k,
        similarity: calculatePoseSimilarity(poseData, capturedPoses[k]),
      }))
      .sort((x, y) => y.similarity - x.similarity);

    setTestResults(results);
  }, [poseData, capturedPoses, calculatePoseSimilarity]);

  /* -------------------- Derived -------------------- */

  const displayPose = useMemo(() => {
    if (selectedPoseKey && capturedPoses[selectedPoseKey]) return capturedPoses[selectedPoseKey];
    return poseData;
  }, [selectedPoseKey, capturedPoses, poseData]);

  const capturedCount = Object.keys(capturedPoses).length;

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
                  ? "Test Mode - Match Your Pose"
                  : "Live Preview"}
              </h3>

              {selectedPoseKey && (
                <button
                  type="button"
                  onClick={() => setSelectedPoseKey(null)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Back to Live
                </button>
              )}
            </div>

            <div className="border border-gray-300 rounded bg-gray-50 flex items-center justify-center overflow-hidden">
              {displayPose ? (
                <PoseDrawer poseData={displayPose} width={width} height={height} similarityScores={[]} />
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
              disabled={!poseData?.poseLandmarks}
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
                  setTestResults(null);
                } else {
                  handleTestPose();
                }
              }}
              disabled={!poseData?.poseLandmarks || capturedCount === 0}
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

          {/* Test results */}
          {isTestMode && testResults && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">Match Results:</h3>
              <div className="space-y-1">
                {testResults.map(({ key, similarity }) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate flex-1">{key}</span>
                    <span
                      className={[
                        "font-semibold ml-2",
                        similarity >= 80 ? "text-green-600" : similarity >= 50 ? "text-yellow-600" : "text-red-600",
                      ].join(" ")}
                    >
                      {similarity}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                {Object.entries(capturedPoses).map(([key, pose]) => (
                  <div
                    key={key}
                    className={[
                      "border rounded p-2 cursor-pointer transition",
                      selectedPoseKey === key ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400",
                    ].join(" ")}
                    onClick={() => handleView(key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleView(key);
                    }}
                  >
                    <div className="mb-1 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                      <PoseDrawer poseData={pose} width={thumbnailWidth} height={thumbnailHeight} similarityScores={[]} />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-600 truncate">{key}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(key);
                        }}
                        className="text-red-600 hover:text-red-700 shrink-0"
                        aria-label={`Delete ${key}`}
                      >
                        <span className="text-xs">✕</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
