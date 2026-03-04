(function initFeaturePlayerUpdatesCore(global) {
    var VALID_TROOPS = ['Tank', 'Aero', 'Missile'];
    var DEFAULT_EXPIRY_HOURS = 48;
    var TOKEN_HEX_LENGTH = 32; // 32 hex chars = 16 bytes

    function generateToken() {
        var bytes = new Uint8Array(TOKEN_HEX_LENGTH / 2);
        crypto.getRandomValues(bytes);
        return Array.from(bytes).map(function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
    }

    function buildTokenDoc(playerName, allianceId, gameId, createdByUid, options) {
        var opts = options || {};
        var expiryHours = typeof opts.expiryHours === 'number' ? opts.expiryHours : DEFAULT_EXPIRY_HOURS;
        var now = new Date();
        var expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

        return {
            token: generateToken(),
            playerName: playerName || null,
            allianceId: allianceId || null,
            gameId: gameId || null,
            createdByUid: createdByUid || null,
            createdAt: now,
            expiresAt: expiresAt,
            used: false,
            usedAt: null,
            usedByAnonUid: null,
            linkedEventId: opts.linkedEventId || null,
            currentSnapshot: opts.currentSnapshot || {},
        };
    }

    function buildUpdateLink(token, allianceId, lang, gameId) {
        var origin = global.location && global.location.origin ? global.location.origin : '';
        var link = (
            origin +
            '/player-update.html' +
            '?token=' + encodeURIComponent(token) +
            '&alliance=' + encodeURIComponent(allianceId) +
            '&lang=' + encodeURIComponent(lang)
        );
        if (gameId) {
            link += '&gid=' + encodeURIComponent(gameId);
        }
        return link;
    }

    function formatLinksForMessaging(players) {
        if (!Array.isArray(players)) {
            return '';
        }
        return players.map(function (p) {
            return (p.playerName || '') + ': ' + (p.link || '');
        }).join('\n');
    }

    function validateProposedValues(proposed) {
        var errors = [];

        if (!proposed || typeof proposed !== 'object') {
            return { valid: false, errors: ['proposed values are required'] };
        }

        var power = Number(proposed.power);
        if (proposed.power === null || proposed.power === undefined || proposed.power === '' || !Number.isFinite(power)) {
            errors.push('power must be a number');
        } else if (power < 0 || power > 9999) {
            errors.push('power must be between 0 and 9999');
        }

        var thp = Number(proposed.thp);
        if (proposed.thp === null || proposed.thp === undefined || proposed.thp === '' || !Number.isFinite(thp)) {
            errors.push('thp must be a number');
        } else if (thp < 0 || thp > 99999) {
            errors.push('thp must be between 0 and 99999');
        }

        if (VALID_TROOPS.indexOf(proposed.troops) === -1) {
            errors.push('troops must be one of: ' + VALID_TROOPS.join(', '));
        }

        return { valid: errors.length === 0, errors: errors };
    }

    function calculateDeltas(old, proposed) {
        var rawOldPower = (old && old.power != null) ? Number(old.power) : null;
        var oldPower = (rawOldPower !== null && Number.isFinite(rawOldPower)) ? rawOldPower : null;
        var rawNewPower = (proposed && proposed.power != null) ? Number(proposed.power) : null;
        var newPower = (rawNewPower !== null && Number.isFinite(rawNewPower)) ? rawNewPower : null;
        var powerDelta = (oldPower !== null && newPower !== null) ? newPower - oldPower : null;
        var powerFlagged;
        if (oldPower === null || oldPower === 0) {
            powerFlagged = true;
        } else {
            powerFlagged = Math.abs(powerDelta / oldPower) > 0.20;
        }

        var rawOldThp = (old && old.thp != null) ? Number(old.thp) : null;
        var oldThp = (rawOldThp !== null && Number.isFinite(rawOldThp)) ? rawOldThp : null;
        var rawNewThp = (proposed && proposed.thp != null) ? Number(proposed.thp) : null;
        var newThp = (rawNewThp !== null && Number.isFinite(rawNewThp)) ? rawNewThp : null;
        var thpDelta = (oldThp !== null && newThp !== null) ? newThp - oldThp : null;
        var thpFlagged;
        if (oldThp === null || oldThp === 0) {
            thpFlagged = true;
        } else {
            thpFlagged = Math.abs(thpDelta / oldThp) > 0.20;
        }

        var oldTroops = old && old.troops;
        var newTroops = proposed && proposed.troops;
        var troopsChanged = oldTroops !== newTroops;

        return {
            power: {
                old: oldPower,
                new: newPower,
                delta: powerDelta,
                flagged: powerFlagged,
            },
            thp: {
                old: oldThp,
                new: newThp,
                delta: thpDelta,
                flagged: thpFlagged,
            },
            troops: {
                changed: troopsChanged,
                old: oldTroops,
                new: newTroops,
            },
        };
    }

    global.DSFeaturePlayerUpdatesCore = {
        generateToken: generateToken,
        buildTokenDoc: buildTokenDoc,
        buildUpdateLink: buildUpdateLink,
        formatLinksForMessaging: formatLinksForMessaging,
        validateProposedValues: validateProposedValues,
        calculateDeltas: calculateDeltas,
    };
})(window);
