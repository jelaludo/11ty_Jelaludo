const { execSync } = require('child_process');

module.exports = function() {
    let gitHash = 'unknown';
    let gitCommitMessage = 'unknown';
    
    try {
        // Get short commit hash
        gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
        
        // Get last commit message (first line only)
        gitCommitMessage = execSync('git log -1 --pretty=%s', { encoding: 'utf-8' }).trim();
    } catch (error) {
        console.warn('Could not get git info:', error.message);
    }
    
    // Build timestamp
    const buildDate = new Date();
    const buildTimestamp = buildDate.toISOString();
    const buildDateFormatted = buildDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
    
    return {
        buildDate: buildTimestamp,
        buildDateFormatted: buildDateFormatted,
        gitHash: gitHash,
        gitCommitMessage: gitCommitMessage
    };
};

