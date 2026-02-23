(function initEventHistoryView(global) {
    function renderHistoryList(container, records) {
        if (!container) return;
        container.innerHTML = '';
        if (!records || records.length === 0) {
            var empty = document.createElement('p');
            empty.setAttribute('data-i18n', 'event_history_empty');
            empty.textContent = 'No events recorded yet.';
            container.appendChild(empty);
            return;
        }
        var list = document.createElement('ul');
        list.className = 'event-history-list';
        records.forEach(function(record) {
            var item = document.createElement('li');
            item.className = 'event-history-item';
            item.setAttribute('data-history-id', record.id || '');

            var name = document.createElement('span');
            name.className = 'event-history-item-name';
            name.textContent = record.eventName || '';

            var date = document.createElement('span');
            date.className = 'event-history-item-date';
            var scheduledAt = record.scheduledAt;
            if (scheduledAt && typeof scheduledAt.toDate === 'function') {
                scheduledAt = scheduledAt.toDate();
            }
            date.textContent = scheduledAt ? new Date(scheduledAt).toLocaleDateString() : '';

            var status = document.createElement('span');
            status.className = 'event-history-item-status event-history-status-' + (record.status || 'planned');
            var statusKey = 'event_history_status_' + (record.status || 'planned');
            status.setAttribute('data-i18n', statusKey);
            status.textContent = record.status || 'planned';

            var openBtn = document.createElement('button');
            openBtn.className = 'secondary';
            openBtn.setAttribute('data-history-id', record.id || '');
            openBtn.setAttribute('data-action', 'open-attendance');
            openBtn.setAttribute('title', 'Mark attendance for ' + (record.eventName || 'event'));
            openBtn.setAttribute('aria-label', 'Mark attendance for ' + (record.eventName || 'event'));
            openBtn.innerHTML = '<span class="action-btn-text">Mark Attendance</span><span class="action-btn-icon" aria-hidden="true">&#10003;</span>';

            item.appendChild(name);
            item.appendChild(date);
            item.appendChild(status);
            if (!record.finalized) {
                item.appendChild(openBtn);
            }
            list.appendChild(item);
        });
        container.appendChild(list);
    }

    function renderAttendancePanel(container, historyDoc, attendanceDocs) {
        if (!container) return;
        container.innerHTML = '';

        var stalenessCheck = null;
        if (global.DSFeatureEventHistoryCore && typeof global.DSFeatureEventHistoryCore.checkFinalizationStaleness === 'function') {
            stalenessCheck = global.DSFeatureEventHistoryCore.checkFinalizationStaleness(historyDoc, new Date());
        }

        if (stalenessCheck && stalenessCheck.stale) {
            var warning = document.createElement('div');
            warning.className = 'attendance-staleness-warning';
            warning.setAttribute('data-i18n', 'attendance_staleness_warning');
            warning.textContent = 'This event was completed ' + stalenessCheck.daysSinceCompleted + ' days ago and attendance has not been finalized.';
            container.appendChild(warning);
        }

        var statuses = ['attended', 'no_show', 'excused', 'late_sub', 'cancelled_event'];
        var statusLabels = {
            attended: 'Attended',
            no_show: 'No Show',
            excused: 'Excused',
            late_sub: 'Late Sub',
            cancelled_event: 'Event Cancelled',
        };

        (attendanceDocs || []).forEach(function(doc) {
            var row = document.createElement('div');
            row.className = 'attendance-player-row';
            row.setAttribute('data-player-name', doc.playerName || '');

            var nameEl = document.createElement('span');
            nameEl.className = 'attendance-player-name';
            nameEl.textContent = doc.playerName || '';
            row.appendChild(nameEl);

            var radioGroup = document.createElement('div');
            radioGroup.className = 'attendance-radio-group';

            var groupName = 'attendance_' + (doc.docId || doc.playerName || '').replace(/\s+/g, '_');
            statuses.forEach(function(s) {
                var label = document.createElement('label');
                var radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = groupName;
                radio.value = s;
                radio.setAttribute('data-player-name', doc.playerName || '');
                if (doc.status === s) {
                    radio.checked = true;
                }
                if (historyDoc && historyDoc.finalized) {
                    radio.disabled = true;
                }
                label.appendChild(radio);
                label.appendChild(document.createTextNode(' ' + (statusLabels[s] || s)));
                radioGroup.appendChild(label);
            });

            row.appendChild(radioGroup);
            container.appendChild(row);
        });
    }

    function renderReliabilityDot(score) {
        var tier = { cssClass: 'reliability-new', label: 'No history' };
        if (global.DSCoreReliability && typeof global.DSCoreReliability.getReliabilityTier === 'function') {
            tier = global.DSCoreReliability.getReliabilityTier(score);
        }
        var dot = document.createElement('span');
        dot.className = 'reliability-dot ' + tier.cssClass;
        var ariaLabel = score !== null && score !== undefined
            ? 'Reliability: ' + score + '% (' + tier.label + ')'
            : 'No history yet';
        dot.setAttribute('aria-label', ariaLabel);
        dot.setAttribute('title', ariaLabel);
        return dot;
    }

    function renderPendingBadge(container, count) {
        if (!container) return;
        container.textContent = count || '0';
        if (count && count > 0) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }

    global.DSFeatureEventHistoryView = {
        renderHistoryList: renderHistoryList,
        renderAttendancePanel: renderAttendancePanel,
        renderReliabilityDot: renderReliabilityDot,
        renderPendingBadge: renderPendingBadge,
    };
})(window);
