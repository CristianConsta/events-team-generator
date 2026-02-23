(function initFeaturePlayerUpdatesActions(global) {
    // Read selected player names from player management table checkboxes.
    // Returns: Array<string> (raw player names)
    function readSelectedPlayerNames() {
        var checked = document.querySelectorAll('.player-select-checkbox:checked');
        var names = [];
        checked.forEach(function(checkbox) {
            var name = checkbox.getAttribute('data-player-name');
            if (name) {
                names.push(name);
            }
        });
        return names;
    }

    // Read token generation options from modal form.
    // Returns: { expiryHours: number, linkedEventId: string | null }
    function readTokenGenerationOptions() {
        var expiryEl = document.getElementById('tokenExpiryHours');
        var linkedEventEl = document.getElementById('tokenLinkedEventId');

        var expiryHours = 48;
        if (expiryEl && expiryEl.value) {
            var parsed = Number(expiryEl.value);
            if (Number.isFinite(parsed) && parsed > 0) {
                expiryHours = parsed;
            }
        }

        var linkedEventId = null;
        if (linkedEventEl && linkedEventEl.value) {
            linkedEventId = linkedEventEl.value || null;
        }

        return {
            expiryHours: expiryHours,
            linkedEventId: linkedEventId,
        };
    }

    // Read review decision from review panel.
    // updateId: string
    // Returns: { updateId: string, decision: 'approved' | 'rejected' }
    function readReviewDecision(updateId) {
        var radios = document.querySelectorAll(
            '.review-decision-radio[data-update-id="' + updateId + '"]:checked'
        );
        var decision = 'rejected';
        if (radios.length > 0) {
            decision = radios[0].value || 'rejected';
        }
        return {
            updateId: updateId,
            decision: decision,
        };
    }

    global.DSFeaturePlayerUpdatesActions = {
        readSelectedPlayerNames: readSelectedPlayerNames,
        readTokenGenerationOptions: readTokenGenerationOptions,
        readReviewDecision: readReviewDecision,
    };
})(window);
