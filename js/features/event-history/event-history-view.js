(function initEventHistoryView(global) {
    function defaultTranslate(key) { return key; }
    function getTranslator(translate) {
        return typeof translate === 'function' ? translate : defaultTranslate;
    }

    function renderHistoryList(container, records, options) {
        if (!container) return;
        var opts = options || {};
        var t = getTranslator(opts.translate);
        container.innerHTML = '';

        if (!records || records.length === 0) {
            var empty = document.createElement('p');
            empty.className = 'event-history-empty';
            empty.setAttribute('data-i18n', 'event_history_empty');
            empty.textContent = t('event_history_empty');
            container.appendChild(empty);
            return;
        }

        var list = document.createElement('div');
        list.className = 'event-history-list';
        records.forEach(function(record) {
            var item = document.createElement('div');
            item.className = 'event-history-item';
            item.setAttribute('data-history-id', record.id || '');

            var teamBadge = document.createElement('span');
            teamBadge.className = 'event-history-team-badge';
            teamBadge.setAttribute('data-team', record.team || 'A');
            teamBadge.textContent = record.team || 'A';

            var info = document.createElement('div');
            info.className = 'event-history-item-info';

            var name = document.createElement('span');
            name.className = 'event-history-item-name';
            name.textContent = record.eventName || '';

            var date = document.createElement('span');
            date.className = 'event-history-item-date';
            var createdAt = record.createdAt;
            if (createdAt && typeof createdAt.toDate === 'function') {
                createdAt = createdAt.toDate();
            }
            if (createdAt) {
                var d = new Date(createdAt);
                var lang = (global.DSI18N && typeof global.DSI18N.getLanguage === 'function') ? global.DSI18N.getLanguage() : 'en';
                try {
                    date.textContent = new Intl.DateTimeFormat(lang, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
                } catch (_e) {
                    var dd = String(d.getDate()).padStart(2, '0');
                    var mm = String(d.getMonth() + 1).padStart(2, '0');
                    date.textContent = dd + '.' + mm + '.' + d.getFullYear();
                }
            }

            var playerCount = document.createElement('span');
            playerCount.className = 'event-history-item-players';
            var count = Array.isArray(record.players) ? record.players.length : 0;
            playerCount.textContent = count + ' ' + t('event_history_players_label');

            info.appendChild(name);
            info.appendChild(date);
            info.appendChild(playerCount);

            var actions = document.createElement('div');
            actions.className = 'event-history-item-actions';

            if (record.finalized) {
                var lockBadge = document.createElement('span');
                lockBadge.className = 'event-history-finalized-badge';
                lockBadge.setAttribute('data-i18n', 'event_history_finalized');
                lockBadge.textContent = t('event_history_finalized');
                actions.appendChild(lockBadge);
            }

            var openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'btn-secondary event-history-attendance-btn';
            openBtn.setAttribute('data-history-id', record.id || '');
            openBtn.setAttribute('data-action', 'open-attendance');
            var btnText = record.finalized
                ? t('event_history_view_attendance')
                : t('attendance_panel_title');
            openBtn.textContent = btnText;
            actions.appendChild(openBtn);

            var deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-danger-subtle event-history-delete-btn';
            deleteBtn.setAttribute('data-history-id', record.id || '');
            deleteBtn.setAttribute('data-action', 'delete-history');
            deleteBtn.setAttribute('title', t('event_history_delete'));
            deleteBtn.textContent = '\u00D7';
            actions.appendChild(deleteBtn);

            item.appendChild(teamBadge);
            item.appendChild(info);
            item.appendChild(actions);
            list.appendChild(item);
        });
        container.appendChild(list);
    }

    function renderAttendancePanel(container, historyDoc, attendanceDocs, options) {
        if (!container) return;
        var opts = options || {};
        var t = getTranslator(opts.translate);
        container.innerHTML = '';

        var isFinalized = historyDoc && historyDoc.finalized;

        if (historyDoc) {
            var header = document.createElement('div');
            header.className = 'attendance-header';
            var title = document.createElement('span');
            title.className = 'attendance-event-name';
            title.textContent = historyDoc.eventName || '';
            header.appendChild(title);
            container.appendChild(header);
        }

        var table = document.createElement('div');
        table.className = 'attendance-table';

        (attendanceDocs || []).forEach(function(doc) {
            var row = document.createElement('div');
            row.className = 'attendance-player-row';
            row.setAttribute('data-player-name', doc.playerName || '');

            var nameEl = document.createElement('span');
            nameEl.className = 'attendance-player-name';
            nameEl.textContent = doc.playerName || '';

            var roleBadge = document.createElement('span');
            roleBadge.className = 'attendance-role-badge';
            var role = doc.role || (doc.attendanceDoc && doc.attendanceDoc.role) || 'starter';
            roleBadge.textContent = role === 'substitute' ? t('role_substitute_short') : '';
            if (role !== 'substitute') roleBadge.classList.add('hidden');

            var status = doc.status || (doc.attendanceDoc && doc.attendanceDoc.status) || 'attended';
            var toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'attendance-status-toggle attendance-status-' + status;
            toggleBtn.setAttribute('data-player-name', doc.playerName || '');
            toggleBtn.setAttribute('data-doc-id', doc.docId || doc.playerName || '');
            toggleBtn.setAttribute('data-current-status', status);
            toggleBtn.setAttribute('data-action', 'cycle-attendance-status');
            toggleBtn.textContent = t('attendance_status_' + status);

            if (isFinalized) {
                toggleBtn.disabled = true;
                toggleBtn.setAttribute('aria-disabled', 'true');
            }

            row.appendChild(nameEl);
            row.appendChild(roleBadge);
            row.appendChild(toggleBtn);
            table.appendChild(row);
        });

        container.appendChild(table);
    }

    // Update a single toggle button after status cycle (no full re-render)
    function updateToggleButton(button, newStatus, translate) {
        var t = getTranslator(translate);
        var statuses = global.DSFeatureEventHistoryCore
            ? global.DSFeatureEventHistoryCore.ATTENDANCE_STATUSES
            : ['attended', 'no_show', 'excused'];
        statuses.forEach(function(s) {
            button.classList.remove('attendance-status-' + s);
        });
        button.classList.add('attendance-status-' + newStatus);
        button.setAttribute('data-current-status', newStatus);
        button.textContent = t('attendance_status_' + newStatus);
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

    function renderReliabilityDot(score, tier) {
        tier = tier || { cssClass: 'reliability-new', label: 'No history' };
        var dot = document.createElement('span');
        dot.className = 'reliability-dot ' + tier.cssClass;
        var ariaLabel = score !== null && score !== undefined
            ? 'Reliability: ' + score + '% (' + tier.label + ')'
            : 'No history yet';
        dot.setAttribute('aria-label', ariaLabel);
        dot.setAttribute('title', ariaLabel);
        return dot;
    }

    global.DSFeatureEventHistoryView = {
        renderHistoryList: renderHistoryList,
        renderAttendancePanel: renderAttendancePanel,
        updateToggleButton: updateToggleButton,
        renderPendingBadge: renderPendingBadge,
        renderReliabilityDot: renderReliabilityDot,
    };
})(window);
