(function initEventsManagerSelector(global) {
    function resolveEventDisplayName(eventId, options) {
        const settings = options && typeof options === 'object' ? options : {};
        const getEvent = typeof settings.getEvent === 'function' ? settings.getEvent : function noop() { return null; };
        const translate = typeof settings.translate === 'function' ? settings.translate : function identity(key) { return key; };

        const event = getEvent(eventId);
        if (!event) {
            return eventId;
        }
        if (typeof event.name === 'string' && event.name.trim()) {
            return event.name.trim();
        }
        if (event.titleKey) {
            const translated = translate(event.titleKey);
            if (translated && translated !== event.titleKey) {
                return translated;
            }
        }
        return event.name || eventId;
    }

    function createEventSelectorButton(options) {
        const settings = options && typeof options === 'object' ? options : {};
        const documentRef = settings.document || global.document;
        if (!documentRef || typeof documentRef.createElement !== 'function') {
            return null;
        }

        const eventId = settings.eventId;
        const currentEvent = settings.currentEvent;
        const displayName = settings.displayName;
        const onSelect = typeof settings.onSelect === 'function' ? settings.onSelect : function noop() {};

        const button = documentRef.createElement('button');
        button.className = 'event-btn' + (eventId === currentEvent ? ' active' : '');
        button.type = 'button';
        button.dataset.event = eventId;
        button.textContent = displayName;
        button.addEventListener('click', function onClick() {
            onSelect(eventId);
        });
        return button;
    }

    function renderEventSelector(options) {
        const settings = options && typeof options === 'object' ? options : {};
        const documentRef = settings.document || global.document;
        const container = settings.container
            || (documentRef && typeof settings.containerId === 'string' ? documentRef.getElementById(settings.containerId) : null);

        if (!container) {
            return;
        }

        const eventIds = Array.isArray(settings.eventIds) ? settings.eventIds : [];
        const currentEvent = settings.currentEvent;
        const getDisplayName = typeof settings.getDisplayName === 'function'
            ? settings.getDisplayName
            : function fallbackName(eventId) { return eventId; };
        const onSelect = typeof settings.onSelect === 'function' ? settings.onSelect : function noop() {};

        container.innerHTML = '';
        eventIds.forEach(function addEvent(eventId) {
            const button = createEventSelectorButton({
                document: documentRef,
                eventId: eventId,
                currentEvent: currentEvent,
                displayName: getDisplayName(eventId),
                onSelect: onSelect,
            });
            if (button) {
                container.appendChild(button);
            }
        });
    }

    global.DSFeatureEventsManagerSelector = {
        resolveEventDisplayName: resolveEventDisplayName,
        createEventSelectorButton: createEventSelectorButton,
        renderEventSelector: renderEventSelector,
    };
})(window);
