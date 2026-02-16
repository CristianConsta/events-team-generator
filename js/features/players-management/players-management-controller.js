(function initPlayersManagementController(global) {
    function createController(deps) {
        const dependencies = deps && typeof deps === 'object' ? deps : {};

        return {
            submitAddPlayer: function submitAddPlayer(event) {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                if (typeof dependencies.handleAddPlayer === 'function') {
                    dependencies.handleAddPlayer();
                }
            },
            handleTableAction: function handleTableAction(event) {
                if (typeof dependencies.handleTableAction === 'function') {
                    dependencies.handleTableAction(event);
                }
            },
            handleFilterChange: function handleFilterChange(event) {
                if (typeof dependencies.handleFilterChange === 'function') {
                    dependencies.handleFilterChange(event);
                }
            },
            clearFilters: function clearFilters() {
                if (typeof dependencies.clearFilters === 'function') {
                    dependencies.clearFilters();
                }
            },
            switchSource: function switchSource(source) {
                if (typeof dependencies.switchSource === 'function') {
                    dependencies.switchSource(source);
                }
            },
            focusAddNameField: function focusAddNameField() {
                if (
                    global.DSFeaturePlayersManagementView
                    && typeof global.DSFeaturePlayersManagementView.focusAddNameField === 'function'
                ) {
                    global.DSFeaturePlayersManagementView.focusAddNameField(dependencies.document || global.document);
                    return;
                }
                if (typeof dependencies.focusAddNameField === 'function') {
                    dependencies.focusAddNameField();
                }
            },
        };
    }

    global.DSFeaturePlayersManagementController = {
        createController: createController,
    };
})(window);
