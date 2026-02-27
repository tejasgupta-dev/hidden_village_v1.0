import gamesApi from "@/lib/api/games.api";

/**
 * Domain logic for game editing and management
 * Requires authentication
 */
export const gameEditor = {
  /**
   * Load a game for editing
   */
  async load(gameId, options = {}) {
    return gamesApi.get(gameId, {
      pin: options.pin,
      credentials: "include",
    });
  },

  /**
   * Create a new game
   */
  async create(gameData) {
    const validation = validateGameData(gameData);
    if (!validation.valid) throw new Error(validation.error);
    return gamesApi.create(gameData);
  },

  /**
   * Save changes to a game
   */
  async save(gameId, updates, options = {}) {
    return gamesApi.update(gameId, updates, { pin: options.pin });
  },

  /**
   * Delete a game
   */
  async delete(gameId, options = {}) {
    return gamesApi.remove(gameId, { pin: options.pin });
  },

  /**
   * Publish a game
   */
  async publish(gameId, options = {}) {
    return gamesApi.update(gameId, { isPublished: true }, { pin: options.pin });
  },

  /**
   * Unpublish a game
   */
  async unpublish(gameId, options = {}) {
    return gamesApi.update(gameId, { isPublished: false }, { pin: options.pin });
  },

  /**
   * Toggle publish status
   */
  async togglePublish(gameId, currentStatus, options = {}) {
    return gamesApi.update(
      gameId,
      { isPublished: !currentStatus },
      { pin: options.pin }
    );
  },

  /**
   * Set or update game PIN
   */
  async setPin(gameId, pin, options = {}) {
    const validation = validateGamePin(pin);
    if (!validation.valid) throw new Error(validation.error);

    // currentPin is the PIN you already have (if any) to authorize changing it
    return gamesApi.update(gameId, { pin }, { pin: options.currentPin });
  },

  /**
   * Remove game PIN
   */
  async removePin(gameId, options = {}) {
    return gamesApi.update(gameId, { pin: "" }, { pin: options.pin });
  },

  async updateName(gameId, name, options = {}) {
    const validation = validateGameName(name);
    if (!validation.valid) throw new Error(validation.error);
    return gamesApi.update(gameId, { name }, { pin: options.pin });
  },

  async updateDescription(gameId, description, options = {}) {
    return gamesApi.update(gameId, { description }, { pin: options.pin });
  },

  async updateKeywords(gameId, keywords, options = {}) {
    return gamesApi.update(gameId, { keywords }, { pin: options.pin });
  },

  async updateLevels(gameId, levelIds, options = {}) {
    const v = validateLevelIds(levelIds);
    if (!v.valid) throw new Error(v.error);
    return gamesApi.update(gameId, { levelIds }, { pin: options.pin });
  },

  async updateStoryline(gameId, storyline, options = {}) {
    const v = validateStoryline(storyline);
    if (!v.valid) throw new Error(v.error);
    return gamesApi.update(gameId, { storyline }, { pin: options.pin });
  },

  async updateSettings(gameId, settings, options = {}) {
    return gamesApi.update(gameId, { settings }, { pin: options.pin });
  },

  async addLevel(gameId, levelId, currentLevelIds = [], options = {}) {
    const levelIds = [...currentLevelIds, levelId];
    return gamesApi.update(gameId, { levelIds }, { pin: options.pin });
  },

  async removeLevel(gameId, levelId, currentLevelIds = [], options = {}) {
    const levelIds = currentLevelIds.filter((id) => id !== levelId);
    return gamesApi.update(gameId, { levelIds }, { pin: options.pin });
  },

  async reorderLevels(gameId, newLevelIds, options = {}) {
    const v = validateLevelIds(newLevelIds);
    if (!v.valid) throw new Error(v.error);
    return gamesApi.update(gameId, { levelIds: newLevelIds }, { pin: options.pin });
  },

  async saveMultiple(gameId, fields, options = {}) {
    // optional: validate some fields here if you want
    return gamesApi.update(gameId, fields, { pin: options.pin });
  },

  /**
   * Upload an image asset for a game (legacy uploads route)
   */
  async uploadAsset(gameId, file, options = {}) {
    if (!gameId) throw new Error("Game ID is required");
    if (!file) throw new Error("File is required");

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

  /* ------------------------------------------------------------------ */
  /* NEW: Sprites library (speaker sprites + backgrounds)                */
  /* ------------------------------------------------------------------ */

  /**
   * List sprites for a game
   * @param {string} gameId
   * @param {Object} options
   * @param {string} options.pin
   * @returns {Promise<{success: boolean, sprites: Array}>}
   */
  async listSprites(gameId, options = {}) {
    if (!gameId) throw new Error("Game ID is required");
    return gamesApi.listSprites(gameId, {
      pin: options.pin,
      credentials: "include",
    });
  },

  /**
   * Upload a sprite to the game sprite library
   * @param {string} gameId
   * @param {File} file
   * @param {Object} options
   * @param {string} options.pin
   * @param {"speaker"|"background"|"other"} options.type
   * @param {string} options.name
   * @returns {Promise<{success: boolean, sprite: Object}>}
   */
  async uploadSprite(gameId, file, options = {}) {
    if (!gameId) throw new Error("Game ID is required");
    if (!file) throw new Error("File is required");

    const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    if (file.type && !allowed.has(file.type)) {
      throw new Error("Only image uploads are allowed (png/jpg/webp/gif).");
    }
    const maxBytes = 10 * 1024 * 1024; // sprites can be a bit bigger than icons
    if (typeof file.size === "number" && file.size > maxBytes) {
      throw new Error("Image is too large (max 10MB).");
    }

    const type = options.type || "other";
    if (!["speaker", "background", "other"].includes(type)) {
      throw new Error('Sprite type must be "speaker", "background", or "other".');
    }

    return gamesApi.uploadSprite(gameId, file, {
      pin: options.pin,
      type,
      name: options.name,
      credentials: "include",
    });
  },

  /**
   * Get one sprite (optional helper)
   */
  async getSprite(gameId, spriteId, options = {}) {
    if (!gameId) throw new Error("Game ID is required");
    if (!spriteId) throw new Error("Sprite ID is required");
    return gamesApi.getSprite(gameId, spriteId, {
      pin: options.pin,
      credentials: "include",
    });
  },

  /**
   * Delete one sprite
   */
  async deleteSprite(gameId, spriteId, options = {}) {
    if (!gameId) throw new Error("Game ID is required");
    if (!spriteId) throw new Error("Sprite ID is required");
    return gamesApi.deleteSprite(gameId, spriteId, {
      pin: options.pin,
      credentials: "include",
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

  const pinCheck = validateGamePin(gameData?.pin);
  if (!pinCheck.valid) return pinCheck;

  const levelsCheck = validateLevelIds(gameData?.levelIds);
  if (!levelsCheck.valid) return levelsCheck;

  const storyCheck = validateStoryline(gameData?.storyline);
  if (!storyCheck.valid) return storyCheck;

  return { valid: true };
}