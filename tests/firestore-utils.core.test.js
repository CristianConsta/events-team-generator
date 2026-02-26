const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Inline the implementation for unit testing (no browser globals needed)
function sanitizeDocId(name) {
    if (typeof name !== 'string' || name.length === 0) return '_empty_';
    // eslint-disable-next-line no-useless-escape
    var sanitized = name.replace(/[\/\.#\[\]\*]/g, '_');
    sanitized = sanitized.replace(/^__/, '_x_').replace(/__$/, '_x_');
    if (sanitized.length > 1500) sanitized = sanitized.slice(0, 1500);
    return sanitized;
}

describe('DSFirestoreUtils.sanitizeDocId', () => {
    it('returns _empty_ for empty string', () => {
        assert.equal(sanitizeDocId(''), '_empty_');
    });

    it('returns _empty_ for non-string input', () => {
        assert.equal(sanitizeDocId(null), '_empty_');
        assert.equal(sanitizeDocId(undefined), '_empty_');
        assert.equal(sanitizeDocId(42), '_empty_');
    });

    it('returns normal name unchanged', () => {
        assert.equal(sanitizeDocId('PlayerOne'), 'PlayerOne');
        assert.equal(sanitizeDocId('alice123'), 'alice123');
    });

    it('replaces / with _', () => {
        assert.equal(sanitizeDocId('player/name'), 'player_name');
    });

    it('replaces . with _', () => {
        assert.equal(sanitizeDocId('player.name'), 'player_name');
    });

    it('replaces # [ ] * with _', () => {
        assert.equal(sanitizeDocId('p#1'), 'p_1');
        assert.equal(sanitizeDocId('p[1]'), 'p_1_');
        assert.equal(sanitizeDocId('p*1'), 'p_1');
    });

    it('replaces leading __ with _x_', () => {
        assert.equal(sanitizeDocId('__hello'), '_x_hello');
    });

    it('replaces trailing __ with _x_', () => {
        assert.equal(sanitizeDocId('hello__'), 'hello_x_');
    });

    it('truncates names longer than 1500 chars', () => {
        const longName = 'a'.repeat(2000);
        const result = sanitizeDocId(longName);
        assert.equal(result.length, 1500);
    });

    it('does not truncate names of exactly 1500 chars', () => {
        const name = 'a'.repeat(1500);
        const result = sanitizeDocId(name);
        assert.equal(result.length, 1500);
    });
});
