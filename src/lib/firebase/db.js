import {
  ref,
  push,
  getDatabase,
  get,
  update,
  set
} from "firebase/database";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

import { db, storage } from "@/lib/firebase/firebaseClient";

/**
 * Write batch of frame data for a gameplay session
 * Uses efficient batch writes without reading entire array
 * Path: UserGameplay/{userId}/games/{gameId}/levels/{levelId}/sessions/{sessionId}/frames/{frameIndex}
 * @param {string} userId - User ID
 * @param {string} gameId - Game ID
 * @param {string} levelId - Level ID
 * @param {string} sessionId - Session ID
 * @param {array} framesBatch - Array of frame data
 * @param {number} startIndex - Starting frame index for this batch
 * @returns { success, nextIndex?, error? }
 */
export const writeGameplayFrames = async (
  userId,
  gameId,
  levelId,
  sessionId,
  framesBatch,
  startIndex
) => {
  if (!userId || !gameId || !levelId || !sessionId || !framesBatch || framesBatch.length === 0 || startIndex === undefined) {
    return { success: false, error: "Invalid parameters" };
  }

  try {
    // Build update object with indexed keys (no read required!)
    const updates = {};
    framesBatch.forEach((frame, index) => {
      const frameIndex = startIndex + index;
      updates[`UserGameplay/${userId}/games/${gameId}/levels/${levelId}/sessions/${sessionId}/frames/${frameIndex}`] = frame;
    });

    // Single atomic write for all frames in batch
    await update(ref(db), updates);

    return {
      success: true,
      nextIndex: startIndex + framesBatch.length
    };
  } catch (error) {
    console.error("writeGameplayFrames error:", error);
    return { success: false, error: error?.message };
  }
};

/**
 * Upload video to Firebase Storage (NOT Realtime Database - videos are too large)
 * @param {string} userId - User ID
 * @param {string} gameId - Game ID
 * @param {string} levelId - Level ID
 * @param {string} sessionId - Session ID
 * @param {Blob} videoBlob - Video blob data
 * @returns { success, url?, error? }
 */
export const uploadGameplayVideo = async (
  userId,
  gameId,
  levelId,
  sessionId,
  videoBlob
) => {
  if (!userId || !gameId || !levelId || !sessionId || !videoBlob) {
    return { success: false, error: "Invalid parameters" };
  }

  try {
    const videoPath = `gameplay-videos/${userId}/${gameId}/${levelId}/${sessionId}.webm`;
    const videoRef = storageRef(storage, videoPath);

    // Upload video to Storage
    await uploadBytes(videoRef, videoBlob);

    // Get download URL
    const downloadURL = await getDownloadURL(videoRef);

    // Store URL reference in Realtime Database
    await set(
      ref(db, `UserGameplay/${userId}/games/${gameId}/levels/${levelId}/sessions/${sessionId}/video`),
      {
        url: downloadURL,
        path: videoPath,
        uploadedAt: Date.now(),
      }
    );

    return { success: true, url: downloadURL };
  } catch (error) {
    console.error("uploadGameplayVideo error:", error);
    return { success: false, error: error?.message };
  }
};

/**
 * Write gameplay session metadata
 * @param {string} userId - User ID
 * @param {string} gameId - Game ID
 * @param {string} levelId - Level ID
 * @param {string} sessionId - Session ID
 * @param {string} deviceId - Device identifier (browser fingerprint, device UUID, etc.)
 * @param {object} sessionData - Session metadata (score, duration, etc.)
 * @returns { success, error? }
 */
export const writeGameSession = async (
  userId,
  gameId,
  levelId,
  sessionId,
  deviceId,
  sessionData
) => {
  if (!userId || !sessionId || !deviceId || !sessionData) {
    return { success: false, error: "Invalid parameters" };
  }

  try {
    await set(
      ref(db, `UserGameplay/${userId}/sessions/${sessionId}/metadata`),
      {
        gameId,
        levelId,
        deviceId,
        ...sessionData,
        createdAt: Date.now(),
      }
    );

    return { success: true };
  } catch (error) {
    console.error("writeGameSession error:", error);
    return { success: false, error: error?.message };
  }
};

export default {
  // Gameplay session functions
  writeGameplayFrames,
  uploadGameplayVideo,
  writeGameSession,
};