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

  /**
   * Upload an image asset for a game
   * @param {string} gameId
   * @param {File} file
   * @param {Object} options
   * @param {string} options.pin - PIN for protected games
   * @param {string} options.kind - e.g. "dialogue", "avatar", "background"
   * @returns {Promise<{success: boolean, path: string, url?: string}>}
   */
  async uploadAsset(gameId, file, options = {}) {
    if (!gameId) throw new Error("Game ID is required");
    if (!file) throw new Error("File is required");

    // lightweight validation (optional)
    const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    if (file.type && !allowed.has(file.type)) {
      throw new Error("Only image uploads are allowed (png/jpg/webp/gif).");
    }
    const maxBytes = 5 * 1024 * 1024;
    if (typeof file.size === "number" && file.size > maxBytes) {
      throw new Error("Image is too large (max 5MB).");
    }

    return gamesApi.uploadAsset(gameId, file, {
      pin: options.pin,
      kind: options.kind || "misc",
    });
  },

};

/* ------------------ VALIDATION ------------------ */
export function validateGameName(name) {
  if (!name || typeof name !== "string") return { valid: false, error: "Name is required" };
  if (name.trim() === "") return { valid: false, error: "Name cannot be empty" };
  if (name.length > 120) return { valid: false, error: "Name is too long (max 120 characters)" };
  return { valid: true };
}

export function validateGamePin(pin) {
  // Empty pin is allowed (no PIN)
  if (pin === "" || pin === null || pin === undefined) return { valid: true };
  if (typeof pin !== "string") return { valid: false, error: "PIN must be a string" };
  if (pin.length < 4) return { valid: false, error: "PIN must be at least 4 characters" };
  if (pin.length > 20) return { valid: false, error: "PIN is too long (max 20 characters)" };
  return { valid: true };
}

export function validateLevelIds(levelIds) {
  if (levelIds === undefined) return { valid: true };
  if (!Array.isArray(levelIds)) return { valid: false, error: "levelIds must be an array" };
  return { valid: true };
}

export function validateStoryline(storyline) {
  if (storyline === undefined) return { valid: true };
  if (!Array.isArray(storyline)) return { valid: false, error: "storyline must be an array" };
  return { valid: true };
}

export function validateGameData(gameData) {
  const nameCheck = validateGameName(gameData?.name);
  if (!nameCheck.valid) return nameCheck;

  // pin is optional but if present must be valid
  const pinCheck = validateGamePin(gameData?.pin);
  if (!pinCheck.valid) return pinCheck;

  const levelsCheck = validateLevelIds(gameData?.levelIds);
  if (!levelsCheck.valid) return levelsCheck;

  const storyCheck = validateStoryline(gameData?.storyline);
  if (!storyCheck.valid) return storyCheck;

  return { valid: true };
}