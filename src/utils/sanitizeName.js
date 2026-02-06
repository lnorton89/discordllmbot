/**
 * Sanitize a name (guild name, username, etc.) to be a valid Windows folder/filename
 * Removes or replaces invalid characters
 * @param {string} name - Name to sanitize
 * @returns {string} Sanitized name safe for use as folder/file name
 */
export function sanitizeName(name) {
    if (!name || typeof name !== 'string') {
        return 'unnamed'
    }

    // Replace Windows-invalid characters: < > : " / \ | ? *
    let sanitized = name
        .replace(/[<>:"/\\|?*]/g, '_')
        // Replace leading/trailing spaces and dots
        .replace(/^[\s.]+|[\s.]+$/g, '')
        // Collapse multiple underscores
        .replace(/_+/g, '_')
        // Limit length to 200 chars (Windows has 260 char path limit, be conservative)
        .substring(0, 200)

    // If empty after sanitization, use a default
    if (!sanitized) {
        return 'unnamed'
    }

    return sanitized
}
