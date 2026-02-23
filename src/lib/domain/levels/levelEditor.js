import levelsApi from "@/lib/api/levels.api";

/**
 * Domain logic for level editing and management
 * Requires authentication
 */

/* ------------------ SETTINGS VALIDATION ------------------ */
const DEFAULT_LEVEL_SETTINGS = {
  logFPS: 15,
  include: {
    face: false,
    leftArm: true,
    rightArm: true,
    leftLeg: true,
    rightLeg: true,
    hands: false,
  },
  states: {
    intro: true,
    intuition: true,
    tween: true,
    poseMatch: false,
    insight: true,
    outro: true,
  },
  reps: {
    poseMatch: 2,
    tween: 2,
  },
  ui: {
    dialogueFontSize: 20,
  },
};

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function validateSettings(settings) {
  // settings is optional
  if (settings === undefined || settings === null) return { valid: true };

  if (!isPlainObject(settings)) {
    return { valid: false, error: "settings must be an object" };
  }

  // logFPS (optional)
  if (settings.logFPS !== undefined) {
    const n = Number(settings.logFPS);
    if (!Number.isFinite(n) || n < 1 || n > 120) {
      return { valid: false, error: "settings.logFPS must be a number between 1 and 120" };
    }
  }

  // include/states/ui/reps are optional but must be objects if present
  const objectKeys = ["include", "states", "reps", "ui"];
  for (const k of objectKeys) {
    if (settings[k] !== undefined && !isPlainObject(settings[k])) {
      return { valid: false, error: `settings.${k} must be an object` };
    }
  }

  // dialogueFontSize (optional)
  if (settings.ui?.dialogueFontSize !== undefined) {
    const n = Number(settings.ui.dialogueFontSize);
    if (!Number.isFinite(n) || n < 10 || n > 64) {
      return { valid: false, error: "settings.ui.dialogueFontSize must be between 10 and 64" };
    }
  }

  // reps (optional)
  if (settings.reps?.poseMatch !== undefined) {
    const n = Number(settings.reps.poseMatch);
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      return { valid: false, error: "settings.reps.poseMatch must be between 1 and 20" };
    }
  }

  if (settings.reps?.tween !== undefined) {
    const n = Number(settings.reps.tween);
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      return { valid: false, error: "settings.reps.tween must be between 1 and 20" };
    }
  }

  // Shallow key safety: block obviously wrong types for include/states
  // (We don't require full completeness; your hook merges defaults anyway.)
  for (const [k, v] of Object.entries(settings.include ?? {})) {
    if (typeof v !== "boolean") {
      return { valid: false, error: `settings.include.${k} must be boolean` };
    }
  }
  for (const [k, v] of Object.entries(settings.states ?? {})) {
    if (typeof v !== "boolean") {
      return { valid: false, error: `settings.states.${k} must be boolean` };
    }
  }

  return { valid: true };
}

export const levelEditor = {
  /**
   * Load a level for editing
   * @param {string} levelId - The level ID
   * @param {Object} options - Optional parameters
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async load(levelId, options = {}) {
    // ✅ Keep request options separate from the "data" payload.
    // Assumes levelsApi.get(id, { pin, credentials }) accepts an options object.
    // If your levelsApi.get signature is (id, params, opts), adjust accordingly.
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
    // ✅ Validate settings if present in updates (prevents bad writes)
    if (updates && Object.prototype.hasOwnProperty.call(updates, "settings")) {
      const v = validateSettings(updates.settings);
      if (!v.valid) throw new Error(v.error);
    }

    return levelsApi.update(levelId, updates, { pin: options.pin });
  },

  /**
   * Delete a level
   */
  async delete(levelId, options = {}) {
    return levelsApi.remove(levelId, { pin: options.pin });
  },

  async publish(levelId, options = {}) {
    return levelsApi.update(levelId, { isPublished: true }, { pin: options.pin });
  },

  async unpublish(levelId, options = {}) {
    return levelsApi.update(levelId, { isPublished: false }, { pin: options.pin });
  },

  async togglePublish(levelId, currentStatus, options = {}) {
    return levelsApi.update(levelId, { isPublished: !currentStatus }, { pin: options.pin });
  },

  async setPin(levelId, pin, options = {}) {
    const validation = validatePin(pin);
    if (!validation.valid) throw new Error(validation.error);
    return levelsApi.update(levelId, { pin }, { pin: options.currentPin });
  },

  async removePin(levelId, options = {}) {
    return levelsApi.update(levelId, { pin: "" }, { pin: options.pin });
  },

  async updateName(levelId, name, options = {}) {
    const validation = validateLevelName(name);
    if (!validation.valid) throw new Error(validation.error);
    return levelsApi.update(levelId, { name }, { pin: options.pin });
  },

  async updateDescription(levelId, description, options = {}) {
    return levelsApi.update(levelId, { description }, { pin: options.pin });
  },

  async updateKeywords(levelId, keywords, options = {}) {
    return levelsApi.update(levelId, { keywords }, { pin: options.pin });
  },

  async updateOptions(levelId, optionsArr, opts = {}) {
    return levelsApi.update(levelId, { options: optionsArr }, { pin: opts.pin });
  },

  async updateAnswers(levelId, answers, options = {}) {
    return levelsApi.update(levelId, { answers }, { pin: options.pin });
  },

  async updatePoses(levelId, poses, options = {}) {
    return levelsApi.update(levelId, { poses }, { pin: options.pin });
  },

  /**
   * ✅ Settings helpers (clear intent + centralized validation)
   */
  async updateSettings(levelId, settings, options = {}) {
    const v = validateSettings(settings);
    if (!v.valid) throw new Error(v.error);
    return levelsApi.update(levelId, { settings }, { pin: options.pin });
  },

  async resetSettings(levelId, options = {}) {
    return levelsApi.update(levelId, { settings: DEFAULT_LEVEL_SETTINGS }, { pin: options.pin });
  },

  async addOption(levelId, option, currentOptions = [], options = {}) {
    const opts = [...currentOptions, option];
    return levelsApi.update(levelId, { options: opts }, { pin: options.pin });
  },

  async removeOption(levelId, index, currentOptions = [], options = {}) {
    const opts = currentOptions.filter((_, i) => i !== index);
    return levelsApi.update(levelId, { options: opts }, { pin: options.pin });
  },

  async addAnswer(levelId, answer, currentAnswers = [], options = {}) {
    const answers = [...currentAnswers, answer];
    return levelsApi.update(levelId, { answers }, { pin: options.pin });
  },

  async removeAnswer(levelId, index, currentAnswers = [], options = {}) {
    const answers = currentAnswers.filter((_, i) => i !== index);
    return levelsApi.update(levelId, { answers }, { pin: options.pin });
  },

  async updatePose(levelId, poseKey, poseValue, currentPoses = {}, options = {}) {
    const poses = { ...currentPoses, [poseKey]: poseValue };
    return levelsApi.update(levelId, { poses }, { pin: options.pin });
  },

  async removePose(levelId, poseKey, currentPoses = {}, options = {}) {
    const poses = { ...currentPoses };
    delete poses[poseKey];
    return levelsApi.update(levelId, { poses }, { pin: options.pin });
  },

  async saveMultiple(levelId, fields, options = {}) {
    // Validate settings if included in batch
    if (fields && Object.prototype.hasOwnProperty.call(fields, "settings")) {
      const v = validateSettings(fields.settings);
      if (!v.valid) throw new Error(v.error);
    }
    return levelsApi.update(levelId, fields, { pin: options.pin });
  },
};

/* ------------------ VALIDATORS (existing) ------------------ */
export function validateLevelName(name) {
  if (!name || typeof name !== "string") return { valid: false, error: "Name is required" };
  if (name.trim() === "") return { valid: false, error: "Name cannot be empty" };
  if (name.length > 100) return { valid: false, error: "Name is too long (max 100 characters)" };
  return { valid: true };
}

export function validatePin(pin) {
  if (pin === "" || pin === null || pin === undefined) return { valid: true };
  if (typeof pin !== "string") return { valid: false, error: "PIN must be a string" };
  if (pin.length < 4) return { valid: false, error: "PIN must be at least 4 characters" };
  if (pin.length > 20) return { valid: false, error: "PIN is too long (max 20 characters)" };
  return { valid: true };
}

export function validateOptions(options) {
  if (!Array.isArray(options)) return { valid: false, error: "Options must be an array" };
  if (options.length === 0) return { valid: false, error: "At least one option is required" };
  return { valid: true };
}

export function validateAnswers(answers) {
  if (!Array.isArray(answers)) return { valid: false, error: "Answers must be an array" };
  if (answers.length === 0) return { valid: false, error: "At least one answer is required" };
  return { valid: true };
}

export function validatePoses(poses) {
  if (typeof poses !== "object" || poses === null || Array.isArray(poses)) {
    return { valid: false, error: "Poses must be an object" };
  }
  return { valid: true };
}

export function validateLevelData(levelData) {
  const nameValidation = validateLevelName(levelData.name);
  if (!nameValidation.valid) return nameValidation;

  if (levelData.pin) {
    const pinValidation = validatePin(levelData.pin);
    if (!pinValidation.valid) return pinValidation;
  }

  // ✅ validate settings on create too
  if (Object.prototype.hasOwnProperty.call(levelData, "settings")) {
    const settingsValidation = validateSettings(levelData.settings);
    if (!settingsValidation.valid) return settingsValidation;
  }

  return { valid: true };
}

/* ------------------ helpers (unchanged) ------------------ */
export function hasUnsavedChanges(original, current) {
  const fields = ["name", "description", "keywords", "pin", "isPublished"];

  for (const field of fields) {
    if (original[field] !== current[field]) return true;
  }

  if (JSON.stringify(original.options) !== JSON.stringify(current.options)) return true;
  if (JSON.stringify(original.answers) !== JSON.stringify(current.answers)) return true;
  if (JSON.stringify(original.poses) !== JSON.stringify(current.poses)) return true;

  // ✅ include settings in dirty check
  if (JSON.stringify(original.settings || {}) !== JSON.stringify(current.settings || {})) return true;

  return false;
}

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
    settings: DEFAULT_LEVEL_SETTINGS,
  };
}

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
    settings: JSON.parse(JSON.stringify(level.settings || DEFAULT_LEVEL_SETTINGS)),
  };
}

export default levelEditor;