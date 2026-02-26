(function initEventHistoryActions(global) {
    function readHistoryFilterState() {
        var eventTypeEl = document.getElementById('eventHistoryFilterEventType');
        return {
            eventTypeId: eventTypeEl ? eventTypeEl.value : '',
        };
    }

    global.DSFeatureEventHistoryActions = {
        readHistoryFilterState: readHistoryFilterState,
    };
})(window);
