/**
 * UI Notifications and Progress Display
 * 
 * Handles toast notifications and progress bar updates for user feedback.
 */

'use strict';

/**
 * Global progress task reference for use across functions.
 * Set during long-running operations, cleared on completion.
 */
let globalProgressTask = null;

/**
 * Display a toast-like UI notification when possible, otherwise fallback to logging.
 * @param {string} text Toast message text.
 * @param {object} options Toast options object (implementation-specific).
 */
function showToast(text, options = {}) {
	try {
		// Use uitools.toastMessage.show (MM5 API)
		if (typeof uitools !== 'undefined' && uitools?.toastMessage?.show) {
			uitools.toastMessage.show(text, options);
			return;
		}
		// Fallback to console log
		console.log('Similar Artists: ' + text);
	} catch (e) {
		console.error('Similar Artists: showToast error: ' + e.toString());
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
		globalProgressTask.text = message;
		if (value !== undefined) {
			globalProgressTask.value = value;
		}
	}
}

/**
 * Create and initialize a progress task for display during operations.
 * @param {string} leadingText Initial text to display.
 * @returns {object|null} Progress task object, or null if not available.
 */
function createProgressTask(leadingText) {
	try {
		if (app.backgroundTasks?.createNew) {
			const progressTask = app.backgroundTasks.createNew();
			progressTask.leadingText = leadingText;
			globalProgressTask = progressTask;
			console.log('Similar Artists: Progress task created');
			return progressTask;
		}
	} catch (e) {
		console.error('Similar Artists: createProgressTask error: ' + e.toString());
	}
	return null;
}

/**
 * Terminate the current progress task.
 */
function terminateProgressTask() {
	if (globalProgressTask) {
		try {
			globalProgressTask.terminate();
		} catch (e) {
			console.error('Similar Artists: Error terminating progress task: ' + e.toString());
		}
		globalProgressTask = null;
	}
}

/**
 * Terminate progress task after a delay (to keep it visible briefly).
 * @param {number} delay Milliseconds to wait before terminating.
 */
function terminateProgressTaskAfterDelay(delay = 2000) {
	if (globalProgressTask) {
		setTimeout(() => {
			terminateProgressTask();
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

module.exports = {
	showToast,
	updateProgress,
	createProgressTask,
	terminateProgressTask,
	terminateProgressTaskAfterDelay,
	getProgressTask,
};
