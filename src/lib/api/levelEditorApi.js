import { apiClient } from "./apiClient";

/* ===============================
   LEVEL EDITOR API
   For creating, editing, and managing levels
================================ */

export const levelEditorApi = {
  /* ===============================
     GET LEVEL FOR EDITING
  ================================ */

  /**
   * Load a level for editing (requires auth)
   * @param {string} levelId - The level ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async load(levelId, options = {}) {
    const { pin } = options;
    const url = pin
      ? `/api/levels/${levelId}?pin=${encodeURIComponent(pin)}`
      : `/api/levels/${levelId}`;

    const headers = {};
    if (pin) {
      headers["x-level-pin"] = pin;
    }

    return apiClient(url, {
      credentials: "include",
      headers,
    });
  },

  /* ===============================
     CREATE LEVEL
  ================================ */

  /**
   * Create a new level (requires auth)
   * @param {Object} levelData - Level data
   * @param {string} levelData.name - Level name (required)
   * @param {string} levelData.description - Level description
   * @param {Array} levelData.options - Options for the level
   * @param {Array} levelData.answers - Correct answers
   * @param {string} levelData.keywords - Keywords for search
   * @param {string} levelData.pin - PIN for protection
   * @param {boolean} levelData.isPublished - Published status
   * @param {Object} levelData.poses - Poses data
   * @returns {Promise<{success: boolean, id: string, level: Object}>}
   */
  async create(levelData) {
    return apiClient("/api/levels", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify(levelData),
    });
  },

  /* ===============================
     UPDATE LEVEL
  ================================ */

  /**
   * Save changes to a level (requires auth and ownership)
   * @param {string} levelId - The level ID
   * @param {Object} updates - Fields to update
   * @param {string} updates.name - Level name
   * @param {string} updates.description - Level description
   * @param {Array} updates.options - Options
   * @param {Array} updates.answers - Answers
   * @param {string} updates.keywords - Keywords
   * @param {string} updates.pin - PIN (empty string to remove)
   * @param {boolean} updates.isPublished - Published status
   * @param {Object} updates.poses - Poses data
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async save(levelId, updates) {
    return apiClient(`/api/levels/${levelId}`, {
      method: "PATCH",
      credentials: "include",
      body: JSON.stringify(updates),
    });
  },

  /* ===============================
     DELETE LEVEL
  ================================ */

  /**
   * Delete a level (requires auth and ownership)
   * @param {string} levelId - The level ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async delete(levelId) {
    return apiClient(`/api/levels/${levelId}`, {
      method: "DELETE",
      credentials: "include",
    });
  },

  /* ===============================
     CONVENIENCE METHODS
  ================================ */

  /**
   * Publish a level
   * @param {string} levelId - The level ID
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async publish(levelId) {
    return this.save(levelId, { isPublished: true });
  },

  /**
   * Unpublish a level
   * @param {string} levelId - The level ID
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async unpublish(levelId) {
    return this.save(levelId, { isPublished: false });
  },

  /**
   * Toggle publish status
   * @param {string} levelId - The level ID
   * @param {boolean} currentStatus - Current published status
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async togglePublish(levelId, currentStatus) {
    return this.save(levelId, { isPublished: !currentStatus });
  },

  /**
   * Set or update level PIN
   * @param {string} levelId - The level ID
   * @param {string} pin - The PIN to set
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async setPin(levelId, pin) {
    return this.save(levelId, { pin });
  },

  /**
   * Remove level PIN
   * @param {string} levelId - The level ID
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async removePin(levelId) {
    return this.save(levelId, { pin: "" });
  },

  /**
   * Update level name
   * @param {string} levelId - The level ID
   * @param {string} name - New name
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updateName(levelId, name) {
    return this.save(levelId, { name });
  },

  /**
   * Update level description
   * @param {string} levelId - The level ID
   * @param {string} description - New description
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updateDescription(levelId, description) {
    return this.save(levelId, { description });
  },

  /**
   * Update level keywords
   * @param {string} levelId - The level ID
   * @param {string} keywords - New keywords
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updateKeywords(levelId, keywords) {
    return this.save(levelId, { keywords });
  },

  /**
   * Update level options
   * @param {string} levelId - The level ID
   * @param {Array} options - Options array
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updateOptions(levelId, options) {
    return this.save(levelId, { options });
  },

  /**
   * Update level answers
   * @param {string} levelId - The level ID
   * @param {Array} answers - Answers array
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updateAnswers(levelId, answers) {
    return this.save(levelId, { answers });
  },

  /**
   * Update level poses
   * @param {string} levelId - The level ID
   * @param {Object} poses - Poses object
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updatePoses(levelId, poses) {
    return this.save(levelId, { poses });
  },

  /**
   * Add an option to the level
   * @param {string} levelId - The level ID
   * @param {*} option - Option to add
   * @param {Array} currentOptions - Current options array
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async addOption(levelId, option, currentOptions = []) {
    const options = [...currentOptions, option];
    return this.save(levelId, { options });
  },

  /**
   * Remove an option from the level
   * @param {string} levelId - The level ID
   * @param {number} index - Index of option to remove
   * @param {Array} currentOptions - Current options array
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async removeOption(levelId, index, currentOptions = []) {
    const options = currentOptions.filter((_, i) => i !== index);
    return this.save(levelId, { options });
  },

  /**
   * Add an answer to the level
   * @param {string} levelId - The level ID
   * @param {*} answer - Answer to add
   * @param {Array} currentAnswers - Current answers array
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async addAnswer(levelId, answer, currentAnswers = []) {
    const answers = [...currentAnswers, answer];
    return this.save(levelId, { answers });
  },

  /**
   * Remove an answer from the level
   * @param {string} levelId - The level ID
   * @param {number} index - Index of answer to remove
   * @param {Array} currentAnswers - Current answers array
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async removeAnswer(levelId, index, currentAnswers = []) {
    const answers = currentAnswers.filter((_, i) => i !== index);
    return this.save(levelId, { answers });
  },

  /**
   * Update a specific pose
   * @param {string} levelId - The level ID
   * @param {string} poseKey - Pose key
   * @param {*} poseValue - Pose value
   * @param {Object} currentPoses - Current poses object
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async updatePose(levelId, poseKey, poseValue, currentPoses = {}) {
    const poses = {
      ...currentPoses,
      [poseKey]: poseValue,
    };
    return this.save(levelId, { poses });
  },

  /**
   * Remove a specific pose
   * @param {string} levelId - The level ID
   * @param {string} poseKey - Pose key to remove
   * @param {Object} currentPoses - Current poses object
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async removePose(levelId, poseKey, currentPoses = {}) {
    const poses = { ...currentPoses };
    delete poses[poseKey];
    return this.save(levelId, { poses });
  },

  /**
   * Save multiple fields at once (batch update)
   * @param {string} levelId - The level ID
   * @param {Object} fields - Multiple fields to update
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async saveMultiple(levelId, fields) {
    return this.save(levelId, fields);
  },
};

/* ===============================
   HELPER FUNCTIONS FOR EDITOR
================================ */

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
 * @param {Array} options - Options array
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
 * @param {Array} answers - Answers array
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
 * @param {Object} poses - Poses object
 * @returns {{valid: boolean, error?: string}}
 */
export function validatePoses(poses) {
  if (typeof poses !== "object" || poses === null || Array.isArray(poses)) {
    return { valid: false, error: "Poses must be an object" };
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

/**
 * Check if answer is correct
 * @param {*} userAnswer - User's answer
 * @param {Array} correctAnswers - Array of correct answers
 * @returns {boolean}
 */
export function isAnswerCorrect(userAnswer, correctAnswers) {
  if (!Array.isArray(correctAnswers) || correctAnswers.length === 0) {
    return false;
  }

  // Handle different answer types
  if (typeof userAnswer === "string") {
    return correctAnswers.some(
      (ans) => ans.toString().toLowerCase() === userAnswer.toLowerCase()
    );
  }

  return correctAnswers.includes(userAnswer);
}

/**
 * Get option by index
 * @param {Object} level - Level object
 * @param {number} index - Option index
 * @returns {*} Option value or null
 */
export function getOptionByIndex(level, index) {
  if (!level.options || index < 0 || index >= level.options.length) {
    return null;
  }
  return level.options[index];
}

/**
 * Get answer by index
 * @param {Object} level - Level object
 * @param {number} index - Answer index
 * @returns {*} Answer value or null
 */
export function getAnswerByIndex(level, index) {
  if (!level.answers || index < 0 || index >= level.answers.length) {
    return null;
  }
  return level.answers[index];
}

/**
 * Format level for editor display
 * @param {Object} level - Level object
 * @returns {Object} Formatted level
 */
export function formatLevelForEditor(level) {
  return {
    id: level.id,
    name: level.name || "Untitled Level",
    description: level.description || "",
    keywords: level.keywords || "",
    optionCount: level.options?.length || 0,
    answerCount: level.answers?.length || 0,
    poseCount: Object.keys(level.poses || {}).length,
    isPublished: level.isPublished || false,
    hasPin: Boolean(level.pin && level.pin.length > 0),
    author: level.author || "Anonymous",
    authorUid: level.authorUid || "",
    createdAt: level.createdAt,
    updatedAt: level.updatedAt,
  };
}

export default levelEditorApi;