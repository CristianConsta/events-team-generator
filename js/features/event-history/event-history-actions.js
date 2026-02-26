(function initEventHistoryActions(global) {
    function readHistoryFilterState() {
        var eventTypeEl = document.getElementById('eventHistoryFilterEventType');
        var teamEl = document.getElementById('eventHistoryFilterTeam');
        var searchEl = document.getElementById('eventHistorySearchFilter');
        return {
            eventTypeId: eventTypeEl ? eventTypeEl.value : '',
            team: teamEl ? teamEl.value : '',
            searchQuery: searchEl ? searchEl.value.trim().toLowerCase() : '',
        };
    }

    global.DSFeatureEventHistoryActions = {
        readHistoryFilterState: readHistoryFilterState,
    };
})(window);
