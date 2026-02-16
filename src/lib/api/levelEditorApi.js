import { apiClient } from "./apiClient";

/*
   PIN STORAGE HELPERS
   Consistent key: `level_pin_${levelId}`
*/
function getStoredPin(levelId) {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`level_pin_${levelId}`);
}

function storePin(levelId, pin) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`level_pin_${levelId}`, pin);
}

function buildPinHeaders(levelId) {
  const pin = levelId ? getStoredPin(levelId) : null;
  return pin ? { "x-level-pin": pin } : {};
}

/*
   LEVEL EDITOR API
   For creating, editing, and managing levels
*/

export const levelEditorApi = {
  /**
   * Load a level for editing (requires auth)
   * PIN is read automatically from sessionStorage
   */
  async load(levelId, options = {}) {
    // Allow explicit pin override (e.g. after prompt), otherwise use stored
    const pin = options.pin ?? getStoredPin(levelId);
    const headers = pin ? { "x-level-pin": pin } : {};

    return apiClient(`/api/levels/${levelId}`, {
      credentials: "include",
      headers,
    });
  },

  async create(levelData) {
    return apiClient("/api/levels", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify(levelData),
    });
  },

  /**
   * Save changes — PIN sent automatically from sessionStorage
   */
  async save(levelId, updates) {
    return apiClient(`/api/levels/${levelId}`, {
      method: "PATCH",
      credentials: "include",
      headers: buildPinHeaders(levelId),
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete — PIN sent automatically from sessionStorage
   */
  async delete(levelId) {
    return apiClient(`/api/levels/${levelId}`, {
      method: "DELETE",
      credentials: "include",
      headers: buildPinHeaders(levelId),
    });
  },

  /*
     CONVENIENCE METHODS
  */
  async publish(levelId) {
    return this.save(levelId, { isPublished: true });
  },

  async unpublish(levelId) {
    return this.save(levelId, { isPublished: false });
  },

  async togglePublish(levelId, currentStatus) {
    return this.save(levelId, { isPublished: !currentStatus });
  },

  async setPin(levelId, pin) {
    return this.save(levelId, { pin });
  },

  async removePin(levelId) {
    return this.save(levelId, { pin: "" });
  },

  async updateName(levelId, name) {
    return this.save(levelId, { name });
  },

  async updateDescription(levelId, description) {
    return this.save(levelId, { description });
  },

  async updateKeywords(levelId, keywords) {
    return this.save(levelId, { keywords });
  },

  async updateOptions(levelId, options) {
    return this.save(levelId, { options });
  },

  async updateAnswers(levelId, answers) {
    return this.save(levelId, { answers });
  },

  async updatePoses(levelId, poses) {
    return this.save(levelId, { poses });
  },

  async addOption(levelId, option, currentOptions = []) {
    return this.save(levelId, { options: [...currentOptions, option] });
  },

  async removeOption(levelId, index, currentOptions = []) {
    return this.save(levelId, {
      options: currentOptions.filter((_, i) => i !== index),
    });
  },

  async addAnswer(levelId, answer, currentAnswers = []) {
    return this.save(levelId, { answers: [...currentAnswers, answer] });
  },

  async removeAnswer(levelId, index, currentAnswers = []) {
    return this.save(levelId, {
      answers: currentAnswers.filter((_, i) => i !== index),
    });
  },

  async updatePose(levelId, poseKey, poseValue, currentPoses = {}) {
    return this.save(levelId, {
      poses: { ...currentPoses, [poseKey]: poseValue },
    });
  },

  async removePose(levelId, poseKey, currentPoses = {}) {
    const poses = { ...currentPoses };
    delete poses[poseKey];
    return this.save(levelId, { poses });
  },

  async saveMultiple(levelId, fields) {
    return this.save(levelId, fields);
  },
};

export { getStoredPin, storePin };

/*
   HELPER FUNCTIONS FOR EDITOR
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

export function validatePin(pin) {
  if (pin === "" || pin === null || pin === undefined) {
    return { valid: true };
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

export function validateOptions(options) {
  if (!Array.isArray(options)) {
    return { valid: false, error: "Options must be an array" };
  }
  if (options.length === 0) {
    return { valid: false, error: "At least one option is required" };
  }
  return { valid: true };
}

export function validateAnswers(answers) {
  if (!Array.isArray(answers)) {
    return { valid: false, error: "Answers must be an array" };
  }
  if (answers.length === 0) {
    return { valid: false, error: "At least one answer is required" };
  }
  return { valid: true };
}

export function validatePoses(poses) {
  if (typeof poses !== "object" || poses === null || Array.isArray(poses)) {
    return { valid: false, error: "Poses must be an object" };
  }
  return { valid: true };
}

export function hasUnsavedChanges(original, current) {
  const fields = ["name", "description", "keywords", "pin", "isPublished"];
  for (const field of fields) {
    if (original[field] !== current[field]) return true;
  }
  if (JSON.stringify(original.options) !== JSON.stringify(current.options))
    return true;
  if (JSON.stringify(original.answers) !== JSON.stringify(current.answers))
    return true;
  if (JSON.stringify(original.poses) !== JSON.stringify(current.poses))
    return true;
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
  };
}

export function isAnswerCorrect(userAnswer, correctAnswers) {
  if (!Array.isArray(correctAnswers) || correctAnswers.length === 0)
    return false;
  if (typeof userAnswer === "string") {
    return correctAnswers.some(
      (ans) => ans.toString().toLowerCase() === userAnswer.toLowerCase()
    );
  }
  return correctAnswers.includes(userAnswer);
}

export function getOptionByIndex(level, index) {
  if (!level.options || index < 0 || index >= level.options.length) return null;
  return level.options[index];
}

export function getAnswerByIndex(level, index) {
  if (!level.answers || index < 0 || index >= level.answers.length) return null;
  return level.answers[index];
}

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