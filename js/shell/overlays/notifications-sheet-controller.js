(function initShellNotificationsSheetController(global) {
    function setSheetState(options) {
        const settings = options && typeof options === 'object' ? options : {};
        const panel = settings.panel;
        const triggerButton = settings.triggerButton;
        const body = settings.body;
        const setPanelVisibility = typeof settings.setPanelVisibility === 'function'
            ? settings.setPanelVisibility
            : null;
        const isOpen = settings.isOpen === true;

        if (panel && setPanelVisibility) {
            setPanelVisibility(panel, isOpen);
        }
        if (triggerButton && typeof triggerButton.setAttribute === 'function') {
            triggerButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
        if (body && body.classList) {
            body.classList.toggle('notifications-sheet-open', isOpen);
        }

        return isOpen;
    }

    global.DSShellNotificationsSheetController = {
        setSheetState: setSheetState,
    };
})(window);
