import { apiClient } from "./apiClient";

/* 
   For creating, editing, and managing games
 */
export const gameEditorApi = {
  /**
   * Get a game for editing (requires auth)
   * @param {string} gameId - The game ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected games
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async load(gameId, options = {}) {
    const { pin } = options;
    const url = pin
      ? `/api/games/${gameId}?pin=${encodeURIComponent(pin)}`
      : `/api/games/${gameId}`;

    const headers = {};
    if (pin) {
      headers["x-game-pin"] = pin;
    }

    return apiClient(url, {
      credentials: "include",
      headers,
    });
  },

  /* 
     CREATE GAME
  */

  /**
   * Create a new game (requires auth)
   * @param {Object} gameData - Game data
   * @param {string} gameData.name - Game name (required)
   * @param {string} gameData.description - Game description
   * @param {string} gameData.keywords - Keywords for search
   * @param {Array} gameData.levelIds - Array of level IDs
   * @param {Array} gameData.storyline - Storyline data
   * @param {Object} gameData.settings - Game settings
   * @param {string} gameData.pin - PIN for protection
   * @param {boolean} gameData.isPublished - Published status
   * @returns {Promise<{success: boolean, id: string, game: Object}>}
   */
  async create(gameData) {
    return apiClient("/api/games", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify(gameData),
    });
  },

  /*
     UPDATE GAME
  */
  /**
   * Save changes to a game (requires auth and ownership)
   * @param {string} gameId - The game ID
   * @param {Object} updates - Fields to update
   * @param {string} updates.name - Game name
   * @param {string} updates.description - Game description
   * @param {string} updates.keywords - Keywords
   * @param {Array} updates.levelIds - Level IDs
   * @param {Array} updates.storyline - Storyline data
   * @param {Object} updates.settings - Settings
   * @param {string} updates.pin - PIN (empty string to remove)
   * @param {boolean} updates.isPublished - Published status
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async save(gameId, updates) {
    return apiClient(`/api/games/${gameId}`, {
      method: "PATCH",
      credentials: "include",
      body: JSON.stringify(updates),
    });
  },

  /*
     DELETE GAME
   */
  /**
   * Delete a game (requires auth and ownership)
   * @param {string} gameId - The game ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async delete(gameId) {
    return apiClient(`/api/games/${gameId}`, {
      method: "DELETE",
      credentials: "include",
    });
  },

  /*
     CONVENIENCE METHODS
  */

  /**
   * Publish a game
   * @param {string} gameId - The game ID
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async publish(gameId) {
    return this.save(gameId, { isPublished: true });
  },

  /**
   * Unpublish a game
   * @param {string} gameId - The game ID
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async unpublish(gameId) {
    return this.save(gameId, { isPublished: false });
  },

  /**
   * Toggle publish status
   * @param {string} gameId - The game ID
   * @param {boolean} currentStatus - Current published status
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async togglePublish(gameId, currentStatus) {
    return this.save(gameId, { isPublished: !currentStatus });
  },

  /**
   * Set or update game PIN
   * @param {string} gameId - The game ID
   * @param {string} pin - The PIN to set
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async setPin(gameId, pin) {
    return this.save(gameId, { pin });
  },

  /**
   * Remove game PIN
   * @param {string} gameId - The game ID
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async removePin(gameId) {
    return this.save(gameId, { pin: "" });
  },

  /**
   * Update game name
   * @param {string} gameId - The game ID
   * @param {string} name - New name
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateName(gameId, name) {
    return this.save(gameId, { name });
  },

  /**
   * Update game description
   * @param {string} gameId - The game ID
   * @param {string} description - New description
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateDescription(gameId, description) {
    return this.save(gameId, { description });
  },

  /**
   * Update game keywords
   * @param {string} gameId - The game ID
   * @param {string} keywords - New keywords
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateKeywords(gameId, keywords) {
    return this.save(gameId, { keywords });
  },

  /**
   * Update game levels
   * @param {string} gameId - The game ID
   * @param {Array} levelIds - Array of level IDs
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateLevels(gameId, levelIds) {
    return this.save(gameId, { levelIds });
  },

  /**
   * Update game storyline
   * @param {string} gameId - The game ID
   * @param {Array} storyline - Storyline data
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateStoryline(gameId, storyline) {
    return this.save(gameId, { storyline });
  },

  /**
   * Update game settings
   * @param {string} gameId - The game ID
   * @param {Object} settings - Game settings
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async updateSettings(gameId, settings) {
    return this.save(gameId, { settings });
  },

  /**
   * Add a level to the game
   * @param {string} gameId - The game ID
   * @param {string} levelId - Level ID to add
   * @param {Array} currentLevelIds - Current level IDs
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async addLevel(gameId, levelId, currentLevelIds = []) {
    const levelIds = [...currentLevelIds, levelId];
    return this.save(gameId, { levelIds });
  },

  /**
   * Remove a level from the game
   * @param {string} gameId - The game ID
   * @param {string} levelId - Level ID to remove
   * @param {Array} currentLevelIds - Current level IDs
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async removeLevel(gameId, levelId, currentLevelIds = []) {
    const levelIds = currentLevelIds.filter((id) => id !== levelId);
    return this.save(gameId, { levelIds });
  },

  /**
   * Reorder levels
   * @param {string} gameId - The game ID
   * @param {Array} newLevelIds - New ordered array of level IDs
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async reorderLevels(gameId, newLevelIds) {
    return this.save(gameId, { levelIds: newLevelIds });
  },

  /**
   * Save multiple fields at once (batch update)
   * @param {string} gameId - The game ID
   * @param {Object} fields - Multiple fields to update
   * @returns {Promise<{success: boolean, game: Object}>}
   */
  async saveMultiple(gameId, fields) {
    return this.save(gameId, fields);
  },
};

/*
   HELPER FUNCTIONS FOR EDITOR
*/
/**
 * Validate game name
 * @param {string} name - Game name
 * @returns {{valid: boolean, error?: string}}
 */
export function validateGameName(name) {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Name is required" };
  }
  if (name.trim() === "") {
    return { valid: false, error: "Name cannot be empty" };
  }
  if (name.length > 100) {
    return { valid: false, error: "Name is too long (max 100 characters)" };
  }
  return { valid: true };
}

/**
 * Validate PIN format
 * @param {string} pin - PIN to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validatePin(pin) {
  if (pin === "" || pin === null || pin === undefined) {
    return { valid: true }; // Empty PIN is valid (means no PIN)
  }
  if (typeof pin !== "string") {
    return { valid: false, error: "PIN must be a string" };
  }
  if (pin.length < 4) {
    return { valid: false, error: "PIN must be at least 4 characters" };
  }
  if (pin.length > 20) {
    return { valid: false, error: "PIN is too long (max 20 characters)" };
  }
  return { valid: true };
}

/**
 * Check if game has unsaved changes
 * @param {Object} original - Original game data
 * @param {Object} current - Current game data
 * @returns {boolean}
 */
export function hasUnsavedChanges(original, current) {
  const fields = [
    "name",
    "description",
    "keywords",
    "pin",
    "isPublished",
  ];

  for (const field of fields) {
    if (original[field] !== current[field]) {
      return true;
    }
  }

  // Check arrays
  if (JSON.stringify(original.levelIds) !== JSON.stringify(current.levelIds)) {
    return true;
  }

  if (JSON.stringify(original.storyline) !== JSON.stringify(current.storyline)) {
    return true;
  }

  if (JSON.stringify(original.settings) !== JSON.stringify(current.settings)) {
    return true;
  }

  return false;
}

/**
 * Create a new empty game object
 * @param {string} name - Game name
 * @returns {Object} New game data
 */
export function createEmptyGame(name = "New Game") {
  return {
    name,
    description: "",
    keywords: "",
    levelIds: [],
    storyline: [],
    settings: {},
    pin: "",
    isPublished: false,
  };
}

/**
 * Clone game data for editing
 * @param {Object} game - Game to clone
 * @returns {Object} Cloned game
 */
export function cloneGameData(game) {
  return {
    name: game.name,
    description: game.description || "",
    keywords: game.keywords || "",
    levelIds: [...(game.levelIds || [])],
    storyline: JSON.parse(JSON.stringify(game.storyline || [])),
    settings: JSON.parse(JSON.stringify(game.settings || {})),
    pin: game.pin || "",
    isPublished: game.isPublished || false,
  };
}

export default gameEditorApi;