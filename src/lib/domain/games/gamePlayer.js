import { gamesApi } from "./games.api";

/**
 * Domain logic for playing games
 */
export const gamePlayer = {
  /**
   * Load a game for playing
   * @param {string} gameId - The game ID
   * @param {Object} options - Options
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async load(gameId, options = {}) {
    return gamesApi.get(gameId, {
      pin: options.pin,
      params: { mode: "play" },
    });
  },

  /**
   * Get all levels for a game
   * @param {string} gameId - The game ID
   * @returns {Promise<{success: boolean, levels: Array}>}
   */
  async getLevels(gameId) {
    return gamesApi.getLevels(gameId);
  },

  /**
   * Get a specific level
   * @param {string} gameId - The game ID
   * @param {string} levelId - The level ID
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async getLevel(gameId, levelId) {
    return gamesApi.getLevel(gameId, levelId);
  },
};

/**
 * Calculate game progress
 * @param {Array} completedLevelIds - Completed level IDs
 * @param {Array} totalLevelIds - Total level IDs
 * @returns {{completed: number, total: number, percentage: number}}
 */
export function calculateProgress(completedLevelIds = [], totalLevelIds = []) {
  const completed = completedLevelIds.length;
  const total = totalLevelIds.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage };
}

/**
 * Get next level to play
 * @param {Array} levelIds - All level IDs
 * @param {Array} completedLevelIds - Completed level IDs
 * @returns {string|null} Next level ID or null if all completed
 */
export function getNextLevel(levelIds = [], completedLevelIds = []) {
  for (const levelId of levelIds) {
    if (!completedLevelIds.includes(levelId)) {
      return levelId;
    }
  }
  return null; // All levels completed
}

/**
 * Check if a level is unlocked
 * @param {string} levelId - Level ID to check
 * @param {Array} levelIds - All level IDs in order
 * @param {Array} completedLevelIds - Completed level IDs
 * @param {boolean} requireSequential - Whether levels must be played sequentially
 * @returns {boolean}
 */
export function isLevelUnlocked(
  levelId,
  levelIds = [],
  completedLevelIds = [],
  requireSequential = true
) {
  if (!requireSequential) {
    return true;
  }

  const levelIndex = levelIds.indexOf(levelId);
  if (levelIndex === -1) {
    return false; // Level doesn't exist
  }

  if (levelIndex === 0) {
    return true; // First level is always unlocked
  }

  // Check if previous level is completed
  const previousLevelId = levelIds[levelIndex - 1];
  return completedLevelIds.includes(previousLevelId);
}

/**
 * Check if game is completed
 * @param {Array} levelIds - All level IDs
 * @param {Array} completedLevelIds - Completed level IDs
 * @returns {boolean}
 */
export function isGameCompleted(levelIds = [], completedLevelIds = []) {
  if (levelIds.length === 0) {
    return false;
  }
  return levelIds.every((id) => completedLevelIds.includes(id));
}

export default gamePlayer;