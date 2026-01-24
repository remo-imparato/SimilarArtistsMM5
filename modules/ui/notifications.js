/**
 * UI Notifications and Progress Display
 * 
 * Handles toast notifications and progress bar updates for user feedback.
 * MediaMonkey 5 API Only
 */

'use strict';

/**
 * Global progress task reference for use across functions.
 * Set during long-running operations, cleared on completion.
 */
let globalProgressTask = null;

/**
 * Display a toast-like UI notification.
 * Uses MM5's uitools.toastMessage.show API.
 * @param {string} text Toast message text.
 * @param {string|object} [options] Toast options ('info', 'success', 'error', 'warning') or options object.
 */
function showToast(text, options = {}) {
	try {
		// Normalize options - if string, treat as type
		const opts = typeof options === 'string' ? { type: options } : options;
		
		// Use MM5's toastMessage API
		if (typeof uitools !== 'undefined' && uitools?.toastMessage?.show) {
			uitools.toastMessage.show(text, opts);
			return;
		}
		
		// Fallback to console log
		console.log('Match Monkey: ' + text);
	} catch (e) {
		console.error('Match Monkey: showToast error: ' + e.toString());
	}
}

/**
 * Update progress bar with informative message.
 * Called during long-running operations to show user progress.
 * @param {string} message Progress message to display.
 * @param {number} [value] Progress value (0-1), optional.
 */
function updateProgress(message, value) {
	if (globalProgressTask) {
		try {
			globalProgressTask.text = message;
			if (value !== undefined && typeof value === 'number') {
				globalProgressTask.value = Math.max(0, Math.min(1, value));
			}
		} catch (e) {
			console.error('Match Monkey: updateProgress error: ' + e.toString());
		}
	}
}

/**
 * Create and initialize a progress task for display during operations.
 * Uses MM5's app.backgroundTasks API.
 * @param {string} leadingText Initial text to display.
 * @returns {string|null} Task ID for reference, or null if not available.
 */
function createProgressTask(leadingText) {
	try {
		if (typeof app !== 'undefined' && app.backgroundTasks?.createNew) {
			const progressTask = app.backgroundTasks.createNew();
			progressTask.leadingText = leadingText || 'MatchMonkey';
			progressTask.text = 'Starting...';
			progressTask.value = 0;
			globalProgressTask = progressTask;
			console.log('Match Monkey: Progress task created');
			return progressTask.id || 'active';
		}
	} catch (e) {
		console.error('Match Monkey: createProgressTask error: ' + e.toString());
	}
	return null;
}

/**
 * Terminate the current progress task.
 * @param {string} [taskId] Optional task ID (currently unused, kept for API compatibility).
 */
function terminateProgressTask(taskId) {
	if (globalProgressTask) {
		try {
			globalProgressTask.terminate();
		} catch (e) {
			console.error('Match Monkey: Error terminating progress task: ' + e.toString());
		}
		globalProgressTask = null;
	}
}

/**
 * Terminate progress task after a delay (to keep it visible briefly).
 * @param {number} [delay=2000] Milliseconds to wait before terminating.
 */
function terminateProgressTaskAfterDelay(delay = 2000) {
	if (globalProgressTask) {
		const task = globalProgressTask;
		setTimeout(() => {
			try {
				if (task === globalProgressTask) {
					terminateProgressTask();
				}
			} catch (e) {
				console.error('Match Monkey: Error in delayed termination: ' + e.toString());
			}
		}, delay);
	}
}

/**
 * Get the current global progress task (for direct access if needed).
 * @returns {object|null} Progress task or null.
 */
function getProgressTask() {
	return globalProgressTask;
}

// Export to window namespace for MM5
window.matchMonkeyNotifications = {
	showToast,
	updateProgress,
	createProgressTask,
	terminateProgressTask,
	terminateProgressTaskAfterDelay,
	getProgressTask,
};

// Also export updateProgress globally for backward compatibility
window.updateProgress = updateProgress;
