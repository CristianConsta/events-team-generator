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

    function buildUpdateLink(token, allianceId, lang) {
        var origin = global.location && global.location.origin ? global.location.origin : '';
        return (
            origin +
            '/player-update.html' +
            '?token=' + encodeURIComponent(token) +
            '&aid=' + encodeURIComponent(allianceId) +
            '&lang=' + encodeURIComponent(lang)
        );
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
        var oldPower = Number(old && old.power);
        var newPower = Number(proposed && proposed.power);
        var powerDelta = newPower - oldPower;
        var powerFlagged;
        if (!Number.isFinite(oldPower) || oldPower === 0) {
            powerFlagged = true;
        } else {
            powerFlagged = Math.abs(powerDelta / oldPower) > 0.20;
        }

        var oldThp = Number(old && old.thp);
        var newThp = Number(proposed && proposed.thp);
        var thpDelta = newThp - oldThp;
        var thpFlagged;
        if (!Number.isFinite(oldThp) || oldThp === 0) {
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
