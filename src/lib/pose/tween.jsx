import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import PoseDrawer from "./poseDrawer";
import { matchSegmentToLandmarks, segmentSimilarity } from "./poseDrawerHelper";
import { enrichLandmarks } from "./landmark";

const interpolateLandmark = (start, end, progress) => {
  if (!start || !end) return null;
  
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
    z: start.z + (end.z - start.z) * progress,
    visibility: start.visibility
  };
};

const interpolatePoseData = (startPose, endPose, progress) => {
  if (!startPose || !endPose) {
    console.log('Missing pose data:', { startPose, endPose });
    return null;
  }

  const result = {
    faceLandmarks: [],
    image: startPose.image,
    leftHandLandmarks: [],
    multiFaceGeometry: [],
    poseLandmarks: [],
    rightHandLandmarks: [],
    segmentationMask: [],
    za: []
  };

  // Interpolate pose landmarks
  if (startPose.poseLandmarks && endPose.poseLandmarks) {
    result.poseLandmarks = startPose.poseLandmarks.map((landmark, i) => 
      interpolateLandmark(landmark, endPose.poseLandmarks[i], progress)
    );
  }

  // Interpolate right hand landmarks
  if (startPose.rightHandLandmarks && endPose.rightHandLandmarks) {
    result.rightHandLandmarks = startPose.rightHandLandmarks.map((landmark, i) => 
      interpolateLandmark(landmark, endPose.rightHandLandmarks[i], progress)
    );
  }

  if (startPose.leftHandLandmarks && endPose.leftHandLandmarks) {
    result.leftHandLandmarks = startPose.leftHandLandmarks.map((landmark, i) => 
      interpolateLandmark(landmark, endPose.leftHandLandmarks[i], progress)
    );
  }

  // Interpolate face landmarks
  if (startPose.faceLandmarks && endPose.faceLandmarks) {
    result.faceLandmarks = startPose.faceLandmarks.map((landmark, i) => 
      interpolateLandmark(landmark, endPose.faceLandmarks[i], progress)
    );
  }

  return result;
};

const easeInOutCubic = t => 
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function Tween({ 
  poses = [], 
  duration = 2000,
  width = 800,
  height = 600,
  loop = false,
  isPlaying = false
}) {
  const [currentPose, setCurrentPose] = useState(null);
  // FIX: Use a ref for startTime to avoid stale closures and re-spawning animation loops
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);

  const animate = useCallback((timestamp) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const totalDuration = duration * (poses.length - 1);
    let progress = elapsed / totalDuration;

    // Calculate which poses to interpolate between
    const absoluteProgress = progress * (poses.length - 1);
    const currentIndex = Math.min(Math.floor(absoluteProgress), poses.length - 2);
    const nextIndex = Math.min(currentIndex + 1, poses.length - 1);
    const segmentProgress = absoluteProgress - currentIndex;

    if (progress >= 1) {
      if (loop) {
        startTimeRef.current = timestamp;
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure we end on the final pose
        setCurrentPose(poses[poses.length - 1]);
      }
      return;
    }

    // Apply easing to the segment progress
    const easedProgress = easeInOutCubic(segmentProgress);

    // Interpolate between current and next pose
    const interpolatedPose = interpolatePoseData(
      poses[currentIndex],
      poses[nextIndex],
      easedProgress
    );

    setCurrentPose(interpolatedPose);

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [poses, duration, loop, isPlaying]);

  useEffect(() => {
    if (isPlaying && poses.length > 1) {
      startTimeRef.current = null;
      // FIX: Cancel any existing animation frame before starting a new one
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, animate, poses]);

  // If no current pose, use the first pose
  const poseToRender = currentPose || poses[0];

  return (
    <div>
      {poseToRender ? (
        <PoseDrawer
          poseData={poseToRender}
          width={width}
          height={height}
          similarityScore={null}
        />
      ) : (
        <p>Pose data not available</p>
      )}
    </div>
  );
}

// FIX: Moved matchConfig outside component so it's not recreated on every render
const MATCH_CONFIG = [
  {"segment": "RIGHT_BICEP", "data": "poseLandmarks"}, 
  {"segment": "RIGHT_FOREARM", "data": "poseLandmarks"},
  {"segment": "LEFT_BICEP", "data": "poseLandmarks"}, 
  {"segment": "LEFT_FOREARM", "data": "poseLandmarks"}
];

export function PoseMatch({
    posesToMatch = null,
    poseData = null
}) {
    const [poseToMatch, setPoseToMatch] = useState(null);
    const [similarityScores, setSimilarityScores] = useState([]);
    const [lastValidPoseData, setLastValidPoseData] = useState(null);

    const width = 400;
    const height = 600;

    // Store last valid pose data to prevent whiteout screen
    useEffect(() => {
        if (poseData && poseData.poseLandmarks) {
            setLastValidPoseData(poseData);
        }
    }, [poseData]);

    // Set initial pose to match when posesToMatch changes
    useEffect(() => {
        if (posesToMatch && posesToMatch.length > 0) {
            setPoseToMatch(posesToMatch[0]);
        }
    }, [posesToMatch]);

    // Calculate pose similarity when poseData or poseToMatch changes
    useEffect(() => {
        if (!lastValidPoseData || !lastValidPoseData.poseLandmarks || !poseToMatch) return;

        const enrichedPoseData = enrichLandmarks(lastValidPoseData);
        const enrichedPoseToMatch = enrichLandmarks(poseToMatch);

        const newSimilarityScores = MATCH_CONFIG.map(config => {
            const playerSegment = matchSegmentToLandmarks(
                config,
                enrichedPoseData,
                { width, height }
            );
            const modelSegment = matchSegmentToLandmarks(
                config,
                enrichedPoseToMatch,
                { width, height }
            );

            if (!playerSegment || !modelSegment) {
                return {
                    segment: config.segment,
                    similarityScore: 0
                };
            }

            return {
                segment: config.segment,
                similarityScore: segmentSimilarity(playerSegment, modelSegment)
            };
        });

        setSimilarityScores(newSimilarityScores);
    }, [lastValidPoseData, poseToMatch]);

    // FIX: Added useMemo import — was used but missing from imports
    const overallSimilarity = useMemo(() => {
        if (similarityScores.length === 0) return 0;
        const validScores = similarityScores
            .map(score => score.similarityScore)
            .filter(score => !isNaN(score));
        if (validScores.length === 0) return 0;
        return validScores.reduce((acc, curr) => acc + curr, 0) / validScores.length;
    }, [similarityScores]);

    // Handle pose cycling
    const cycleToNextPose = () => {
        if (!posesToMatch) return;
        const currentIndex = posesToMatch.findIndex(pose => pose === poseToMatch);
        const nextIndex = (currentIndex + 1) % posesToMatch.length;
        setPoseToMatch(posesToMatch[nextIndex]);
    };

    return (
        <div className="pose-match-container">
            {poseToMatch ? (
                <>
                    <div className="pose-display">
                        {lastValidPoseData && lastValidPoseData.poseLandmarks ? (
                            <PoseDrawer
                                poseData={lastValidPoseData}
                                width={width}
                                height={height}
                                similarityScores={similarityScores}
                            />
                        ) : (
                            <p>Waiting for valid pose data...</p>
                        )}
                    </div>
                    <div className="similarity-scores">
                        {similarityScores.map(({segment, similarityScore}) => (
                            <div key={segment} className="score-item">
                                <span>{segment}:</span>
                                <span>{similarityScore.toFixed(1)}%</span>
                            </div>
                        ))}
                        <div className="overall-score">
                            <span>Overall Similarity:</span>
                            <span>{overallSimilarity.toFixed(1)}%</span>
                        </div>
                    </div>
                    {posesToMatch.length > 1 && (
                        <button 
                            className="next-pose-btn"
                            onClick={cycleToNextPose}
                        >
                            Next Pose
                        </button>
                    )}
                </>
            ) : (
                <p>Pose data not available</p>
            )}
        </div>
    );
}