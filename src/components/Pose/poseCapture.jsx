"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import GetPoseData from "@/lib/mediapipe/getPoseData";
import PoseDrawer from "@/lib/pose/poseDrawer";
import { Camera, Circle, Play, StopCircle } from "lucide-react";

export default function PoseCapture({ poses = {}, onPosesUpdate }) {
  const [capturedPoses, setCapturedPoses] = useState({});
  const [selectedPoseKey, setSelectedPoseKey] = useState(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testResults, setTestResults] = useState(null);
  
  const videoRef = useRef(null);

  // Video dimensions
  const width = 640;
  const height = 480;
  const thumbnailWidth = 120;
  const thumbnailHeight = 90;

  // Get pose data from camera
  const { poseData, loading, error } = GetPoseData({ width, height });

  // Load existing poses on mount
  useEffect(() => {
    if (poses && Object.keys(poses).length > 0) {
      const parsedPoses = {};
      Object.entries(poses).forEach(([key, value]) => {
        try {
          parsedPoses[key] = typeof value === 'string' ? JSON.parse(value) : value;
        } catch (e) {
          console.error('Error parsing pose:', e);
        }
      });
      setCapturedPoses(parsedPoses);
    }
  }, []); // Only on mount

  // Capture current pose
  const handleCapture = () => {
    if (!poseData || !poseData.poseLandmarks) {
      alert("No pose detected. Please ensure your camera is on and you're in frame.");
      return;
    }

    const timestamp = Date.now();
    const key = `pose_${timestamp}`;
    
    // Create a deep copy to avoid reference issues
    const poseCopy = JSON.parse(JSON.stringify(poseData));
    
    const newPoses = {
      ...capturedPoses,
      [key]: poseCopy,
    };

    setCapturedPoses(newPoses);
    
    // Convert to JSON strings for storage
    const stringifiedPoses = {};
    Object.entries(newPoses).forEach(([k, v]) => {
      stringifiedPoses[k] = JSON.stringify(v);
    });
    
    onPosesUpdate(stringifiedPoses);
  };

  // Delete a captured pose
  const handleDelete = (key) => {
    const newPoses = { ...capturedPoses };
    delete newPoses[key];
    setCapturedPoses(newPoses);

    const stringifiedPoses = {};
    Object.entries(newPoses).forEach(([k, v]) => {
      stringifiedPoses[k] = JSON.stringify(v);
    });
    
    onPosesUpdate(stringifiedPoses);
    
    // Clear selection if deleted pose was selected
    if (selectedPoseKey === key) {
      setSelectedPoseKey(null);
    }
  };

  // View a captured pose
  const handleView = (key) => {
    setSelectedPoseKey(key);
    setIsTestMode(false);
  };

  // Test pose matching
  const handleTestPose = () => {
    if (!poseData || !poseData.poseLandmarks) {
      alert("No current pose detected.");
      return;
    }

    if (Object.keys(capturedPoses).length === 0) {
      alert("No poses to match against. Capture some poses first.");
      return;
    }

    setIsTestMode(true);
    
    // Calculate similarity
    const results = Object.entries(capturedPoses).map(([key, pose]) => {
      const similarity = calculatePoseSimilarity(poseData, pose);
      return { key, similarity };
    });

    setTestResults(results.sort((a, b) => b.similarity - a.similarity));
  };

  // Basic pose similarity calculation
  const calculatePoseSimilarity = (pose1, pose2) => {
    if (!pose1.poseLandmarks || !pose2.poseLandmarks) return 0;

    const landmarks1 = pose1.poseLandmarks;
    const landmarks2 = pose2.poseLandmarks;

    let totalDistance = 0;
    let count = 0;

    // Compare key landmarks
    const keyLandmarks = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    
    keyLandmarks.forEach(index => {
      if (landmarks1[index] && landmarks2[index]) {
        const dist = Math.sqrt(
          Math.pow(landmarks1[index].x - landmarks2[index].x, 2) +
          Math.pow(landmarks1[index].y - landmarks2[index].y, 2)
        );
        totalDistance += dist;
        count++;
      }
    });

    const avgDistance = totalDistance / count;
    const similarity = Math.max(0, Math.min(100, (1 - avgDistance * 2) * 100));
    
    return Math.round(similarity);
  };

  // Get the pose to display (selected or live)
  const displayPose = useMemo(() => {
    if (selectedPoseKey && capturedPoses[selectedPoseKey]) {
      return capturedPoses[selectedPoseKey];
    }
    return poseData;
  }, [selectedPoseKey, capturedPoses, poseData]);

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-4">
      <h2 className="text-sm font-bold text-gray-900 mb-3">Pose Capture Studio</h2>

      {/* Hidden video element for MediaPipe */}
      <video
        ref={videoRef}
        className="input-video"
        style={{ display: 'none' }}
        playsInline
      />

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Starting camera...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64 bg-red-50 rounded">
          <div className="text-center">
            <p className="text-sm text-red-600">Error: {error}</p>
            <p className="text-xs text-gray-500 mt-2">Please check camera permissions</p>
          </div>
        </div>
      ) : (
        <>
          {/* Live Preview or Selected Pose */}
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
                  onClick={() => setSelectedPoseKey(null)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Back to Live
                </button>
              )}
            </div>
            
            <div className="border border-gray-300 rounded bg-gray-50 flex items-center justify-center overflow-hidden">
              {displayPose ? (
                <PoseDrawer
                  poseData={displayPose}
                  width={width}
                  height={height}
                  similarityScores={[]}
                />
              ) : (
                <div className="h-96 flex items-center justify-center">
                  <p className="text-sm text-gray-500">No pose detected</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleCapture}
              disabled={!poseData}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Circle size={14} />
              Capture Pose
            </button>
            
            <button
              onClick={() => {
                if (isTestMode) {
                  setIsTestMode(false);
                  setTestResults(null);
                } else {
                  handleTestPose();
                }
              }}
              disabled={!poseData || Object.keys(capturedPoses).length === 0}
              className={`flex-1 px-3 py-2 text-white text-sm font-medium rounded flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isTestMode ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              }`}
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

          {/* Test Results */}
          {isTestMode && testResults && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">Match Results:</h3>
              <div className="space-y-1">
                {testResults.map(({ key, similarity }) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate flex-1">{key}</span>
                    <span className={`font-semibold ml-2 ${
                      similarity >= 80 ? 'text-green-600' : 
                      similarity >= 50 ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {similarity}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Captured Poses Grid */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">
              Captured Poses ({Object.keys(capturedPoses).length})
            </h3>
            
            {Object.keys(capturedPoses).length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No poses captured yet. Strike a pose and click Capture!
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {Object.entries(capturedPoses).map(([key, pose]) => (
                  <div
                    key={key}
                    className={`border rounded p-2 cursor-pointer transition ${
                      selectedPoseKey === key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div 
                      onClick={() => handleView(key)}
                      className="mb-1 bg-gray-100 rounded flex items-center justify-center overflow-hidden"
                    >
                      <PoseDrawer
                        poseData={pose}
                        width={thumbnailWidth}
                        height={thumbnailHeight}
                        similarityScores={[]}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 truncate">
                        {key}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(key);
                        }}
                        className="text-red-600 hover:text-red-700"
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