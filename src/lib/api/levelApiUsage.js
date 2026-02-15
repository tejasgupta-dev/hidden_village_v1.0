/* ===============================
   USAGE EXAMPLES FOR LEVEL APIs
================================ */

import { levelsMenuApi, searchLevels, sortLevels } from '@/lib/api/levelsMenuApi';
import { levelEditorApi, validateLevelName, hasUnsavedChanges } from '@/lib/api/levelEditorApi';

/* ===============================
   1. LEVELS MENU API EXAMPLES
   (Browsing and selecting levels)
================================ */

// Example: Levels List Component
function LevelsListComponent() {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadLevels() {
      try {
        const { success, levels: data } = await levelsMenuApi.list();
        if (success) {
          setLevels(data);
        }
      } catch (error) {
        console.error('Failed to load levels:', error);
      } finally {
        setLoading(false);
      }
    }
    loadLevels();
  }, []);

  const filteredLevels = useMemo(() => {
    let filtered = levels;

    // Apply search
    if (searchTerm) {
      filtered = searchLevels(filtered, searchTerm);
    }

    // Sort by name
    return sortLevels(filtered, 'name', 'asc');
  }, [levels, searchTerm]);

  return (
    <div>
      <h1>Available Levels</h1>
      <input
        type="text"
        placeholder="Search levels..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {filteredLevels.map((level) => (
        <div key={level.id}>
          <h3>{level.name}</h3>
          <p>By {level.author}</p>
          <p>{level.keywords}</p>
          <span>{level.isPublished ? '✅ Published' : '📝 Draft'}</span>
          <button onClick={() => window.location.href = `/levels/edit/${level.id}`}>
            Edit
          </button>
        </div>
      ))}
    </div>
  );
}

// Example: Levels Management Dashboard
function LevelsManagementDashboard({ userUid }) {
  const [levels, setLevels] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'published', 'drafts', 'mine'

  useEffect(() => {
    async function loadLevels() {
      const { success, levels: data } = await levelsMenuApi.list();
      if (success) {
        setLevels(data);
      }
    }
    loadLevels();
  }, []);

  const filteredLevels = useMemo(() => {
    let filtered = levels;

    // Apply filters
    if (filter === 'published') {
      filtered = filterLevelsByStatus(filtered, true);
    } else if (filter === 'drafts') {
      filtered = filterLevelsByStatus(filtered, false);
    } else if (filter === 'mine') {
      filtered = getLevelsByAuthor(filtered, userUid);
    }

    return sortLevels(filtered, 'name', 'asc');
  }, [levels, filter, userUid]);

  return (
    <div>
      <h1>Level Management</h1>
      
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">All Levels</option>
        <option value="published">Published</option>
        <option value="drafts">Drafts</option>
        <option value="mine">My Levels</option>
      </select>

      <div>
        {filteredLevels.map((level) => (
          <div key={level.id}>
            <h3>{level.name}</h3>
            <p>By {level.author}</p>
            <span>{level.isPublished ? '✅' : '📝'}</span>
            <button onClick={() => window.location.href = `/levels/edit/${level.id}`}>
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===============================
   2. LEVEL EDITOR API EXAMPLES
   (Creating and editing levels)
================================ */

// Example: Level Editor Component
function LevelEditorComponent({ levelId }) {
  const [level, setLevel] = useState(null);
  const [originalLevel, setOriginalLevel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Load level
  useEffect(() => {
    async function loadLevel() {
      try {
        const { success, level: data } = await levelEditorApi.load(levelId);
        if (success) {
          setLevel(data);
          setOriginalLevel(data);
        }
      } catch (error) {
        console.error('Failed to load level:', error);
      }
    }
    loadLevel();
  }, [levelId]);

  // Check for unsaved changes
  useEffect(() => {
    if (level && originalLevel) {
      setIsDirty(hasUnsavedChanges(originalLevel, level));
    }
  }, [level, originalLevel]);

  // Save level
  const handleSave = async () => {
    try {
      setSaving(true);

      const { success, level: updated } = await levelEditorApi.save(levelId, {
        name: level.name,
        description: level.description,
        options: level.options,
        answers: level.answers,
        keywords: level.keywords,
        poses: level.poses,
      });

      if (success) {
        setLevel(updated);
        setOriginalLevel(updated);
        alert('Level saved!');
      }
    } catch (error) {
      alert('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Update name with validation
  const handleNameChange = (newName) => {
    const validation = validateLevelName(newName);
    if (validation.valid) {
      setLevel({ ...level, name: newName });
    } else {
      alert(validation.error);
    }
  };

  // Add option
  const handleAddOption = () => {
    const newOption = prompt('Enter option:');
    if (newOption) {
      setLevel({
        ...level,
        options: [...level.options, newOption],
      });
    }
  };

  // Remove option
  const handleRemoveOption = (index) => {
    setLevel({
      ...level,
      options: level.options.filter((_, i) => i !== index),
    });
  };

  // Add answer
  const handleAddAnswer = () => {
    const newAnswer = prompt('Enter correct answer:');
    if (newAnswer) {
      setLevel({
        ...level,
        answers: [...level.answers, newAnswer],
      });
    }
  };

  // Publish level
  const handlePublish = async () => {
    try {
      const { success } = await levelEditorApi.publish(levelId);
      if (success) {
        alert('Level published!');
        const { level: updated } = await levelEditorApi.load(levelId);
        setLevel(updated);
        setOriginalLevel(updated);
      }
    } catch (error) {
      alert('Failed to publish: ' + error.message);
    }
  };

  // Delete level
  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this level?')) {
      try {
        await levelEditorApi.delete(levelId);
        window.location.href = '/levels';
      } catch (error) {
        alert('Failed to delete: ' + error.message);
      }
    }
  };

  if (!level) return <div>Loading...</div>;

  return (
    <div>
      <h1>Edit Level</h1>

      {/* Name */}
      <label>Name:</label>
      <input
        type="text"
        value={level.name}
        onChange={(e) => handleNameChange(e.target.value)}
      />

      {/* Description */}
      <label>Description:</label>
      <textarea
        value={level.description}
        onChange={(e) => setLevel({ ...level, description: e.target.value })}
      />

      {/* Keywords */}
      <label>Keywords:</label>
      <input
        type="text"
        value={level.keywords}
        onChange={(e) => setLevel({ ...level, keywords: e.target.value })}
      />

      {/* Options */}
      <div>
        <h3>Options</h3>
        {level.options.map((option, index) => (
          <div key={index}>
            <span>{option}</span>
            <button onClick={() => handleRemoveOption(index)}>Remove</button>
          </div>
        ))}
        <button onClick={handleAddOption}>Add Option</button>
      </div>

      {/* Answers */}
      <div>
        <h3>Correct Answers</h3>
        {level.answers.map((answer, index) => (
          <div key={index}>
            <span>{answer}</span>
          </div>
        ))}
        <button onClick={handleAddAnswer}>Add Answer</button>
      </div>

      {/* Actions */}
      <div>
        <button onClick={handleSave} disabled={saving || !isDirty}>
          {saving ? 'Saving...' : isDirty ? 'Save Changes' : 'No Changes'}
        </button>

        <button onClick={handlePublish}>
          {level.isPublished ? 'Unpublish' : 'Publish'}
        </button>

        <button onClick={handleDelete}>Delete Level</button>
      </div>
    </div>
  );
}

// Example: Create New Level
async function createNewLevel(name) {
  try {
    const { success, id, level } = await levelEditorApi.create({
      name,
      description: '',
      options: [],
      answers: [],
      keywords: '',
      pin: '',
      isPublished: false,
      poses: {},
    });

    if (success) {
      console.log('Level created:', id);
      return { id, level };
    }
  } catch (error) {
    console.error('Failed to create level:', error);
    throw error;
  }
}

// Example: Quick Update Methods
async function quickLevelUpdates(levelId) {
  // Update just the name
  await levelEditorApi.updateName(levelId, 'New Level Name');

  // Update just the description
  await levelEditorApi.updateDescription(levelId, 'New description');

  // Add an option
  const currentOptions = ['Option 1', 'Option 2'];
  await levelEditorApi.addOption(levelId, 'Option 3', currentOptions);

  // Remove an option
  await levelEditorApi.removeOption(levelId, 1, currentOptions);

  // Add an answer
  const currentAnswers = ['Answer 1'];
  await levelEditorApi.addAnswer(levelId, 'Answer 2', currentAnswers);

  // Update a pose
  const currentPoses = { pose1: 'data1' };
  await levelEditorApi.updatePose(levelId, 'pose2', 'data2', currentPoses);

  // Set PIN protection
  await levelEditorApi.setPin(levelId, '1234');

  // Remove PIN
  await levelEditorApi.removePin(levelId);

  // Toggle publish status
  const isCurrentlyPublished = true;
  await levelEditorApi.togglePublish(levelId, isCurrentlyPublished);
}

// Example: Batch Update
async function batchUpdateLevel(levelId) {
  try {
    const { success, level } = await levelEditorApi.saveMultiple(levelId, {
      name: 'Updated Name',
      description: 'Updated Description',
      options: ['A', 'B', 'C', 'D'],
      answers: ['A'],
      keywords: 'quiz, test, challenge',
      isPublished: true,
    });

    if (success) {
      console.log('Level updated:', level);
      return level;
    }
  } catch (error) {
    console.error('Failed to update level:', error);
    throw error;
  }
}

/* ===============================
   3. COMBINED USAGE EXAMPLES
================================ */

// Example: Level Selector for Game Editor
function LevelSelectorForGame({ onSelectLevel }) {
  const [levels, setLevels] = useState([]);
  const [selectedLevels, setSelectedLevels] = useState([]);

  useEffect(() => {
    async function loadLevels() {
      const { success, levels: data } = await levelsMenuApi.list();
      if (success) {
        // Only show published levels
        const published = data.filter(l => l.isPublished);
        setLevels(published);
      }
    }
    loadLevels();
  }, []);

  const handleToggleLevel = (levelId) => {
    setSelectedLevels(prev => {
      if (prev.includes(levelId)) {
        return prev.filter(id => id !== levelId);
      } else {
        return [...prev, levelId];
      }
    });
  };

  const handleConfirm = () => {
    onSelectLevel(selectedLevels);
  };

  return (
    <div>
      <h2>Select Levels for Game</h2>
      {levels.map(level => (
        <div key={level.id}>
          <input
            type="checkbox"
            checked={selectedLevels.includes(level.id)}
            onChange={() => handleToggleLevel(level.id)}
          />
          <label>{level.name}</label>
        </div>
      ))}
      <button onClick={handleConfirm}>Add Selected Levels</button>
    </div>
  );
}

// Example: Clone Level
async function cloneLevel(originalLevelId) {
  try {
    // Load original level
    const { success, level: original } = await levelEditorApi.load(originalLevelId);
    
    if (success) {
      // Create new level with copied data
      const { id: newLevelId } = await levelEditorApi.create({
        name: `${original.name} (Copy)`,
        description: original.description,
        options: [...original.options],
        answers: [...original.answers],
        keywords: original.keywords,
        pin: '',
        isPublished: false,
        poses: JSON.parse(JSON.stringify(original.poses)),
      });

      return newLevelId;
    }
  } catch (error) {
    console.error('Failed to clone level:', error);
    throw error;
  }
}

// Example: Level Preview Modal
function LevelPreviewModal({ levelId, onClose }) {
  const [level, setLevel] = useState(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState('');

  const loadLevel = async (providedPin = '') => {
    try {
      const options = providedPin ? { pin: providedPin } : {};
      const { success, level: data } = await levelsMenuApi.getPreview(levelId, options);
      
      if (success) {
        setLevel(data);
        setNeedsPin(false);
      }
    } catch (error) {
      if (error.message.includes('PIN')) {
        setNeedsPin(true);
      } else {
        console.error('Failed to load level:', error);
      }
    }
  };

  useEffect(() => {
    loadLevel();
  }, [levelId]);

  const handlePinSubmit = () => {
    loadLevel(pin);
  };

  if (needsPin) {
    return (
      <div>
        <h2>PIN Required</h2>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter PIN"
        />
        <button onClick={handlePinSubmit}>Submit</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    );
  }

  if (!level) return <div>Loading...</div>;

  return (
    <div>
      <h2>{level.name}</h2>
      <p>{level.description}</p>
      <div>
        <h3>Options:</h3>
        {level.options.map((option, index) => (
          <div key={index}>{option}</div>
        ))}
      </div>
      <button onClick={onClose}>Close</button>
    </div>
  );
}

// Example: Protected Level Editor
function ProtectedLevelEditor({ levelId }) {
  const [level, setLevel] = useState(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState('');

  const loadLevel = async (providedPin = '') => {
    try {
      const options = providedPin ? { pin: providedPin } : {};
      const { success, level: data } = await levelEditorApi.load(levelId, options);
      
      if (success) {
        setLevel(data);
        setNeedsPin(false);
      }
    } catch (error) {
      if (error.message.includes('PIN')) {
        setNeedsPin(true);
        alert('This level is PIN protected. Please enter the PIN.');
      } else {
        console.error('Failed to load level:', error);
      }
    }
  };

  useEffect(() => {
    loadLevel();
  }, [levelId]);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    loadLevel(pin);
  };

  if (needsPin) {
    return (
      <div>
        <h2>PIN Required</h2>
        <form onSubmit={handlePinSubmit}>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
          />
          <button type="submit">Unlock</button>
        </form>
      </div>
    );
  }

  if (!level) return <div>Loading...</div>;

  return (
    <div>
      <h1>Editing: {level.name}</h1>
      {/* Rest of editor UI */}
    </div>
  );
}

// Example: Bulk Operations
async function bulkPublishLevels(levelIds) {
  const results = [];
  
  for (const levelId of levelIds) {
    try {
      const result = await levelEditorApi.publish(levelId);
      results.push({ levelId, success: true, data: result });
    } catch (error) {
      results.push({ levelId, success: false, error: error.message });
    }
  }
  
  return results;
}

async function bulkDeleteLevels(levelIds) {
  const results = [];
  
  for (const levelId of levelIds) {
    try {
      const result = await levelEditorApi.delete(levelId);
      results.push({ levelId, success: true });
    } catch (error) {
      results.push({ levelId, success: false, error: error.message });
    }
  }
  
  return results;
}

export {
  LevelsListComponent,
  LevelsManagementDashboard,
  LevelEditorComponent,
  createNewLevel,
  cloneLevel,
  LevelSelectorForGame,
  ProtectedLevelEditor,
  bulkPublishLevels,
  bulkDeleteLevels,
};