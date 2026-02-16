import gamesApi from "@/lib/api/games.api";

/**
 * Domain logic for game editing and management
 * Requires authentication
 */
export const gameEditor = {
  /**
   * Load a game for editing
   * @param {string} gameId - The game ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async load(gameId, options = {}) {
    return gamesApi.get(gameId, {
      pin: options.pin,
      credentials: "include",
    });
  },

  /**
   * Create a new game
   * @param {Object} gameData - Game data
   * @returns {Promise<{success: boolean, id: string, game: Object}>}
   */
  async create(gameData) {
    const validation = validateGameData(gameData);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    return gamesApi.create(gameData);
  },

  /**
   * Save changes to a game
   * @param {string} gameId - The game ID
   * @param {Object} updates - Fields to update
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async save(gameId, updates, options = {}) {
    return gamesApi.update(gameId, updates, { pin: options.pin });
  },

  /**
   * Delete a game
   * @param {string} gameId - The game ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async delete(gameId, options = {}) {
    return gamesApi.remove(gameId, { pin: options.pin });
  },

  /**
   * Publish a game
   * @param {string} gameId - The game ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async publish(gameId, options = {}) {
    return gamesApi.update(gameId, { isPublished: true }, { pin: options.pin });
  },

  /**
   * Unpublish a game
   * @param {string} gameId - The game ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async unpublish(gameId, options = {}) {
    return gamesApi.update(gameId, { isPublished: false }, { pin: options.pin });
  },

  /**
   * Toggle publish status
   * @param {string} gameId - The game ID
   * @param {boolean} currentStatus - Current published status
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async togglePublish(gameId, currentStatus, options = {}) {
    return gamesApi.update(gameId, { isPublished: !currentStatus }, { pin: options.pin });
  },

  /**
   * Set or update game PIN
   * @param {string} gameId - The game ID
   * @param {string} pin - The PIN to set
   * @param {Object} options - Optional parameters
   * @param {string} options.currentPin - Current PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async setPin(gameId, pin, options = {}) {
    const validation = validatePin(pin);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    return gamesApi.update(gameId, { pin }, { pin: options.currentPin });
  },

  /**
   * Remove game PIN
   * @param {string} gameId - The game ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - Current PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async removePin(gameId, options = {}) {
    return gamesApi.update(gameId, { pin: "" }, { pin: options.pin });
  },

  /**
   * Update game name
   * @param {string} gameId - The game ID
   * @param {string} name - New name
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateName(gameId, name, options = {}) {
    const validation = validateGameName(name);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    return gamesApi.update(gameId, { name }, { pin: options.pin });
  },

  /**
   * Update game description
   * @param {string} gameId - The game ID
   * @param {string} description - New description
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateDescription(gameId, description, options = {}) {
    return gamesApi.update(gameId, { description }, { pin: options.pin });
  },

  /**
   * Update game keywords
   * @param {string} gameId - The game ID
   * @param {string} keywords - New keywords
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateKeywords(gameId, keywords, options = {}) {
    return gamesApi.update(gameId, { keywords }, { pin: options.pin });
  },

  /**
   * Update game levels
   * @param {string} gameId - The game ID
   * @param {Array} levelIds - Array of level IDs
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateLevels(gameId, levelIds, options = {}) {
    return gamesApi.update(gameId, { levelIds }, { pin: options.pin });
  },

  /**
   * Update game storyline
   * @param {string} gameId - The game ID
   * @param {Array} storyline - Storyline data
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateStoryline(gameId, storyline, options = {}) {
    return gamesApi.update(gameId, { storyline }, { pin: options.pin });
  },

  /**
   * Update game settings
   * @param {string} gameId - The game ID
   * @param {Object} settings - Game settings
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateSettings(gameId, settings, options = {}) {
    return gamesApi.update(gameId, { settings }, { pin: options.pin });
  },

  /**
   * Add a level to the game
   * @param {string} gameId - The game ID
   * @param {string} levelId - Level ID to add
   * @param {Array} currentLevelIds - Current level IDs
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async addLevel(gameId, levelId, currentLevelIds = [], options = {}) {
    const levelIds = [...currentLevelIds, levelId];
    return gamesApi.update(gameId, { levelIds }, { pin: options.pin });
  },

  /**
   * Remove a level from the game
   * @param {string} gameId - The game ID
   * @param {string} levelId - Level ID to remove
   * @param {Array} currentLevelIds - Current level IDs
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async removeLevel(gameId, levelId, currentLevelIds = [], options = {}) {
    const levelIds = currentLevelIds.filter((id) => id !== levelId);
    return gamesApi.update(gameId, { levelIds }, { pin: options.pin });
  },

  /**
   * Reorder levels
   * @param {string} gameId - The game ID
   * @param {Array} newLevelIds - New ordered array of level IDs
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async reorderLevels(gameId, newLevelIds, options = {}) {
    return gamesApi.update(gameId, { levelIds: newLevelIds }, { pin: options.pin });
  },

  /**
   * Save multiple fields at once (batch update)
   * @param {string} gameId - The game ID
   * @param {Object} fields - Multiple fields to update
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async saveMultiple(gameId, fields, options = {}) {
    return gamesApi.update(gameId, fields, { pin: options.pin });
  },
};

// ... rest of the validation functions stay the same