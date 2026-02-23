(function initFirestoreUtils(global) {
    // Sanitize a string for use as a Firestore document ID.
    // Replaces invalid chars with '_', trims to 1500 bytes (Firestore limit).
    // Does NOT guarantee uniqueness — callers must be aware of collisions.
    function sanitizeDocId(name) {
        if (typeof name !== 'string' || name.length === 0) return '_empty_';
        // Replace invalid Firestore doc ID chars
        var sanitized = name.replace(/[\/\.#\[\]\*]/g, '_');
        // Firestore doc IDs cannot start/end with __
        sanitized = sanitized.replace(/^__/, '_x_').replace(/__$/, '_x_');
        // Trim to 1500 bytes (Firestore limit is 1500 bytes for doc IDs)
        if (sanitized.length > 1500) sanitized = sanitized.slice(0, 1500);
        return sanitized;
    }

    global.DSFirestoreUtils = {
        sanitizeDocId: sanitizeDocId,
    };
})(window);
