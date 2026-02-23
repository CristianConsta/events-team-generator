(function initEventHistoryActions(global) {
    function readAttendanceFormState() {
        var result = {};
        var radios = document.querySelectorAll('.attendance-radio-group input[type="radio"]:checked');
        radios.forEach(function(radio) {
            var playerName = radio.getAttribute('data-player-name');
            if (playerName) {
                result[playerName] = radio.value;
            }
        });
        return result;
    }

    function readHistoryFilterState() {
        var gameIdEl = document.getElementById('eventHistoryFilterGameId');
        var statusEl = document.getElementById('eventHistoryFilterStatus');
        var dateRangeEl = document.getElementById('eventHistoryFilterDateRange');
        return {
            gameId: gameIdEl ? gameIdEl.value : '',
            status: statusEl ? statusEl.value : '',
            dateRange: dateRangeEl ? dateRangeEl.value : '',
        };
    }

    global.DSFeatureEventHistoryActions = {
        readAttendanceFormState: readAttendanceFormState,
        readHistoryFilterState: readHistoryFilterState,
    };
})(window);
