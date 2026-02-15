import { apiClient } from "./apiClient";

/* ===============================
   GAME PLAY API
   For loading and playing games
================================ */

export const gamePlayApi = {
  /* ===============================
     GET GAME DATA
  ================================ */

  /**
   * Load a game for playing (public, no auth required)
   * Returns game data without sensitive info (PIN, author details, etc.)
   * @param {string} gameId - The game ID
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async load(gameId) {
    return apiClient(`/api/games/${gameId}?mode=play`);
  },

  /* ===============================
     LEVELS
  ================================ */

  /**
   * Get all levels for a game
   * @param {string} gameId - The game ID
   * @returns {Promise<{success: boolean, levels: Array}>}
   */
  async getLevels(gameId) {
    return apiClient(`/api/games/${gameId}/levels`);
  },

  /**
   * Get a specific level
   * @param {string} gameId - The game ID
   * @param {string} levelId - The level ID
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async getLevel(gameId, levelId) {
    return apiClient(`/api/games/${gameId}/levels/${levelId}`);
  },
};

/* ===============================
   HELPER FUNCTIONS FOR GAMEPLAY
================================ */

/**
 * Get game metadata for display
 * @param {Object} game - Game object
 * @returns {Object} Metadata
 */
export function getGameMetadata(game) {
  return {
    id: game.id,
    name: game.name || "Untitled Game",
    description: game.description || "",
    keywords: game.keywords || "",
    levelCount: game.levelIds?.length || 0,
    hasStoryline: game.storyline && game.storyline.length > 0,
    settings: game.settings || {},
  };
}

/**
 * Get level by index
 * @param {Object} game - Game object
 * @param {number} index - Level index
 * @returns {string|null} Level ID or null
 */
export function getLevelIdByIndex(game, index) {
  if (!game.levelIds || index < 0 || index >= game.levelIds.length) {
    return null;
  }
  return game.levelIds[index];
}

/**
 * Get level index by ID
 * @param {Object} game - Game object
 * @param {string} levelId - Level ID
 * @returns {number} Level index or -1 if not found
 */
export function getLevelIndex(game, levelId) {
  if (!game.levelIds) {
    return -1;
  }
  return game.levelIds.indexOf(levelId);
}

/**
 * Get next level ID
 * @param {Object} game - Game object
 * @param {string} currentLevelId - Current level ID
 * @returns {string|null} Next level ID or null if last level
 */
export function getNextLevelId(game, currentLevelId) {
  const currentIndex = getLevelIndex(game, currentLevelId);
  if (currentIndex === -1 || currentIndex === game.levelIds.length - 1) {
    return null;
  }
  return game.levelIds[currentIndex + 1];
}

/**
 * Get previous level ID
 * @param {Object} game - Game object
 * @param {string} currentLevelId - Current level ID
 * @returns {string|null} Previous level ID or null if first level
 */
export function getPreviousLevelId(game, currentLevelId) {
  const currentIndex = getLevelIndex(game, currentLevelId);
  if (currentIndex <= 0) {
    return null;
  }
  return game.levelIds[currentIndex - 1];
}

/**
 * Check if level is first level
 * @param {Object} game - Game object
 * @param {string} levelId - Level ID
 * @returns {boolean}
 */
export function isFirstLevel(game, levelId) {
  return getLevelIndex(game, levelId) === 0;
}

/**
 * Check if level is last level
 * @param {Object} game - Game object
 * @param {string} levelId - Level ID
 * @returns {boolean}
 */
export function isLastLevel(game, levelId) {
  const index = getLevelIndex(game, levelId);
  return index === game.levelIds.length - 1;
}

/**
 * Get level count
 * @param {Object} game - Game object
 * @returns {number}
 */
export function getLevelCount(game) {
  return game.levelIds?.length || 0;
}

/**
 * Get storyline section for a level
 * @param {Object} game - Game object
 * @param {number} levelIndex - Level index
 * @returns {Object|null} Storyline section or null
 */
export function getStorylineForLevel(game, levelIndex) {
  if (!game.storyline || levelIndex < 0 || levelIndex >= game.storyline.length) {
    return null;
  }
  return game.storyline[levelIndex];
}

/**
 * Check if game has levels
 * @param {Object} game - Game object
 * @returns {boolean}
 */
export function hasLevels(game) {
  return game.levelIds && game.levelIds.length > 0;
}

/**
 * Get game settings value
 * @param {Object} game - Game object
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if setting not found
 * @returns {*} Setting value
 */
export function getGameSetting(game, key, defaultValue = null) {
  return game.settings?.[key] ?? defaultValue;
}

/**
 * Calculate game progress
 * @param {number} currentLevelIndex - Current level index (0-based)
 * @param {number} totalLevels - Total number of levels
 * @returns {number} Progress percentage (0-100)
 */
export function calculateProgress(currentLevelIndex, totalLevels) {
  if (totalLevels === 0) {
    return 0;
  }
  return Math.round(((currentLevelIndex + 1) / totalLevels) * 100);
}

/**
 * Check if game is complete
 * @param {number} currentLevelIndex - Current level index
 * @param {number} totalLevels - Total number of levels
 * @returns {boolean}
 */
export function isGameComplete(currentLevelIndex, totalLevels) {
  return currentLevelIndex >= totalLevels - 1;
}

/**
 * Get level navigation info
 * @param {Object} game - Game object
 * @param {string} currentLevelId - Current level ID
 * @returns {Object} Navigation info
 */
export function getLevelNavigation(game, currentLevelId) {
  const currentIndex = getLevelIndex(game, currentLevelId);
  const totalLevels = getLevelCount(game);

  return {
    currentIndex,
    totalLevels,
    isFirst: isFirstLevel(game, currentLevelId),
    isLast: isLastLevel(game, currentLevelId),
    hasNext: !isLastLevel(game, currentLevelId),
    hasPrevious: !isFirstLevel(game, currentLevelId),
    nextLevelId: getNextLevelId(game, currentLevelId),
    previousLevelId: getPreviousLevelId(game, currentLevelId),
    progress: calculateProgress(currentIndex, totalLevels),
  };
}

/**
 * Format level list for UI
 * @param {Object} game - Game object
 * @param {Array} levels - Array of level objects with full data
 * @returns {Array} Formatted level list
 */
export function formatLevelList(game, levels = []) {
  return game.levelIds.map((levelId, index) => {
    const levelData = levels.find((l) => l.id === levelId);
    return {
      id: levelId,
      index,
      name: levelData?.name || `Level ${index + 1}`,
      isLocked: false, // Implement your lock logic here
      storyline: getStorylineForLevel(game, index),
    };
  });
}

/**
 * Create game state object for saving progress
 * @param {string} gameId - Game ID
 * @param {string} currentLevelId - Current level ID
 * @param {Object} additionalData - Additional state data
 * @returns {Object} Game state
 */
export function createGameState(gameId, currentLevelId, additionalData = {}) {
  return {
    gameId,
    currentLevelId,
    lastPlayed: Date.now(),
    ...additionalData,
  };
}

/**
 * Validate if game can be played
 * @param {Object} game - Game object
 * @returns {{canPlay: boolean, reason?: string}}
 */
export function validateGamePlayable(game) {
  if (!game) {
    return { canPlay: false, reason: "Game not found" };
  }

  if (!hasLevels(game)) {
    return { canPlay: false, reason: "Game has no levels" };
  }

  return { canPlay: true };
}

export default gamePlayApi;