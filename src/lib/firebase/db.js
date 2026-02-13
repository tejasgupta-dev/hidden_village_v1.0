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

// ============================================
// GAMEPLAY SESSION FUNCTIONS - THEY HAVENT BEEN TESTED, WILL MODIFY WHEN TIME COMES
// ============================================

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
        deviceId, // Track which device played
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

/**
 * Get all gameplay sessions for a user
 * @param {string} userId - User ID
 * @returns { success, data?, error? }
 */
export const getUserGameplaySessions = async (userId) => {
  if (!userId) {
    return { success: false, error: "Missing userId" };
  }

  try {
    const snapshot = await get(ref(db, `UserGameplay/${userId}/sessions`));

    if (!snapshot.exists()) {
      return { success: true, data: {} };
    }

    return { success: true, data: snapshot.val() };
  } catch (error) {
    console.error("getUserGameplaySessions error:", error);
    return { success: false, error: error?.message };
  }
};

/**
 * Get specific session data including all frames and video
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns { success, data?, error? }
 */
export const getSessionById = async (userId, sessionId) => {
  if (!userId || !sessionId) {
    return { success: false, error: "Missing parameters" };
  }

  try {
    const snapshot = await get(
      ref(db, `UserGameplay/${userId}/sessions/${sessionId}`)
    );

    if (!snapshot.exists()) {
      return { success: false, error: "Session not found" };
    }

    const sessionData = snapshot.val();

    // Convert frames object to sorted array for easy playback
    if (sessionData.frames) {
      const framesObj = sessionData.frames;
      sessionData.frames = Object.keys(framesObj)
        .map(key => parseInt(key))
        .sort((a, b) => a - b)
        .map(index => framesObj[index]);
    }

    return { success: true, data: sessionData };
  } catch (error) {
    console.error("getSessionById error:", error);
    return { success: false, error: error?.message };
  }
};

/**
 * Get frame range from a session (for efficient partial loading)
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {number} startFrame - Starting frame index
 * @param {number} endFrame - Ending frame index
 * @returns { success, data?, error? }
 */
export const getSessionFrameRange = async (userId, sessionId, startFrame, endFrame) => {
  if (!userId || !sessionId || startFrame === undefined || endFrame === undefined) {
    return { success: false, error: "Missing parameters" };
  }

  try {
    const frames = [];

    // Query specific frame range
    for (let i = startFrame; i <= endFrame; i++) {
      const snapshot = await get(
        ref(db, `UserGameplay/${userId}/sessions/${sessionId}/frames/${i}`)
      );
      if (snapshot.exists()) {
        frames.push(snapshot.val());
      }
    }

    return { success: true, data: frames };
  } catch (error) {
    console.error("getSessionFrameRange error:", error);
    return { success: false, error: error?.message };
  }
};

/**
 * Get total frame count for a session
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns { success, count?, error? }
 */
export const getSessionFrameCount = async (userId, sessionId) => {
  if (!userId || !sessionId) {
    return { success: false, error: "Missing parameters" };
  }

  try {
    const snapshot = await get(
      ref(db, `UserGameplay/${userId}/sessions/${sessionId}/metadata/totalFrames`)
    );

    if (!snapshot.exists()) {
      return { success: false, error: "Frame count not found" };
    }

    return { success: true, count: snapshot.val() };
  } catch (error) {
    console.error("getSessionFrameCount error:", error);
    return { success: false, error: error?.message };
  }
};

/**
 * Get session metadata only (without frames - lighter query)
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns { success, data?, error? }
 */
export const getSessionMetadata = async (userId, sessionId) => {
  if (!userId || !sessionId) {
    return { success: false, error: "Missing parameters" };
  }

  try {
    const snapshot = await get(
      ref(db, `UserGameplay/${userId}/sessions/${sessionId}/metadata`)
    );

    if (!snapshot.exists()) {
      return { success: false, error: "Session metadata not found" };
    }

    return { success: true, data: snapshot.val() };
  } catch (error) {
    console.error("getSessionMetadata error:", error);
    return { success: false, error: error?.message };
  }
};

/**
 * Delete a gameplay session
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns { success, error? }
 */
export const deleteSession = async (userId, sessionId) => {
  if (!userId || !sessionId) {
    return { success: false, error: "Missing parameters" };
  }

  try {
    // Delete from Realtime Database
    await set(ref(db, `UserGameplay/${userId}/sessions/${sessionId}`), null);

    // Note: You may also want to delete the video from Storage
    // This requires getting the video path first, then using deleteObject()

    return { success: true };
  } catch (error) {
    console.error("deleteSession error:", error);
    return { success: false, error: error?.message };
  }
};

// ============================================
// USER STATISTICS FUNCTIONS
// ============================================

/**
 * Update user statistics (scores, achievements, etc.)
 * @param {string} userId - User ID
 * @param {object} stats - Statistics object
 * @returns { success, error? }
 */
export const updateUserStats = async (userId, stats) => {
  if (!userId || !stats) {
    return { success: false, error: "Missing parameters" };
  }

  try {
    await update(ref(db, `UserStats/${userId}`), {
      ...stats,
      lastUpdated: Date.now(),
    });

    return { success: true };
  } catch (error) {
    console.error("updateUserStats error:", error);
    return { success: false, error: error?.message };
  }
};

/**
 * Get user statistics
 * @param {string} userId - User ID
 * @returns { success, data?, error? }
 */
export const getUserStats = async (userId) => {
  if (!userId) {
    return { success: false, error: "Missing userId" };
  }

  try {
    const snapshot = await get(ref(db, `UserStats/${userId}`));

    if (!snapshot.exists()) {
      return { success: true, data: {} };
    }

    return { success: true, data: snapshot.val() };
  } catch (error) {
    console.error("getUserStats error:", error);
    return { success: false, error: error?.message };
  }
};

// ============================================
// LEADERBOARD FUNCTIONS
// ============================================

/**
 * Add score to leaderboard
 * @param {string} gameId - Game ID
 * @param {string} levelId - Level ID
 * @param {string} userId - User ID
 * @param {string} userName - User display name
 * @param {number} score - Score value
 * @returns { success, error? }
 */
export const addToLeaderboard = async (
  gameId,
  levelId,
  userId,
  userName,
  score
) => {
  if (!gameId || !levelId || !userId || score === undefined) {
    return { success: false, error: "Missing parameters" };
  }

  try {
    const entryId = push(ref(db, `Leaderboards/${gameId}/${levelId}`)).key;

    await set(ref(db, `Leaderboards/${gameId}/${levelId}/${entryId}`), {
      userId,
      userName,
      score,
      timestamp: Date.now(),
    });

    return { success: true };
  } catch (error) {
    console.error("addToLeaderboard error:", error);
    return { success: false, error: error?.message };
  }
};

/**
 * Get leaderboard for a level
 * @param {string} gameId - Game ID
 * @param {string} levelId - Level ID
 * @param {number} limit - Number of top scores to return (optional)
 * @returns { success, data?, error? }
 */
export const getLeaderboard = async (gameId, levelId, limit = 100) => {
  if (!gameId || !levelId) {
    return { success: false, error: "Missing parameters" };
  }

  try {
    const snapshot = await get(ref(db, `Leaderboards/${gameId}/${levelId}`));

    if (!snapshot.exists()) {
      return { success: true, data: [] };
    }

    // Convert to array and sort by score
    const entries = Object.entries(snapshot.val()).map(([id, data]) => ({
      id,
      ...data,
    }));

    entries.sort((a, b) => b.score - a.score);

    return { success: true, data: entries.slice(0, limit) };
  } catch (error) {
    console.error("getLeaderboard error:", error);
    return { success: false, error: error?.message };
  }
};

// ============================================
// DEVICE TRACKING FUNCTIONS
// ============================================

/**
 * Get or create a unique device ID for this browser/device
 * Uses browser fingerprinting to identify device
 * @returns {string} Device ID
 */
export const getDeviceId = () => {
  // Check if device ID already exists in localStorage
  let deviceId = localStorage.getItem('deviceId');

  if (!deviceId) {
    // Generate device fingerprint based on browser/device characteristics
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency,
      navigator.deviceMemory,
    ].join('|');

    // Create hash of fingerprint + random component for uniqueness
    deviceId = `device_${btoa(fingerprint).substring(0, 20)}_${Date.now()}`;
    localStorage.setItem('deviceId', deviceId);
  }

  return deviceId;
};

/**
 * Get device information
 * @returns {object} Device details
 */
export const getDeviceInfo = () => {
  return {
    deviceId: getDeviceId(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
};

/**
 * Get all sessions for a specific device
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns { success, data?, error? }
 */
export const getDeviceSessions = async (userId, deviceId) => {
  if (!userId || !deviceId) {
    return { success: false, error: "Missing parameters" };
  }

  try {
    const snapshot = await get(ref(db, `UserGameplay/${userId}/sessions`));

    if (!snapshot.exists()) {
      return { success: true, data: [] };
    }

    // Filter sessions by device
    const allSessions = snapshot.val();
    const deviceSessions = Object.entries(allSessions)
      .filter(([_, session]) => session.metadata?.deviceId === deviceId)
      .map(([sessionId, sessionData]) => ({ sessionId, ...sessionData }));

    return { success: true, data: deviceSessions };
  } catch (error) {
    console.error("getDeviceSessions error:", error);
    return { success: false, error: error?.message };
  }
};

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================

export default {
  // Game functions
  getGamesList,

  // Level functions
  getLevelList,
  getLevelById,
  writeLevel,
  deleteLevelById,

  // Gameplay session functions
  writeGameplayFrames,
  uploadGameplayVideo,
  writeGameSession,
  getUserGameplaySessions,
  getSessionById,
  getSessionFrameRange,
  getSessionFrameCount,
  getSessionMetadata,
  deleteSession,

  // User stats
  updateUserStats,
  getUserStats,

  // Leaderboard
  addToLeaderboard,
  getLeaderboard,

  // Device tracking
  getDeviceId,
  getDeviceInfo,
  getDeviceSessions,
};

// More functions and updates needed:
// The UI security is just a wrapper, even pin is only for UI, firebase can still be accessed on modifying jsx, implement correct firebase security rules
// Implement pin logic, See if logged in users can bypass pin by knowing the game/level id and edit
// Ask if Michael wants the levels in an already made and saved game to not update on change to the levels in level editor as it is already saved,
// if levels are updated, then they would NEED to remove the old level and attach the new one in the game.
// Implement character limits, only show the users the games they have created, add group functionality like an org so that they can edit games in collaboration.
// Functions should authenticate and authorize user before critical database calls like delete, admins may be given the supreme power to override
//
// Search game by name would be implemented by filtering the list we get in menu, we will not make database calls/
// Add functions to record video, capture pose and record other data while playing game
//
// Add story, pictures etc fields for each game
//
// Games will only have level id attached to maintain fresh data and remove duplicate update,
// if needed create level id to name mapping to implement level menu for a specific game
//
// store the list of created game/level ids of each user as their field
// so that we can look it up quickly and enforce new games/levels created have distinct names
// SEE if firebase rules can implement that uniqueness for us
//
// We batch updates together to save performance





// Example: Auto-create a dummy unpublished game
/* const dummyGame = {
  id: null,
  author: user.email,
  name: "Hidden Village Prototype",
  keywords: ["test", "prototype", "demo"],
  isPublished: false,
  levelIds: {
    level1: { name: "Forest Entrance", difficulty: "Easy" },
    level2: { name: "Mountain Path", difficulty: "Medium" }
  },
  settings: {
    difficulty: "Normal",
    maxPlayers: 1,
    environment: "Fantasy"
  }
};

try {
  const result = await writeGame(
    dummyGame.id,
    dummyGame.author,
    dummyGame.name,
    dummyGame.keywords,
    dummyGame.isPublished,
    dummyGame.levelIds,
    dummyGame.settings
  );
  console.log("Auto-created dummy game:", result);
} catch (error) {
  console.error("Failed to auto-create dummy game:", error);
} */
