"use client";

import PoseDrawer from "@/lib/pose/poseDrawer";
import { useState, useEffect, useMemo } from "react";
import { matchSegmentToLandmarks, segmentSimilarity } from "@/lib/pose/poseDrawingUtils";
import { enrichLandmarks } from "@/lib/pose/landmark";

export function PoseMatch({
    posesToMatch = null,
    poseData = null
}) {
    const [poseToMatch, setPoseToMatch] = useState(null);
    const [similarityScores, setSimilarityScores] = useState([]);
    const [lastValidPoseData, setLastValidPoseData] = useState(null);

    const matchConfig = [
        {"segment": "RIGHT_BICEP", "data": "poseLandmarks"}, 
        {"segment": "RIGHT_FOREARM", "data": "poseLandmarks"},
        {"segment": "LEFT_BICEP", "data": "poseLandmarks"}, 
        {"segment": "LEFT_FOREARM", "data": "poseLandmarks"}
    ];

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

        const newSimilarityScores = matchConfig.map(config => {
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

    // Calculate overall similarity score
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
        <div className="bg-white rounded-lg border border-gray-300 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Pose Matching</h3>
            
            {poseToMatch ? (
                <>
                    <div className="mb-3 border border-gray-300 rounded bg-gray-50 flex items-center justify-center overflow-hidden">
                        {lastValidPoseData && lastValidPoseData.poseLandmarks ? (
                            <PoseDrawer
                                poseData={lastValidPoseData}
                                width={width}
                                height={height}
                                similarityScores={similarityScores}
                            />
                        ) : (
                            <div className="h-96 flex items-center justify-center">
                                <p className="text-sm text-gray-500">Waiting for valid pose data...</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded">
                        <h4 className="text-xs font-semibold text-gray-700 mb-2">Segment Scores:</h4>
                        <div className="space-y-1">
                            {similarityScores.map(({segment, similarityScore}) => (
                                <div key={segment} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-700">{segment}:</span>
                                    <span className={`font-semibold ${
                                        similarityScore >= 80 ? 'text-green-600' : 
                                        similarityScore >= 50 ? 'text-yellow-600' : 
                                        'text-red-600'
                                    }`}>
                                        {similarityScore.toFixed(1)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-2 pt-2 border-t border-gray-300 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900">Overall Similarity:</span>
                            <span className={`text-sm font-bold ${
                                overallSimilarity >= 80 ? 'text-green-600' : 
                                overallSimilarity >= 50 ? 'text-yellow-600' : 
                                'text-red-600'
                            }`}>
                                {overallSimilarity.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    
                    {posesToMatch.length > 1 && (
                        <button 
                            className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition"
                            onClick={cycleToNextPose}
                        >
                            Next Pose ({posesToMatch.findIndex(p => p === poseToMatch) + 1}/{posesToMatch.length})
                        </button>
                    )}
                </>
            ) : (
                <div className="h-96 flex items-center justify-center">
                    <p className="text-sm text-gray-500">No pose data available</p>
                </div>
            )}
        </div>
    );
}