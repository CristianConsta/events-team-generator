(function initEventHistoryActions(global) {
    function readHistoryFilterState() {
        // Filters are now managed via pill-button state in the controller.
        // This function reads the active pill from the DOM as a fallback.
        var eventContainer = document.getElementById('eventHistoryEventSelector');
        var teamContainer = document.getElementById('eventHistoryTeamSelector');
        var activeEvent = eventContainer ? eventContainer.querySelector('.event-btn.active') : null;
        var activeTeam = teamContainer ? teamContainer.querySelector('.event-btn.active') : null;
        return {
            eventTypeId: activeEvent ? (activeEvent.dataset.event || '') : '',
            team: activeTeam ? (activeTeam.dataset.team || '') : '',
        };
    }

    global.DSFeatureEventHistoryActions = {
        readHistoryFilterState: readHistoryFilterState,
    };
})(window);
