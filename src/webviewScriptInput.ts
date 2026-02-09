/**
 * Webview Script - Input Module
 * Refactored to combine multiple sub-modules for better maintainability
 */

import { ATTACHMENT_MANAGER_SCRIPT, DROP_HANDLER_SCRIPT, INPUT_EVENTS_SCRIPT } from './scripts/input';

export const WEBVIEW_SCRIPT_INPUT = `
                    ${ATTACHMENT_MANAGER_SCRIPT}

                    ${DROP_HANDLER_SCRIPT}

                    function showHintMessage(text, timeoutMs) {
                        if (!hintText) {
                            return;
                        }
                        if (hintTimer) {
                            clearTimeout(hintTimer);
                            hintTimer = null;
                        }
                        hintText.textContent = text;
                        if (timeoutMs > 0) {
                            hintTimer = setTimeout(() => {
                                hintTimer = null;
                                if (!isThinking && !inputContainer.classList.contains('drop-active')) {
                                    hintText.textContent = '';
                                }
                            }, timeoutMs);
                        }
                    }

                    function getProviderLabel(provider) {
                        if (provider === 'claude') {
                            return 'Claude';
                        }
                        if (provider === 'pi') {
                            return 'Pi';
                        }
                        return 'Codex';
                    }

                    function normalizeProvider(provider) {
                        if (provider === 'claude') {
                            return 'claude';
                        }
                        if (provider === 'pi') {
                            return 'pi';
                        }
                        return 'codex';
                    }

                    function syncProviderSelectUi(provider) {
                        const normalizedProvider = normalizeProvider(provider);
                        if (providerSelectLabel) {
                            providerSelectLabel.textContent = getProviderLabel(normalizedProvider);
                        }

                        providerSelectOptions.forEach(option => {
                            const optionProvider = option.getAttribute('data-provider-option');
                            const selected = optionProvider === normalizedProvider;
                            option.setAttribute('data-selected', selected ? 'true' : 'false');
                            option.setAttribute('aria-selected', selected ? 'true' : 'false');
                        });
                    }

                    function closeProviderMenu() {
                        if (!providerSelectWrap) {
                            return;
                        }

                        providerSelectWrap.classList.remove('open');
                        providerSelectWrap.classList.remove('open-up');

                        if (providerSelectTrigger) {
                            providerSelectTrigger.setAttribute('aria-expanded', 'false');
                        }
                    }

                    function openProviderMenu() {
                        if (!providerSelectWrap || !providerSelectTrigger || !providerSelectMenu) {
                            return;
                        }

                        if (isThinking || (providerSelect && providerSelect.disabled)) {
                            return;
                        }

                        const triggerRect = providerSelectTrigger.getBoundingClientRect();
                        const estimatedHeight = Math.max(180, providerSelectMenu.scrollHeight || 0);
                        const spaceBelow = window.innerHeight - triggerRect.bottom;

                        providerSelectWrap.classList.toggle('open-up', spaceBelow < estimatedHeight);
                        providerSelectWrap.classList.add('open');
                        providerSelectTrigger.setAttribute('aria-expanded', 'true');
                    }

                    function toggleProviderMenu() {
                        if (!providerSelectWrap) {
                            return;
                        }

                        if (providerSelectWrap.classList.contains('open')) {
                            closeProviderMenu();
                            return;
                        }

                        openProviderMenu();
                    }

                    function formatHistoryTime(timestamp) {
                        const value = Number(timestamp);
                        if (!Number.isFinite(value) || value <= 0) {
                            return '';
                        }

                        const deltaMs = Math.max(0, Date.now() - value);
                        if (deltaMs < 60 * 1000) {
                            return 'JUST NOW';
                        }

                        if (deltaMs < 60 * 60 * 1000) {
                            return Math.floor(deltaMs / (60 * 1000)) + ' MIN AGO';
                        }

                        if (deltaMs < 24 * 60 * 60 * 1000) {
                            return Math.floor(deltaMs / (60 * 60 * 1000)) + ' H AGO';
                        }

                        if (deltaMs < 30 * 24 * 60 * 60 * 1000) {
                            return Math.floor(deltaMs / (24 * 60 * 60 * 1000)) + ' D AGO';
                        }

                        return new Date(value).toISOString().slice(0, 10);
                    }

                    function getHistorySessions() {
                        const query = String(historySearchText || '').trim().toLowerCase();
                        const list = Array.isArray(sessions) ? sessions.slice() : [];

                        const filtered = query
                            ? list.filter(session => {
                                const title = String(session && session.title ? session.title : '').toLowerCase();
                                const preview = String(session && session.previewText ? session.previewText : '').toLowerCase();
                                return title.includes(query) || preview.includes(query);
                            })
                            : list;

                        const order = historySortValue === 'updated-asc' ? 'updated-asc' : 'updated-desc';
                        filtered.sort((left, right) => {
                            const leftUpdated = Number(left && left.updatedAt ? left.updatedAt : 0);
                            const rightUpdated = Number(right && right.updatedAt ? right.updatedAt : 0);
                            return order === 'updated-asc'
                                ? leftUpdated - rightUpdated
                                : rightUpdated - leftUpdated;
                        });

                        return filtered;
                    }

                    function cleanupSelectedSessionIds() {
                        const availableIds = new Set(
                            sessions
                                .map(session => session && typeof session.id === 'string' ? session.id : '')
                                .filter(Boolean),
                        );

                        Array.from(selectedSessionIds).forEach(sessionId => {
                            if (!availableIds.has(sessionId)) {
                                selectedSessionIds.delete(sessionId);
                            }
                        });
                    }

                    function updateMultiSelectUi() {
                        if (historyPage) {
                            historyPage.classList.toggle('multi-select-mode', isMultiSelectMode);
                        }

                        if (historyMultiSelectBtn) {
                            historyMultiSelectBtn.setAttribute('aria-pressed', isMultiSelectMode ? 'true' : 'false');
                            historyMultiSelectBtn.title = isMultiSelectMode ? '退出多选' : '多选';
                        }

                        if (historyMultiActions) {
                            historyMultiActions.style.display = isMultiSelectMode ? 'inline-flex' : 'none';
                        }

                        if (historySelectedCount) {
                            historySelectedCount.textContent = String(selectedSessionIds.size);
                        }

                        const disabled = selectedSessionIds.size === 0;
                        if (historyMultiDeleteBtn) {
                            historyMultiDeleteBtn.disabled = disabled;
                        }
                        if (historyMultiExportBtn) {
                            historyMultiExportBtn.disabled = disabled;
                        }
                    }

                    function setMultiSelectMode(enabled) {
                        const nextEnabled = Boolean(enabled);
                        if (!nextEnabled) {
                            selectedSessionIds.clear();
                        }
                        isMultiSelectMode = nextEnabled;
                        updateMultiSelectUi();
                        renderHistoryList();
                    }

                    function toggleHistorySessionSelection(sessionId) {
                        if (!sessionId) {
                            return;
                        }

                        if (selectedSessionIds.has(sessionId)) {
                            selectedSessionIds.delete(sessionId);
                        } else {
                            selectedSessionIds.add(sessionId);
                        }

                        updateMultiSelectUi();
                        renderHistoryList();
                    }

                    function renderHistoryList() {
                        if (!historyList) {
                            return;
                        }

                        cleanupSelectedSessionIds();
                        updateMultiSelectUi();

                        const historySessions = getHistorySessions();
                        if (historySortBtn) {
                            historySortBtn.textContent = historySortValue === 'updated-asc' ? 'Oldest' : 'Newest';
                        }

                        if (historySessions.length === 0) {
                            historyList.innerHTML = '<div class="history-empty">No sessions found.</div>';
                            return;
                        }

                        historyList.innerHTML = historySessions.map(session => {
                            const sessionId = escapeHtml(session && session.id ? session.id : '');
                            const title = escapeHtml(session && session.title ? session.title : 'Untitled');
                            const provider = escapeHtml(getProviderLabel(session && session.provider ? session.provider : 'codex'));
                            const previewSource = String(session && session.previewText ? session.previewText : '').trim();
                            const preview = escapeHtml(previewSource || 'No messages yet.');
                            const messageCount = Math.max(0, Number(session && session.messageCount ? session.messageCount : 0) || 0);
                            const timeLabel = escapeHtml(formatHistoryTime(session && session.updatedAt ? session.updatedAt : 0));
                            const activeClass = session && session.id === activeSessionId ? ' active' : '';
                            const selected = Boolean(session && selectedSessionIds.has(session.id));
                            const checkboxClass = selected ? 'history-item-checkbox checked' : 'history-item-checkbox';
                            const activeIndicator = session && session.id === activeSessionId
                                ? '<div class="history-item-indicator"></div>'
                                : '';

                            return [
                                '<div class="history-item' + activeClass + '" data-session-id="' + sessionId + '">',
                                '  <button class="' + checkboxClass + '" data-history-checkbox="true" data-session-id="' + sessionId + '" title="Select session" aria-label="Select session">',
                                '    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
                                '      <polyline points="3.5 8.5 6.8 11.5 12.5 5"></polyline>',
                                '    </svg>',
                                '  </button>',
                                '  <div class="history-item-title-row">',
                                '    <div class="history-item-title">' + title + '</div>',
                                '    <div class="history-item-meta">',
                                '      <span class="history-item-model">' + provider + '</span>',
                                '      <span class="history-item-count">MSG ' + messageCount + '</span>',
                                '    </div>',
                                '  </div>',
                                '  <div class="history-item-preview">' + preview + '</div>',
                                timeLabel
                                    ? ('  <div class="history-item-time">' + timeLabel + '</div>')
                                    : '',
                                '  <div class="history-item-actions">',
                                '    <button class="history-item-action-btn" data-history-action="rename" data-session-id="' + sessionId + '" title="Rename session">✎</button>',
                                '    <button class="history-item-action-btn" data-history-action="export" data-session-id="' + sessionId + '" title="Export session">⇩</button>',
                                '    <button class="history-item-action-btn" data-history-action="delete" data-session-id="' + sessionId + '" title="Delete session">🗑</button>',
                                '  </div>',
                                activeIndicator,
                                '</div>',
                            ].filter(Boolean).join('');
                        }).join('');
                    }

                    function setHistoryMode(enabled) {
                        historyMode = Boolean(enabled);

                        if (!historyMode) {
                            setMultiSelectMode(false);
                        }

                        document.body.classList.toggle('history-mode', historyMode);

                        if (historyPage) {
                            historyPage.setAttribute('aria-hidden', historyMode ? 'false' : 'true');
                        }

                        if (historyMode) {
                            renderHistoryList();
                        }
                    }

                    function setHomeMode(enabled) {
                        isHomeMode = Boolean(enabled);
                        document.body.classList.toggle('home-mode', isHomeMode);

                        if (isHomeMode) {
                            renderRecentTasks();
                            container.innerHTML = '';
                        }
                    }

                    function renderRecentTasks() {
                        if (!recentTasksList) {
                            return;
                        }

                        const recentSessions = Array.isArray(sessions) ? sessions.slice() : [];
                        recentSessions.sort((left, right) => {
                            const leftUpdated = Number(left && left.updatedAt ? left.updatedAt : 0);
                            const rightUpdated = Number(right && right.updatedAt ? right.updatedAt : 0);
                            return rightUpdated - leftUpdated;
                        });

                        const topSessions = recentSessions.slice(0, 5);

                        if (topSessions.length === 0) {
                            recentTasksList.innerHTML = '<div class="recent-tasks-empty">No recent tasks</div>';
                            return;
                        }

                        recentTasksList.innerHTML = topSessions.map(session => {
                            const sessionId = escapeHtml(session && session.id ? session.id : '');
                            const title = escapeHtml(session && session.title ? session.title : 'Untitled');
                            const provider = escapeHtml(getProviderLabel(session && session.provider ? session.provider : 'codex'));
                            const timeLabel = escapeHtml(formatHistoryTime(session && session.updatedAt ? session.updatedAt : 0));

                            return [
                                '<div class="recent-task-item" data-recent-session-id="' + sessionId + '">',
                                '  <div class="recent-task-info">',
                                '    <div class="recent-task-title">' + title + '</div>',
                                '    <div class="recent-task-meta">',
                                '      <span class="recent-task-provider">' + provider + '</span>',
                                timeLabel ? '      <span class="recent-task-time">' + timeLabel + '</span>' : '',
                                '    </div>',
                                '  </div>',
                                '</div>',
                            ].filter(Boolean).join('');
                        }).join('');
                    }

                    function createSession() {
                        if (isThinking) {
                            return;
                        }

                        closeProviderMenu();
                        setHistoryMode(false);
                        setHomeMode(true);
                    }

                    function handleHistoryAction(action, sessionId) {
                        if (!sessionId) {
                            return;
                        }

                        const session = sessions.find(item => item && item.id === sessionId);
                        if (!session) {
                            return;
                        }

                        if (action === 'rename') {
                            vscode.postMessage({
                                type: 'session-rename-request',
                                value: {
                                    sessionId,
                                    currentTitle: session.title || '',
                                },
                            });
                            return;
                        }

                        if (action === 'export') {
                            vscode.postMessage({
                                type: 'session-export',
                                value: { sessionId },
                            });
                            return;
                        }

                        if (action === 'delete') {
                            vscode.postMessage({
                                type: 'session-delete-request',
                                value: {
                                    sessionId,
                                    title: session.title || '',
                                },
                            });
                        }
                    }

                    function setProvider(provider) {
                        const normalizedProvider = normalizeProvider(provider);
                        currentProvider = normalizedProvider;

                        if (providerSelect) {
                            providerSelect.value = normalizedProvider;
                        }

                        syncProviderSelectUi(normalizedProvider);
                    }

                    function setNewSessionProvider(provider) {
                        const normalizedProvider = normalizeProvider(provider);
                        newSessionProvider = normalizedProvider;
                        if (providerSelect) {
                            providerSelect.value = normalizedProvider;
                        }

                        syncProviderSelectUi(normalizedProvider);
                    }

                    function renderChatMessages(messages) {
                        container.innerHTML = '';
                        loadingDiv = null;
                        activeStreamId = null;
                        activeStreamElements = null;
                        activeStreamState = null;

                        const list = Array.isArray(messages) ? messages : [];
                        list.forEach(entry => {
                            if (!entry || typeof entry !== 'object') {
                                return;
                            }

                            if (entry.role === 'user') {
                                const prompt = String(entry.prompt || '').trim();
                                if (!prompt) {
                                    return;
                                }

                                const attachmentText = Array.isArray(entry.attachments) && entry.attachments.length > 0
                                    ? '\\n\\n📎 ' + entry.attachments.map(item => item && item.name ? item.name : '').filter(Boolean).join(', ')
                                    : '';

                                const div = document.createElement('div');
                                div.className = 'message user';
                                div.innerText = prompt + attachmentText;
                                container.appendChild(div);
                                return;
                            }

                            if (entry.role === 'assistant') {
                                const thought = String(entry.thought || '');
                                const content = String(entry.content || '');
                                if (!thought && !content) {
                                    return;
                                }

                                const div = document.createElement('div');
                                div.className = 'message bot';

                                let html = '';
                                if (thought && thought.length > 5) {
                                    const thinkingHtml = renderThinkingContent(thought);
                                    html += '<details class="thinking-block"><summary>Thinking Process</summary><div class="thinking-content">' + thinkingHtml + '</div></details>';
                                }
                                if (content) {
                                    html += '<div class="answer-block">' + renderMarkdownSafe(content) + '</div>';
                                }

                                div.innerHTML = html;
                                container.appendChild(div);
                                return;
                            }

                            if (entry.role === 'system') {
                                const content = String(entry.content || '').trim();
                                if (!content) {
                                    return;
                                }
                                const div = document.createElement('div');
                                div.className = 'system-msg';
                                div.innerText = content;
                                container.appendChild(div);
                            }
                        });

                        container.scrollTop = container.scrollHeight;
                    }

                    function renderSessionOptions() {
                        if (!sessionSelect) {
                            return;
                        }

                        sessionSelect.innerHTML = sessions.map(session => {
                            const label = escapeHtml((session.title || 'Untitled') + ' · ' + getProviderLabel(session.provider));
                            return '<option value="' + escapeHtml(session.id) + '">' + label + '</option>';
                        }).join('');

                        if (activeSessionId) {
                            sessionSelect.value = activeSessionId;
                        }
                    }

                    function applySessionMeta(session) {
                        const provider = session && session.provider === 'claude'
                            ? 'claude'
                            : (session && session.provider === 'pi' ? 'pi' : 'codex');
                        setProvider(provider);
                    }

                    function addMessage(type, data) {
                        if (loadingDiv) { loadingDiv.remove(); loadingDiv = null; }
                        if (type === 'done') return;

                        if (type === 'stream-start') {
                            if (data && data.sessionId && activeSessionId && data.sessionId !== activeSessionId) {
                                return;
                            }

                            activeStreamId = data.requestId;
                            activeStreamElements = createStreamMessage(data.requestId);
                            activeStreamState = {
                                targetContent: '',
                                displayedContent: '',
                                typingTimer: null,
                                targetThought: '',
                                displayedThought: '',
                                thinkingTimer: null,
                                phase: 'thinking',
                                targetSegments: [],
                            };
                            activeStreamElements.thinkingContent.innerHTML = renderStreamPlaceholder('Waiting for first output');
                            setThinkingState(true);
                            return;
                        }

                        if (type === 'stream-update') {
                            if (data && data.sessionId && activeSessionId && data.sessionId !== activeSessionId) {
                                return;
                            }
                            renderStreamUpdate(data);
                            return;
                        }

                        if (type === 'stream-end') {
                            if (data && data.sessionId && activeSessionId && data.sessionId !== activeSessionId) {
                                return;
                            }

                            if (activeStreamId === data.requestId && activeStreamElements) {
                                if (activeStreamState?.typingTimer) {
                                    clearTimeout(activeStreamState.typingTimer);
                                    activeStreamState.typingTimer = null;
                                }
                                if (activeStreamState?.thinkingTimer) {
                                    clearTimeout(activeStreamState.thinkingTimer);
                                    activeStreamState.thinkingTimer = null;
                                }

                                if (data.finished && activeStreamState?.targetThought) {
                                    activeStreamState.displayedThought = activeStreamState.targetThought;
                                    activeStreamElements.thinkingContent.innerHTML = renderThinkingContent(
                                        activeStreamState.targetThought,
                                        activeStreamState.targetSegments || [],
                                    );
                                }

                                if (data.finished && activeStreamState?.targetContent) {
                                    activeStreamState.displayedContent = activeStreamState.targetContent;
                                    activeStreamElements.answerBlock.style.display = '';
                                    activeStreamElements.answerBlock.innerHTML = renderMarkdownSafe(activeStreamState.targetContent);
                                }

                                if (data.canceled) {
                                    activeStreamElements.details.open = false;
                                    if (activeStreamElements.answerBlock.style.display === 'none') {
                                        activeStreamElements.answerBlock.style.display = '';
                                        activeStreamElements.answerBlock.innerHTML = renderMarkdownSafe('Request canceled.');
                                    }
                                }
                                if (data.timedOut && activeStreamElements.answerBlock.style.display === 'none') {
                                    activeStreamElements.answerBlock.style.display = '';
                                    activeStreamElements.answerBlock.innerHTML = renderMarkdownSafe('Request timed out.');
                                    activeStreamElements.details.open = false;
                                }
                                if (data.error && activeStreamElements.answerBlock.style.display === 'none') {
                                    activeStreamElements.answerBlock.style.display = '';
                                    activeStreamElements.answerBlock.innerHTML = renderMarkdownSafe(String(data.error));
                                    activeStreamElements.details.open = false;
                                }
                            }
                            if (activeStreamId === data.requestId) {
                                activeStreamId = null;
                                activeStreamElements = null;
                                activeStreamState = null;
                                setThinkingState(false);
                            }
                            return;
                        }

                        if (type === 'system') {
                            loadingDiv = document.createElement('div');
                            loadingDiv.className = 'system-msg';
                            loadingDiv.innerText = data;
                            container.appendChild(loadingDiv);
                            return;
                        }

                        if (type === 'session-error') {
                            const text = data && data.message ? String(data.message) : 'Session operation failed.';
                            showHintMessage(text, 3000);
                            return;
                        }

                        const div = document.createElement('div');

                        if (type === 'user') {
                            div.className = 'message user';
                            div.innerText = data;
                        }
                        else if (type === 'bot-complex') {
                            div.className = 'message bot';

                            let html = '';

                            if (data.thought && data.thought.length > 5) {
                                const thinkingHtml = renderThinkingContent(data.thought);
                                html += '<details class="thinking-block"><summary>Thinking Process</summary><div class="thinking-content">' + thinkingHtml + '</div></details>';
                            }

                            html += '<div class="answer-block">' + renderMarkdownSafe(data.content) + '</div>';

                            div.innerHTML = html;
                        }
                        else if (type === 'bot') {
                            div.className = 'message bot';
                            div.innerHTML = '<div class="answer-block">' + renderMarkdownSafe(data) + '</div>';
                        }
                        else {
                            div.className = 'error-msg';
                            div.innerText = data;
                        }

                        container.appendChild(div);
                        container.scrollTop = container.scrollHeight;
                    }

                    ${INPUT_EVENTS_SCRIPT}

                    if (sessionSelect) {
                        sessionSelect.addEventListener('change', () => {
                            if (isThinking) {
                                return;
                            }
                            const sessionId = sessionSelect.value;
                            if (!sessionId) {
                                return;
                            }
                            vscode.postMessage({ type: 'session-switch' , value: { sessionId } });
                        });
                    }

                    if (sessionNewBtn) {
                        sessionNewBtn.addEventListener('click', () => {
                            createSession();
                        });
                    }

                    if (addSessionBtn) {
                        addSessionBtn.addEventListener('click', () => {
                            createSession();
                        });
                    }

                    if (sessionViewAllBtn) {
                        sessionViewAllBtn.addEventListener('click', () => {
                            if (isThinking) {
                                return;
                            }

                            closeProviderMenu();
                            setHistoryMode(true);
                        });
                    }

                    if (historyBackBtn) {
                        historyBackBtn.addEventListener('click', () => {
                            setHistoryMode(false);
                        });
                    }

                    if (historySearchInput) {
                        historySearchInput.addEventListener('input', () => {
                            historySearchText = historySearchInput.value || '';
                            renderHistoryList();
                        });
                    }

                    if (historySortBtn) {
                        historySortBtn.addEventListener('click', () => {
                            historySortValue = historySortValue === 'updated-desc'
                                ? 'updated-asc'
                                : 'updated-desc';
                            renderHistoryList();
                        });
                    }

                    if (historyMultiSelectBtn) {
                        historyMultiSelectBtn.addEventListener('click', () => {
                            setMultiSelectMode(!isMultiSelectMode);
                        });
                    }

                    if (historyMultiCancelBtn) {
                        historyMultiCancelBtn.addEventListener('click', () => {
                            setMultiSelectMode(false);
                        });
                    }

                    if (historyMultiDeleteBtn) {
                        historyMultiDeleteBtn.addEventListener('click', () => {
                            if (selectedSessionIds.size === 0) {
                                return;
                            }

                            vscode.postMessage({
                                type: 'session-multi-delete',
                                value: { sessionIds: Array.from(selectedSessionIds) },
                            });
                            setMultiSelectMode(false);
                        });
                    }

                    if (historyMultiExportBtn) {
                        historyMultiExportBtn.addEventListener('click', () => {
                            if (selectedSessionIds.size === 0) {
                                return;
                            }

                            vscode.postMessage({
                                type: 'session-multi-export',
                                value: { sessionIds: Array.from(selectedSessionIds) },
                            });
                            setMultiSelectMode(false);
                        });
                    }

                    if (historyList) {
                        historyList.addEventListener('click', event => {
                            const target = event.target;
                            if (!target || !(target instanceof Element)) {
                                return;
                            }

                            const checkbox = target.closest('[data-history-checkbox]');
                            if (checkbox) {
                                event.stopPropagation();
                                if (!isMultiSelectMode) {
                                    setMultiSelectMode(true);
                                }
                                const checkboxSessionId = checkbox.getAttribute('data-session-id') || '';
                                toggleHistorySessionSelection(checkboxSessionId);
                                return;
                            }

                            const actionButton = target.closest('[data-history-action]');
                            if (actionButton) {
                                event.stopPropagation();
                                const action = actionButton.getAttribute('data-history-action') || '';
                                const actionSessionId = actionButton.getAttribute('data-session-id') || '';
                                handleHistoryAction(action, actionSessionId);
                                return;
                            }

                            const item = target.closest('[data-session-id]');
                            if (!item || isThinking) {
                                return;
                            }

                            const sessionId = item.getAttribute('data-session-id') || '';
                            if (!sessionId) {
                                return;
                            }

                            if (isMultiSelectMode) {
                                toggleHistorySessionSelection(sessionId);
                                return;
                            }

                            if (sessionId !== activeSessionId) {
                                vscode.postMessage({ type: 'session-switch', value: { sessionId } });
                            }
                            setHistoryMode(false);
                        });
                    }

                    if (providerSelectTrigger) {
                        providerSelectTrigger.addEventListener('click', event => {
                            event.preventDefault();
                            toggleProviderMenu();
                        });
                    }

                    providerSelectOptions.forEach(option => {
                        option.addEventListener('click', event => {
                            event.preventDefault();
                            event.stopPropagation();

                            if (!providerSelect) {
                                return;
                            }

                            const nextProvider = normalizeProvider(option.getAttribute('data-provider-option'));
                            providerSelect.value = nextProvider;
                            providerSelect.dispatchEvent(new Event('change'));
                            closeProviderMenu();
                        });
                    });

                    if (providerSelect) {
                        providerSelect.addEventListener('change', () => {
                            const nextProvider = normalizeProvider(providerSelect.value);
                            setNewSessionProvider(nextProvider);

                            if (activeSessionId && currentProvider !== nextProvider) {
                                vscode.postMessage({
                                    type: 'session-provider-update',
                                    value: { sessionId: activeSessionId, provider: nextProvider },
                                });
                            }
                        });
                    }

                    if (sessionRenameBtn) {
                        sessionRenameBtn.addEventListener('click', () => {
                            if (isThinking || !activeSessionId) {
                                return;
                            }

                            const current = sessions.find(item => item.id === activeSessionId);
                            const currentTitle = current && current.title ? String(current.title) : '';
                            const nextTitle = window.prompt('Rename session', currentTitle);
                            if (nextTitle === null) {
                                return;
                            }
                            const title = nextTitle.trim();
                            if (!title) {
                                showHintMessage('Session title cannot be empty', 2200);
                                return;
                            }

                            vscode.postMessage({
                                type: 'session-rename',
                                value: { sessionId: activeSessionId, title },
                            });
                        });
                    }

                    if (sessionDeleteBtn) {
                        sessionDeleteBtn.addEventListener('click', () => {
                            if (isThinking || !activeSessionId) {
                                return;
                            }

                            const current = sessions.find(item => item.id === activeSessionId);
                            const title = current && current.title ? String(current.title) : 'this session';
                            const confirmed = window.confirm('Delete session "' + title + '"?');
                            if (!confirmed) {
                                return;
                            }

                            vscode.postMessage({
                                type: 'session-delete',
                                value: { sessionId: activeSessionId },
                            });
                        });
                    }

                    if (addBtn) {
                        addBtn.addEventListener('click', () => {
                            if (isThinking) {
                                return;
                            }
                            vscode.postMessage({ type: 'pickAttachments' });
                        });
                    }

                    document.addEventListener('click', event => {
                        if (!providerSelectWrap || !providerSelectWrap.classList.contains('open')) {
                            return;
                        }

                        const target = event.target;
                        if (target instanceof Element && providerSelectWrap.contains(target)) {
                            return;
                        }

                        closeProviderMenu();
                    });

                    window.addEventListener('resize', () => {
                        if (!providerSelectWrap || !providerSelectWrap.classList.contains('open')) {
                            return;
                        }

                        openProviderMenu();
                    });

                    document.addEventListener('keydown', event => {
                        if (event.key === 'Escape') {
                            closeProviderMenu();
                        }
                    });

                    window.addEventListener('message', event => {
                        const msg = event.data;
                        if (msg.type === 'provider-init') {
                            const provider = msg.value && msg.value.provider === 'claude'
                                ? 'claude'
                                : (msg.value && msg.value.provider === 'pi' ? 'pi' : 'codex');
                            setProvider(provider);
                            setNewSessionProvider(provider);
                            return;
                        }

                        if (msg.type === 'session-list') {
                            const value = msg.value || {};
                            sessions = Array.isArray(value.sessions) ? value.sessions : [];
                            activeSessionId = typeof value.activeSessionId === 'string' ? value.activeSessionId : '';
                            renderSessionOptions();
                            renderHistoryList();
                            if (isHomeMode) {
                                renderRecentTasks();
                            }
                            return;
                        }

                        if (msg.type === 'session-active') {
                            const value = msg.value || {};
                            const session = value.session || null;
                            if (!session) {
                                activeSessionId = '';
                                sessionMessages = [];
                                renderSessionOptions();
                                renderChatMessages([]);
                                return;
                            }

                            activeSessionId = session.id;
                            sessionMessages = Array.isArray(session.messages) ? session.messages : [];
                            applySessionMeta(session);
                            setNewSessionProvider(session.provider);
                            renderSessionOptions();
                            renderHistoryList();
                            renderChatMessages(sessionMessages);
                            selectedAttachments = [];
                            renderAttachments();
                            setHomeMode(false);
                            return;
                        }

                        if (msg.type === 'attachments-update') {
                            const attachments = msg.value && Array.isArray(msg.value.attachments)
                                ? msg.value.attachments
                                : [];
                            const mergeResult = mergeAttachments(attachments);
                            renderAttachments();
                            if (mergeResult.hiddenByLimit > 0) {
                                showHintMessage('Only first 8 attachments kept', 2500);
                            }
                            return;
                        }

                        addMessage(msg.type, msg.value);
                    });

                    vscode.postMessage({ type: 'session-list-request' });
`;
