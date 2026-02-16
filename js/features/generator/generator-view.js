(function initGeneratorView(global) {
    function syncAssignmentAlgorithmControl(options) {
        const settings = options && typeof options === 'object' ? options : {};
        const value = typeof settings.value === 'string' ? settings.value : 'balanced';
        const doc = settings.document || global.document;
        if (!doc) {
            return;
        }

        const radios = doc.querySelectorAll ? doc.querySelectorAll('input[name="assignmentAlgorithm"]') : [];
        if (radios && radios.length > 0) {
            radios.forEach(function eachRadio(input) {
                if (input && typeof input === 'object') {
                    input.checked = input.value === value;
                }
            });
            return;
        }

        const select = doc.getElementById ? doc.getElementById('assignmentAlgorithmSelect') : null;
        if (select) {
            select.value = value;
        }
    }

    global.DSFeatureGeneratorView = {
        syncAssignmentAlgorithmControl: syncAssignmentAlgorithmControl,
    };
})(window);
