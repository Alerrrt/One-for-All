const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;

/**
 * Path Sanitization Utility
 * Prevents path traversal and command injection attacks
 */

// Dangerous patterns that indicate path traversal attempts
const DANGEROUS_PATTERNS = [
    /\.\./,           // Parent directory
    /~\//,            // Home directory
    /^\//,            // Absolute path
    /\\/,             // Windows path separator
    /\0/,             // Null byte
    /[<>:"|?*]/,      // Invalid filename characters
];

// Valid filename pattern (alphanumeric, dots, hyphens, underscores)
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,254}$/;

/**
 * Validates a filename for security issues
 * @param {string} filename - The filename to validate
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        return { valid: false, error: 'Filename is required and must be a string' };
    }

    // Check length (max 255 chars for most filesystems)
    if (filename.length > 255) {
        return { valid: false, error: 'Filename too long (max 255 characters)' };
    }

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(filename)) {
            return { valid: false, error: `Filename contains invalid pattern: ${pattern}` };
        }
    }

    // Check against safe pattern
    if (!SAFE_FILENAME_PATTERN.test(filename)) {
        return { valid: false, error: 'Filename contains invalid characters' };
    }

    return { valid: true };
}

/**
 * Sanitizes a filename by removing or replacing dangerous characters
 * @param {string} filename - The filename to sanitize
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
    if (!filename) return '';

    // Get basename to remove any path components
    let safe = path.basename(filename);

    // Remove or replace dangerous characters
    safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Ensure it doesn't start with a dot (hidden file)
    if (safe.startsWith('.')) {
        safe = '_' + safe.slice(1);
    }

    // Truncate if too long
    if (safe.length > 255) {
        const ext = path.extname(safe);
        const base = safe.slice(0, 255 - ext.length);
        safe = base + ext;
    }

    return safe || 'unnamed_file';
}

/**
 * Generates a secure random filename
 * @param {string} originalName - Original filename (for extension)
 * @returns {string} - Cryptographically secure filename
 */
function generateSecureFilename(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}_${hash}${ext}`;
}

/**
 * Validates that a path is within an allowed directory
 * @param {string} targetPath - Path to validate
 * @param {string} allowedDir - Allowed base directory
 * @returns {Promise<Object>} - { valid: boolean, resolvedPath?: string, error?: string }
 */
async function validatePathInDirectory(targetPath, allowedDir) {
    try {
        // Resolve both paths to absolute
        const resolvedTarget = path.resolve(targetPath);
        const resolvedAllowed = path.resolve(allowedDir);

        // Check if target is within allowed directory
        if (!resolvedTarget.startsWith(resolvedAllowed + path.sep) &&
            resolvedTarget !== resolvedAllowed) {
            return {
                valid: false,
                error: 'Path is outside allowed directory (path traversal attempt detected)'
            };
        }

        // Verify the path exists
        await fs.access(resolvedTarget);

        return { valid: true, resolvedPath: resolvedTarget };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { valid: false, error: 'File does not exist' };
        }
        return { valid: false, error: `Path validation error: ${error.message}` };
    }
}

/**
 * Creates a safe file path within a directory
 * @param {string} directory - Base directory
 * @param {string} filename - Filename (will be sanitized)
 * @returns {string} - Safe absolute path
 */
function createSafePath(directory, filename) {
    const sanitized = sanitizeFilename(filename);
    return path.join(path.resolve(directory), sanitized);
}

/**
 * Extracts and validates file extension
 * @param {string} filename - Filename to extract extension from
 * @param {Array<string>} allowedExtensions - List of allowed extensions
 * @returns {Object} - { valid: boolean, extension?: string, error?: string }
 */
function validateExtension(filename, allowedExtensions) {
    const ext = path.extname(filename).toLowerCase().slice(1); // Remove leading dot

    if (!ext) {
        return { valid: false, error: 'File has no extension' };
    }

    if (!allowedExtensions.includes(ext)) {
        return {
            valid: false,
            error: `Extension .${ext} is not in allowed list: ${allowedExtensions.join(', ')}`
        };
    }

    return { valid: true, extension: ext };
}

module.exports = {
    validateFilename,
    sanitizeFilename,
    generateSecureFilename,
    validatePathInDirectory,
    createSafePath,
    validateExtension,
    SAFE_FILENAME_PATTERN
};
