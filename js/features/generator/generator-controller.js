(function initGeneratorController(global) {
    function createController(deps) {
        const dependencies = deps && typeof deps === 'object' ? deps : {};

        function getRoleLimits() {
            var actions = dependencies.generatorActions || global.DSFeatureGeneratorActions;
            if (
                actions
                && typeof actions.buildRoleLimits === 'function'
            ) {
                return actions.buildRoleLimits(dependencies.roleLimits);
            }
            return {
                maxTotal: 30,
                maxStarters: 20,
                maxSubstitutes: 10,
            };
        }

        return {
            changeAlgorithm: function changeAlgorithm(event) {
                if (event && event.target && event.target.type === 'radio' && !event.target.checked) {
                    return;
                }
                const nextRaw = event && event.target ? event.target.value : dependencies.defaultAlgorithm;
                var actions = dependencies.generatorActions || global.DSFeatureGeneratorActions;
                const normalized = (
                    actions
                    && typeof actions.normalizeAssignmentSelection === 'function'
                )
                    ? actions.normalizeAssignmentSelection(
                        nextRaw,
                        dependencies.normalizeAssignmentAlgorithm,
                        dependencies.defaultAlgorithm
                    )
                    : (typeof dependencies.normalizeAssignmentAlgorithm === 'function'
                        ? dependencies.normalizeAssignmentAlgorithm(nextRaw)
                        : nextRaw);

                if (typeof dependencies.setAssignmentAlgorithm === 'function') {
                    dependencies.setAssignmentAlgorithm(normalized);
                }

                var view = dependencies.generatorView || global.DSFeatureGeneratorView;
                if (
                    view
                    && typeof view.syncAssignmentAlgorithmControl === 'function'
                ) {
                    view.syncAssignmentAlgorithmControl({
                        document: dependencies.document || global.document,
                        value: normalized,
                    });
                } else if (typeof dependencies.syncAssignmentAlgorithmControl === 'function') {
                    dependencies.syncAssignmentAlgorithmControl();
                }
            },
            toggleTeamSelection: function toggleTeamSelection(playerName, team) {
                const limits = getRoleLimits();
                if (typeof dependencies.toggleTeamSelection === 'function') {
                    dependencies.toggleTeamSelection(playerName, team, limits);
                }
            },
            setPlayerRole: function setPlayerRole(playerName, role) {
                const limits = getRoleLimits();
                if (typeof dependencies.setPlayerRole === 'function') {
                    dependencies.setPlayerRole(playerName, role, limits);
                }
            },
            clearPlayerSelection: function clearPlayerSelection(playerName) {
                if (typeof dependencies.clearPlayerSelection === 'function') {
                    dependencies.clearPlayerSelection(playerName);
                }
            },
            clearAllSelections: function clearAllSelections() {
                if (typeof dependencies.clearAllSelections === 'function') {
                    dependencies.clearAllSelections();
                }
            },
            generateAssignments: function generateAssignments(team) {
                if (typeof dependencies.generateAssignments === 'function') {
                    dependencies.generateAssignments(team);
                }
            },
        };
    }

    global.DSFeatureGeneratorController = {
        createController: createController,
    };
})(window);
