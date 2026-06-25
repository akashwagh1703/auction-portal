import { toast } from 'react-hot-toast'

/**
 * Undo manager for destructive actions
 */
class UndoManager {
  constructor() {
    this.history = []
    this.maxHistorySize = 10
  }

  /**
   * Add an action to history
   * @param {Object} action - Action object with undo function
   */
  addAction(action) {
    this.history.push({
      ...action,
      timestamp: Date.now(),
    })

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }
  }

  /**
   * Undo the last action
   */
  async undo() {
    if (this.history.length === 0) {
      toast.error('Nothing to undo')
      return
    }

    const lastAction = this.history.pop()
    try {
      await lastAction.undo()
      toast.success(`Undone: ${lastAction.description}`)
    } catch (error) {
      console.error('Undo failed:', error)
      toast.error('Failed to undo action')
      // Put action back in history if undo failed
      this.history.push(lastAction)
    }
  }

  /**
   * Clear all history
   */
  clear() {
    this.history = []
  }

  /**
   * Get history count
   */
  getHistoryCount() {
    return this.history.length
  }

  /**
   * Get last action description
   */
  getLastActionDescription() {
    return this.history[this.history.length - 1]?.description || null
  }
}

// Singleton instance
const undoManager = new UndoManager()

/**
 * Wrapper for destructive actions with undo support
 * @param {Function} action - The action to perform
 * @param {Function} undo - The undo function
 * @param {string} description - Description of the action
 * @returns {Promise} Result of the action
 */
export const withUndo = async (action, undo, description) => {
  try {
    const result = await action()
    undoManager.addAction({
      undo,
      description,
    })

    // Show toast with undo option
    toast.success(description, {
      duration: 5000,
      id: `undo-${Date.now()}`,
    })

    return result
  } catch (error) {
    toast.error('Action failed')
    throw error
  }
}

/**
 * Undo the last action
 */
export const undoLastAction = () => {
  undoManager.undo()
}

/**
 * Clear undo history
 */
export const clearUndoHistory = () => {
  undoManager.clear()
}

/**
 * Get undo history info
 */
export const getUndoInfo = () => ({
  count: undoManager.getHistoryCount(),
  lastAction: undoManager.getLastActionDescription(),
})

export default undoManager
