(function initPlayersManagementView(global) {
    function focusAddNameField(documentRef) {
        const doc = documentRef || global.document;
        const input = doc && typeof doc.getElementById === 'function' ? doc.getElementById('playersMgmtNewName') : null;
        if (input && typeof input.focus === 'function') {
            input.focus();
        }
    }

    function setAddPanelExpanded(options) {
        const settings = options && typeof options === 'object' ? options : {};
        const expanded = settings.expanded === true;
        const toggle = typeof settings.toggleAddPanel === 'function' ? settings.toggleAddPanel : null;
        if (toggle) {
            toggle(expanded);
        }
        return expanded;
    }

    global.DSFeaturePlayersManagementView = {
        focusAddNameField: focusAddNameField,
        setAddPanelExpanded: setAddPanelExpanded,
    };
})(window);
