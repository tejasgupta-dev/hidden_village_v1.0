import levelsApi from "@/lib/api/levels.api";

/**
 * Domain logic for level editing and management
 * Requires authentication
 */
export const levelEditor = {
  /**
   * Load a level for editing
   * @param {string} levelId - The level ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async load(levelId, options = {}) {
    return levelsApi.get(levelId, {
      pin: options.pin,
      credentials: "include",
    });
  },

  /**
   * Create a new level
   * @param {Object} levelData - Level data
   * @returns {Promise<{success: boolean, id: string, level: Object}>}
   */
  async create(levelData) {
    const validation = validateLevelData(levelData);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    return levelsApi.create(levelData);
  },

  /**
   * Save changes to a level
   * @param {string} levelId - The level ID
   * @param {Object} updates - Fields to update
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async save(levelId, updates, options = {}) {
    return levelsApi.update(levelId, updates, { pin: options.pin });
  },

  /**
   * Delete a level
   * @param {string} levelId - The level ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async delete(levelId, options = {}) {
    return levelsApi.remove(levelId, { pin: options.pin });
  },

  /**
   * Publish a level
   * @param {string} levelId - The level ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async publish(levelId, options = {}) {
    return levelsApi.update(levelId, { isPublished: true }, { pin: options.pin });
  },

  /**
   * Unpublish a level
   * @param {string} levelId - The level ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async unpublish(levelId, options = {}) {
    return levelsApi.update(levelId, { isPublished: false }, { pin: options.pin });
  },

  /**
   * Toggle publish status
   * @param {string} levelId - The level ID
   * @param {boolean} currentStatus - Current published status
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async togglePublish(levelId, currentStatus, options = {}) {
    return levelsApi.update(levelId, { isPublished: !currentStatus }, { pin: options.pin });
  },

  /**
   * Set or update level PIN
   * @param {string} levelId - The level ID
   * @param {string} pin - The PIN to set
   * @param {Object} options - Optional parameters
   * @param {string} options.currentPin - Current PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async setPin(levelId, pin, options = {}) {
    const validation = validatePin(pin);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    return levelsApi.update(levelId, { pin }, { pin: options.currentPin });
  },

  /**
   * Remove level PIN
   * @param {string} levelId - The level ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - Current PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async removePin(levelId, options = {}) {
    return levelsApi.update(levelId, { pin: "" }, { pin: options.pin });
  },

  /**
   * Update level name
   * @param {string} levelId - The level ID
   * @param {string} name - New name
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updateName(levelId, name, options = {}) {
    const validation = validateLevelName(name);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    return levelsApi.update(levelId, { name }, { pin: options.pin });
  },

  /**
   * Update level description
   * @param {string} levelId - The level ID
   * @param {string} description - New description
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updateDescription(levelId, description, options = {}) {
    return levelsApi.update(levelId, { description }, { pin: options.pin });
  },

  /**
   * Update level keywords
   * @param {string} levelId - The level ID
   * @param {string} keywords - New keywords
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updateKeywords(levelId, keywords, options = {}) {
    return levelsApi.update(levelId, { keywords }, { pin: options.pin });
  },

  /**
   * Update level options
   * @param {string} levelId - The level ID
   * @param {Array} options - Options array
   * @param {Object} opts - Optional parameters
   * @param {string} opts.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updateOptions(levelId, options, opts = {}) {
    return levelsApi.update(levelId, { options }, { pin: opts.pin });
  },

  /**
   * Update level answers
   * @param {string} levelId - The level ID
   * @param {Array} answers - Answers array
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updateAnswers(levelId, answers, options = {}) {
    return levelsApi.update(levelId, { answers }, { pin: options.pin });
  },

  /**
   * Update level poses
   * @param {string} levelId - The level ID
   * @param {Object} poses - Poses object
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updatePoses(levelId, poses, options = {}) {
    return levelsApi.update(levelId, { poses }, { pin: options.pin });
  },

  /**
   * Add an option to the level
   * @param {string} levelId - The level ID
   * @param {*} option - Option to add
   * @param {Array} currentOptions - Current options
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async addOption(levelId, option, currentOptions = [], options = {}) {
    const opts = [...currentOptions, option];
    return levelsApi.update(levelId, { options: opts }, { pin: options.pin });
  },

  /**
   * Remove an option from the level
   * @param {string} levelId - The level ID
   * @param {number} index - Index to remove
   * @param {Array} currentOptions - Current options
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async removeOption(levelId, index, currentOptions = [], options = {}) {
    const opts = currentOptions.filter((_, i) => i !== index);
    return levelsApi.update(levelId, { options: opts }, { pin: options.pin });
  },

  /**
   * Add an answer to the level
   * @param {string} levelId - The level ID
   * @param {*} answer - Answer to add
   * @param {Array} currentAnswers - Current answers
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async addAnswer(levelId, answer, currentAnswers = [], options = {}) {
    const answers = [...currentAnswers, answer];
    return levelsApi.update(levelId, { answers }, { pin: options.pin });
  },

  /**
   * Remove an answer from the level
   * @param {string} levelId - The level ID
   * @param {number} index - Index to remove
   * @param {Array} currentAnswers - Current answers
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async removeAnswer(levelId, index, currentAnswers = [], options = {}) {
    const answers = currentAnswers.filter((_, i) => i !== index);
    return levelsApi.update(levelId, { answers }, { pin: options.pin });
  },

  /**
   * Update a pose in the level
   * @param {string} levelId - The level ID
   * @param {string} poseKey - Pose key
   * @param {*} poseValue - Pose value
   * @param {Object} currentPoses - Current poses
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updatePose(levelId, poseKey, poseValue, currentPoses = {}, options = {}) {
    const poses = { ...currentPoses, [poseKey]: poseValue };
    return levelsApi.update(levelId, { poses }, { pin: options.pin });
  },

  /**
   * Remove a pose from the level
   * @param {string} levelId - The level ID
   * @param {string} poseKey - Pose key to remove
   * @param {Object} currentPoses - Current poses
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async removePose(levelId, poseKey, currentPoses = {}, options = {}) {
    const poses = { ...currentPoses };
    delete poses[poseKey];
    return levelsApi.update(levelId, { poses }, { pin: options.pin });
  },

  /**
   * Save multiple fields at once (batch update)
   * @param {string} levelId - The level ID
   * @param {Object} fields - Multiple fields to update
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async saveMultiple(levelId, fields, options = {}) {
    return levelsApi.update(levelId, fields, { pin: options.pin });
  },
};

/**
 * Validate level name
 * @param {string} name - Level name
 * @returns {{valid: boolean, error?: string}}
 */
export function validateLevelName(name) {
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
 * Validate options array
 * @param {Array} options - Options to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateOptions(options) {
  if (!Array.isArray(options)) {
    return { valid: false, error: "Options must be an array" };
  }
  if (options.length === 0) {
    return { valid: false, error: "At least one option is required" };
  }
  return { valid: true };
}

/**
 * Validate answers array
 * @param {Array} answers - Answers to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateAnswers(answers) {
  if (!Array.isArray(answers)) {
    return { valid: false, error: "Answers must be an array" };
  }
  if (answers.length === 0) {
    return { valid: false, error: "At least one answer is required" };
  }
  return { valid: true };
}

/**
 * Validate poses object
 * @param {Object} poses - Poses to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validatePoses(poses) {
  if (typeof poses !== "object" || poses === null || Array.isArray(poses)) {
    return { valid: false, error: "Poses must be an object" };
  }
  return { valid: true };
}

/**
 * Validate level data
 * @param {Object} levelData - Level data to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateLevelData(levelData) {
  const nameValidation = validateLevelName(levelData.name);
  if (!nameValidation.valid) {
    return nameValidation;
  }

  if (levelData.pin) {
    const pinValidation = validatePin(levelData.pin);
    if (!pinValidation.valid) {
      return pinValidation;
    }
  }

  return { valid: true };
}

/**
 * Check if level has unsaved changes
 * @param {Object} original - Original level data
 * @param {Object} current - Current level data
 * @returns {boolean}
 */
export function hasUnsavedChanges(original, current) {
  const fields = ["name", "description", "keywords", "pin", "isPublished"];
  
  for (const field of fields) {
    if (original[field] !== current[field]) {
      return true;
    }
  }

  if (JSON.stringify(original.options) !== JSON.stringify(current.options)) {
    return true;
  }

  if (JSON.stringify(original.answers) !== JSON.stringify(current.answers)) {
    return true;
  }

  if (JSON.stringify(original.poses) !== JSON.stringify(current.poses)) {
    return true;
  }

  return false;
}

/**
 * Create a new empty level object
 * @param {string} name - Level name
 * @returns {Object} New level data
 */
export function createEmptyLevel(name = "New Level") {
  return {
    name,
    description: "",
    options: [],
    answers: [],
    keywords: "",
    pin: "",
    isPublished: false,
    poses: {},
  };
}

/**
 * Clone level data for editing
 * @param {Object} level - Level to clone
 * @returns {Object} Cloned level
 */
export function cloneLevelData(level) {
  return {
    name: level.name,
    description: level.description || "",
    options: [...(level.options || [])],
    answers: [...(level.answers || [])],
    keywords: level.keywords || "",
    pin: level.pin || "",
    isPublished: level.isPublished || false,
    poses: JSON.parse(JSON.stringify(level.poses || {})),
  };
}

export default levelEditor;