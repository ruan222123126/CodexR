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

                    // Settings select dropdown functions
                    function closeAllSettingsSelects() {
                        document.querySelectorAll('.settings-select-wrap.open').forEach(wrap => {
                            wrap.classList.remove('open');
                            wrap.classList.remove('open-up');
                            const trigger = wrap.querySelector('.settings-select-trigger');
                            if (trigger) {
                                trigger.setAttribute('aria-expanded', 'false');
                            }
                        });
                    }

                    function toggleSettingsSelect(wrapId) {
                        const wrap = document.getElementById(wrapId);
                        if (!wrap) {
                            return;
                        }

                        const isOpen = wrap.classList.contains('open');
                        closeAllSettingsSelects();

                        if (isOpen) {
                            return;
                        }

                        const trigger = wrap.querySelector('.settings-select-trigger');
                        const menu = wrap.querySelector('.settings-select-menu');
                        if (!trigger || !menu) {
                            return;
                        }

                        const triggerRect = trigger.getBoundingClientRect();
                        const estimatedHeight = Math.max(180, menu.scrollHeight || 0);
                        const spaceBelow = window.innerHeight - triggerRect.bottom;

                        wrap.classList.toggle('open-up', spaceBelow < estimatedHeight);
                        wrap.classList.add('open');
                        trigger.setAttribute('aria-expanded', 'true');
                    }

                    function updateSettingsSelectDisplay(selectId, value, labelText) {
                        const label = document.getElementById(selectId + '-label');
                        const menu = document.getElementById(selectId + '-menu');
                        if (label && labelText) {
                            label.textContent = labelText;
                        }
                        if (menu) {
                            menu.querySelectorAll('.settings-select-option').forEach(option => {
                                const optionValue = option.getAttribute('data-settings-option');
                                const selected = optionValue === value;
                                option.setAttribute('data-selected', selected ? 'true' : 'false');
                                option.setAttribute('aria-selected', selected ? 'true' : 'false');
                            });
                        }
                    }

                    function formatHistoryTime(timestamp) {
                        const value = Number(timestamp);
                        if (!Number.isFinite(value) || value <= 0) {
                            return '';
                        }

                        const deltaMs = Math.max(0, Date.now() - value);
                        if (deltaMs < 60 * 1000) {
                            return t('history.justNow');
                        }

                        if (deltaMs < 60 * 60 * 1000) {
                            return Math.floor(deltaMs / (60 * 1000)) + t('history.minAgo');
                        }

                        if (deltaMs < 24 * 60 * 60 * 1000) {
                            return Math.floor(deltaMs / (60 * 60 * 1000)) + t('history.hAgo');
                        }

                        if (deltaMs < 30 * 24 * 60 * 60 * 1000) {
                            return Math.floor(deltaMs / (24 * 60 * 60 * 1000)) + t('history.dAgo');
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
                            historyMultiSelectBtn.title = isMultiSelectMode ? t('history.exitMultiSelect') : t('history.multiSelect');
                            historyMultiSelectBtn.style.display = isMultiSelectMode ? 'none' : 'inline-flex';
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
                            historySortBtn.textContent = historySortValue === 'updated-asc' ? t('history.sortOldest') : t('history.sortNewest');
                        }

                        if (historySessions.length === 0) {
                            historyList.innerHTML = '<div class="history-empty">' + t('history.noSessions') + '</div>';
                            return;
                        }

                        historyList.innerHTML = historySessions.map(session => {
                            const sessionId = escapeHtml(session && session.id ? session.id : '');
                            const title = escapeHtml(session && session.title ? session.title : t('history.untitled'));
                            const provider = escapeHtml(getProviderLabel(session && session.provider ? session.provider : 'codex'));
                            const previewSource = String(session && session.previewText ? session.previewText : '').trim();
                            const preview = escapeHtml(previewSource || t('history.noMessages'));
                            const workspacePath = session && session.workspacePath ? session.workspacePath : '';
                            const folderName = workspacePath ? workspacePath.split(/[\\/]/).pop() || workspacePath : '';
                            const timeLabel = escapeHtml(formatHistoryTime(session && session.updatedAt ? session.updatedAt : 0));
                            const activeClass = session && session.id === activeSessionId ? ' active' : '';
                            const selected = Boolean(session && selectedSessionIds.has(session.id));
                            const checkboxClass = selected ? 'history-item-checkbox checked' : 'history-item-checkbox';
                            const activeIndicator = session && session.id === activeSessionId
                                ? '<div class="history-item-indicator"></div>'
                                : '';

                            return [
                                '<div class="history-item' + activeClass + '" data-session-id="' + sessionId + '">',
                                '  <button class="' + checkboxClass + '" data-history-checkbox="true" data-session-id="' + sessionId + '" title="' + t('history.selectSession') + '" aria-label="' + t('history.selectSession') + '">',
                                '    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
                                '      <polyline points="3.5 8.5 6.8 11.5 12.5 5"></polyline>',
                                '    </svg>',
                                '  </button>',
                                '  <div class="history-item-title-row">',
                                '    <div class="history-item-title">' + title + '</div>',
                                '    <span class="history-item-model">' + provider + '</span>',
                                '  </div>',
                                '  <div class="history-item-preview">' + preview + '</div>',
                                '  <div class="history-item-footer">',
                                folderName
                                    ? '    <div class="history-item-folder" title="' + escapeHtml(workspacePath) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>' + escapeHtml(folderName) + '</div>'
                                    : '',
                                timeLabel
                                    ? '    <div class="history-item-time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' + timeLabel + '</div>'
                                    : '',
                                '  </div>',
                                '  <div class="history-item-actions">',
                                '    <button class="history-item-action-btn" data-history-action="rename" data-session-id="' + sessionId + '" title="' + t('history.renameSession') + '">✎</button>',
                                '    <button class="history-item-action-btn" data-history-action="export" data-session-id="' + sessionId + '" title="' + t('history.exportSession') + '">⇩</button>',
                                '    <button class="history-item-action-btn" data-history-action="delete" data-session-id="' + sessionId + '" title="' + t('history.deleteSession') + '">🗑</button>',
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

                        if (historyMode) {
                            setSettingsMode(false);
                        }

                        document.body.classList.toggle('history-mode', historyMode);

                        if (historyPage) {
                            historyPage.setAttribute('aria-hidden', historyMode ? 'false' : 'true');
                        }

                        if (historyMode) {
                            renderHistoryList();
                        }
                    }

                    function setSettingsMode(enabled) {
                        settingsMode = Boolean(enabled);

                        if (settingsMode) {
                            setHistoryMode(false);
                        }

                        document.body.classList.toggle('settings-mode', settingsMode);

                        if (settingsPage) {
                            settingsPage.setAttribute('aria-hidden', settingsMode ? 'false' : 'true');
                        }

                        if (settingsMode) {
                            vscode.postMessage({ type: 'settings-request' });
                        }
                    }

                    function updateSettingsUi(settings) {
                        if (settingsLanguage && settings.language) {
                            settingsLanguage.value = settings.language;
                            const langLabels = { en: 'English', 'zh-CN': '简体中文' };
                            updateSettingsSelectDisplay('settings-language', settings.language, langLabels[settings.language] || settings.language);
                        }
                        if (settingsShowToolIndicator) {
                            settingsShowToolIndicator.checked = settings.showToolUsageIndicator !== false;
                        }
                        if (settingsThinkingFilter) {
                            settingsThinkingFilter.checked = settings.codexThinkingNoiseFilterEnabled !== false;
                        }
                        if (settingsCodexHideThinking) {
                            settingsCodexHideThinking.checked = settings.codexHideThinking === true;
                        }
                        if (settingsClaudeDisableThinking) {
                            settingsClaudeDisableThinking.checked = settings.claudeDisableThinking === true;
                        }
                        if (settingsPiDisableThinking) {
                            settingsPiDisableThinking.checked = settings.piDisableThinking === true;
                        }
                        if (settingsCodexAutoResume) {
                            settingsCodexAutoResume.checked = settings.codexAutoResumeSession !== false;
                        }
                        if (settingsClaudeAutoResume) {
                            settingsClaudeAutoResume.checked = settings.claudeAutoResumeSession !== false;
                        }
                        if (settingsPiAutoResume) {
                            settingsPiAutoResume.checked = settings.piAutoResumeSession !== false;
                        }
                        if (settingsTitleMode && settings.titleGenerationMode) {
                            settingsTitleMode.value = settings.titleGenerationMode;
                            const titleModeLabels = {
                                currentProvider: t('settings.titleModeCurrentProvider'),
                                fixedProvider: t('settings.titleModeFixedProvider'),
                                firstMessage: t('settings.titleModeFirstMessage')
                            };
                            updateSettingsSelectDisplay('settings-title-mode', settings.titleGenerationMode, titleModeLabels[settings.titleGenerationMode] || settings.titleGenerationMode);
                        }
                        if (settingsTitleFixedProvider && settings.titleFixedProvider) {
                            settingsTitleFixedProvider.value = settings.titleFixedProvider;
                            const providerLabels = { codex: 'Codex', claude: 'Claude', pi: 'Pi' };
                            updateSettingsSelectDisplay('settings-title-fixed-provider', settings.titleFixedProvider, providerLabels[settings.titleFixedProvider] || settings.titleFixedProvider);
                        }
                        if (settingsTitleFixedProviderItem) {
                            settingsTitleFixedProviderItem.style.display = settings.titleGenerationMode === 'fixedProvider' ? 'flex' : 'none';
                        }
                        // Pi configuration settings
                        if (settingsPiModel && settings.piModel !== undefined) {
                            settingsPiModel.value = settings.piModel;
                        }
                        if (settingsPiApiKey && settings.piApiKey !== undefined) {
                            settingsPiApiKey.value = settings.piApiKey;
                        }
                        if (settingsPiThinkingLevel && settings.piThinkingLevel) {
                            settingsPiThinkingLevel.value = settings.piThinkingLevel;
                            const thinkingLevelLabels = {
                                default: t('settings.piThinkingLevelDefault'),
                                off: 'Off',
                                minimal: 'Minimal',
                                low: 'Low',
                                medium: 'Medium',
                                high: 'High',
                                xhigh: 'XHigh'
                            };
                            updateSettingsSelectDisplay('settings-pi-thinking-level', settings.piThinkingLevel, thinkingLevelLabels[settings.piThinkingLevel] || settings.piThinkingLevel);
                        }
                        // Codex configuration settings
                        if (settingsCodexModel && settings.codexModel !== undefined) {
                            settingsCodexModel.value = settings.codexModel;
                        }
                        if (settingsCodexConfigOverrides && settings.codexConfigOverrides !== undefined) {
                            settingsCodexConfigOverrides.value = settings.codexConfigOverrides;
                        }
                        if (settingsCodexProfile && settings.codexProfile !== undefined) {
                            settingsCodexProfile.value = settings.codexProfile;
                        }
                        if (settingsCodexOss) {
                            settingsCodexOss.checked = settings.codexOss === true;
                        }
                        if (settingsCodexSandboxMode && settings.codexSandboxMode) {
                            settingsCodexSandboxMode.value = settings.codexSandboxMode;
                            const sandboxModeLabels = {
                                'default': t('settings.codexSandboxModeDefault'),
                                'read-only': t('settings.codexSandboxModeReadOnly'),
                                'workspace-write': t('settings.codexSandboxModeWorkspaceWrite'),
                                'danger-full-access': t('settings.codexSandboxModeDangerFullAccess')
                            };
                            updateSettingsSelectDisplay('settings-codex-sandbox-mode', settings.codexSandboxMode, sandboxModeLabels[settings.codexSandboxMode] || settings.codexSandboxMode);
                        }
                        if (settingsCodexApprovalPolicy && settings.codexApprovalPolicy) {
                            settingsCodexApprovalPolicy.value = settings.codexApprovalPolicy;
                            const approvalPolicyLabels = {
                                'default': t('settings.codexApprovalPolicyDefault'),
                                'untrusted': t('settings.codexApprovalPolicyUntrusted'),
                                'on-failure': t('settings.codexApprovalPolicyOnFailure'),
                                'never': t('settings.codexApprovalPolicyNever')
                            };
                            updateSettingsSelectDisplay('settings-codex-approval-policy', settings.codexApprovalPolicy, approvalPolicyLabels[settings.codexApprovalPolicy] || settings.codexApprovalPolicy);
                        }
                        if (settingsCodexFullAuto) {
                            settingsCodexFullAuto.checked = settings.codexFullAuto === true;
                        }
                        // Claude configuration settings
                        if (settingsClaudeModel && settings.claudeModel !== undefined) {
                            settingsClaudeModel.value = settings.claudeModel;
                        }
                        if (settingsClaudeAgent && settings.claudeAgent !== undefined) {
                            settingsClaudeAgent.value = settings.claudeAgent;
                        }
                        if (settingsClaudeTools && settings.claudeTools !== undefined) {
                            settingsClaudeTools.value = settings.claudeTools;
                        }
                        if (settingsClaudePermissionMode && settings.claudePermissionMode) {
                            settingsClaudePermissionMode.value = settings.claudePermissionMode;
                            const permissionModeLabels = {
                                dangerouslySkip: t('settings.claudePermissionModeDangerouslySkip'),
                                allowDangerouslySkip: t('settings.claudePermissionModeAllowDangerouslySkip'),
                                default: t('settings.claudePermissionModeDefault')
                            };
                            updateSettingsSelectDisplay('settings-claude-permission-mode', settings.claudePermissionMode, permissionModeLabels[settings.claudePermissionMode] || settings.claudePermissionMode);
                        }
                        // Step detail level setting
                        if (settingsStepDetailLevel && settings.stepDetailLevel) {
                            settingsStepDetailLevel.value = settings.stepDetailLevel;
                            stepDetailLevel = settings.stepDetailLevel;
                            const stepDetailLevelLabels = {
                                compact: t('settings.stepDetailLevelCompact'),
                                full: t('settings.stepDetailLevelFull')
                            };
                            updateSettingsSelectDisplay('settings-step-detail-level', settings.stepDetailLevel, stepDetailLevelLabels[settings.stepDetailLevel] || settings.stepDetailLevel);
                        }
                    }

                    function t(key) {
                        return translations[key] || key;
                    }

                    function applyTranslations(newTranslations) {
                        translations = newTranslations || translations;

                        document.querySelectorAll('[data-i18n]').forEach(el => {
                            const key = el.getAttribute('data-i18n');
                            if (key && translations[key]) {
                                el.textContent = translations[key];
                            }
                        });

                        document.querySelectorAll('[data-i18n-title]').forEach(el => {
                            const key = el.getAttribute('data-i18n-title');
                            if (key && translations[key]) {
                                el.setAttribute('title', translations[key]);
                            }
                        });

                        document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
                            const key = el.getAttribute('data-i18n-aria-label');
                            if (key && translations[key]) {
                                el.setAttribute('aria-label', translations[key]);
                            }
                        });

                        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                            const key = el.getAttribute('data-i18n-placeholder');
                            if (key && translations[key]) {
                                el.setAttribute('placeholder', translations[key]);
                            }
                        });

                        if (!isThinking && statusText) {
                            statusText.innerHTML = '<span class="status-dot"></span> ' + t('status.ready');
                        }

                        if (recentTasksToggleBtn) {
                            const toggleTitleKey = recentTasksCollapsed
                                ? 'input.expandRecentTasks'
                                : 'input.collapseRecentTasks';
                            const toggleTitle = t(toggleTitleKey);
                            recentTasksToggleBtn.setAttribute('title', toggleTitle);
                            recentTasksToggleBtn.setAttribute('aria-label', toggleTitle);
                        }
                    }

                    function updateRecentTasksCollapsedState() {
                        if (!recentTasksPanel) {
                            return;
                        }

                        recentTasksPanel.classList.toggle('collapsed', recentTasksCollapsed);

                        if (recentTasksToggleBtn) {
                            recentTasksToggleBtn.setAttribute('aria-expanded', recentTasksCollapsed ? 'false' : 'true');
                            const toggleTitleKey = recentTasksCollapsed
                                ? 'input.expandRecentTasks'
                                : 'input.collapseRecentTasks';
                            const toggleTitle = t(toggleTitleKey);
                            recentTasksToggleBtn.setAttribute('title', toggleTitle);
                            recentTasksToggleBtn.setAttribute('aria-label', toggleTitle);

                        }
                    }

                    function toggleRecentTasksCollapsed() {
                        recentTasksCollapsed = !recentTasksCollapsed;
                        updateRecentTasksCollapsedState();
                    }

                    function setHomeMode(enabled) {
                        isHomeMode = Boolean(enabled);
                        document.body.classList.toggle('home-mode', isHomeMode);

                        if (isHomeMode) {
                            renderRecentTasks();
                            container.innerHTML = '';
                            if (toolbarTitle) {
                                toolbarTitle.textContent = HOME_TITLE;
                            }
                            resetTokenCounter();
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
                            recentTasksList.innerHTML = '<div class="recent-tasks-empty">' + t('input.noRecentTasks') + '</div>';
                            return;
                        }

                        recentTasksList.innerHTML = topSessions.map(session => {
                            const sessionId = escapeHtml(session && session.id ? session.id : '');
                            const title = escapeHtml(session && session.title ? session.title : t('history.untitled'));
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

                    function openStatusModal() {
                        if (statusModal) {
                            statusModal.setAttribute('aria-hidden', 'false');
                            requestStatusUpdate();
                        }
                    }

                    function closeStatusModal() {
                        if (statusModal) {
                            statusModal.setAttribute('aria-hidden', 'true');
                        }
                    }

                    function setAllStatusIndicatorsLoading() {
                        if (claudeStatusIndicator) {
                            claudeStatusIndicator.className = 'status-indicator loading';
                        }
                        if (codexStatusIndicator) {
                            codexStatusIndicator.className = 'status-indicator loading';
                        }
                        if (piStatusIndicator) {
                            piStatusIndicator.className = 'status-indicator loading';
                        }
                        if (claudeMcpList) {
                            claudeMcpList.innerHTML = '<div class="status-empty">' + t('status.loading') + '</div>';
                        }
                        if (codexMcpList) {
                            codexMcpList.innerHTML = '<div class="status-empty">' + t('status.loading') + '</div>';
                        }
                        if (piExtList) {
                            piExtList.innerHTML = '<div class="status-empty">' + t('status.loading') + '</div>';
                        }
                    }

                    function requestStatusUpdate() {
                        setAllStatusIndicatorsLoading();
                        vscode.postMessage({ type: 'status-request' });
                    }

                    function renderStatusResponse(statuses) {
                        if (!Array.isArray(statuses)) {
                            return;
                        }

                        for (const status of statuses) {
                            if (!status || !status.provider) {
                                continue;
                            }

                            let listEl = null;
                            let indicator = null;

                            if (status.provider === 'claude') {
                                listEl = claudeMcpList;
                                indicator = claudeStatusIndicator;
                            } else if (status.provider === 'codex') {
                                listEl = codexMcpList;
                                indicator = codexStatusIndicator;
                            } else if (status.provider === 'pi') {
                                listEl = piExtList;
                                indicator = piStatusIndicator;
                            }

                            if (indicator) {
                                indicator.className = 'status-indicator ' + (status.status || 'empty');
                            }

                            if (listEl) {
                                if (status.error) {
                                    listEl.innerHTML = '<div class="status-error">' + escapeHtml(status.error) + '</div>';
                                } else if (!status.items || status.items.length === 0) {
                                    listEl.innerHTML = '<div class="status-empty">' + t('status.noItems') + '</div>';
                                } else {
                                    listEl.innerHTML = status.items
                                        .map(function(item) { return '<div class="status-item">' + escapeHtml(item) + '</div>'; })
                                        .join('');
                                }
                            }
                        }
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

                                const wrapper = document.createElement('div');
                                wrapper.className = 'user-message-wrapper';

                                const actionsDiv = document.createElement('div');
                                actionsDiv.className = 'message-actions user-actions';
                                actionsDiv.innerHTML = '<button class="copy-btn" data-copy-text="' + escapeHtml(prompt) + '" title="' + t('message.copy') + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M9 18q-.825 0-1.412-.587T7 16V4q0-.825.588-1.412T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.587 1.413T18 18zm-4 4q-.825 0-1.412-.587T3 20V6h2v14h11v2z"/></svg></button>';
                                wrapper.appendChild(actionsDiv);

                                const div = document.createElement('div');
                                div.className = 'message user';
                                div.innerText = prompt + attachmentText;
                                wrapper.appendChild(div);

                                container.appendChild(wrapper);
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
                                    html += '<details class="thinking-block"><summary>' + t('message.thinkingProcess') + '</summary><div class="thinking-content">' + thinkingHtml + '</div></details>';
                                }
                                if (content) {
                                    html += '<div class="answer-block">' + renderMarkdownSafe(content) + '</div>';
                                }
                                html += '<div class="message-actions"><button class="copy-btn" data-copy-text="' + escapeHtml(content || thought) + '" title="' + t('message.copy') + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M9 18q-.825 0-1.412-.587T7 16V4q0-.825.588-1.412T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.587 1.413T18 18zm-4 4q-.825 0-1.412-.587T3 20V6h2v14h11v2z"/></svg></button></div>';

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
                            activeStreamElements.thinkingContent.innerHTML = renderStreamPlaceholder(t('message.waitingForOutput'));
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
                                        activeStreamElements.answerBlock.innerHTML = renderMarkdownSafe(t('message.requestCanceled'));
                                    }
                                }
                                if (data.timedOut && activeStreamElements.answerBlock.style.display === 'none') {
                                    activeStreamElements.answerBlock.style.display = '';
                                    activeStreamElements.answerBlock.innerHTML = renderMarkdownSafe(t('message.requestTimedOut'));
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
                            const text = data && data.message ? String(data.message) : t('message.sessionOperationFailed');
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
                                html += '<details class="thinking-block"><summary>' + t('message.thinkingProcess') + '</summary><div class="thinking-content">' + thinkingHtml + '</div></details>';
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

                    if (recentTasksToggleBtn) {
                        recentTasksToggleBtn.addEventListener('click', event => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleRecentTasksCollapsed();
                        });
                    }

                    if (historyBackBtn) {
                        historyBackBtn.addEventListener('click', () => {
                            setHistoryMode(false);
                        });
                    }

                    if (settingsBtn) {
                        settingsBtn.addEventListener('click', () => {
                            setSettingsMode(true);
                        });
                    }

                    if (statusBtn) {
                        statusBtn.addEventListener('click', () => {
                            openStatusModal();
                        });
                    }

                    if (statusModalClose) {
                        statusModalClose.addEventListener('click', () => {
                            closeStatusModal();
                        });
                    }

                    if (statusModalRefresh) {
                        statusModalRefresh.addEventListener('click', () => {
                            requestStatusUpdate();
                        });
                    }

                    if (statusModal) {
                        const backdrop = statusModal.querySelector('.status-modal-backdrop');
                        if (backdrop) {
                            backdrop.addEventListener('click', () => {
                                closeStatusModal();
                            });
                        }
                    }

                    if (settingsBackBtn) {
                        settingsBackBtn.addEventListener('click', () => {
                            setSettingsMode(false);
                        });
                    }

                    // Settings select trigger click handlers
                    if (settingsLanguageTrigger) {
                        settingsLanguageTrigger.addEventListener('click', event => {
                            event.preventDefault();
                            toggleSettingsSelect('settings-language-wrap');
                        });
                    }

                    if (settingsTitleModeTrigger) {
                        settingsTitleModeTrigger.addEventListener('click', event => {
                            event.preventDefault();
                            toggleSettingsSelect('settings-title-mode-wrap');
                        });
                    }

                    if (settingsTitleFixedProviderTrigger) {
                        settingsTitleFixedProviderTrigger.addEventListener('click', event => {
                            event.preventDefault();
                            toggleSettingsSelect('settings-title-fixed-provider-wrap');
                        });
                    }

                    // Settings select option click handlers
                    document.querySelectorAll('.settings-select-option').forEach(option => {
                        option.addEventListener('click', event => {
                            event.preventDefault();
                            event.stopPropagation();

                            const selectType = option.getAttribute('data-settings-select');
                            const value = option.getAttribute('data-settings-option');
                            if (!selectType || !value) {
                                return;
                            }

                            let nativeSelect = null;
                            let labelText = '';
                            let settingsKey = '';

                            if (selectType === 'language') {
                                nativeSelect = settingsLanguage;
                                settingsKey = 'language';
                                const langLabels = { en: 'English', 'zh-CN': '简体中文' };
                                labelText = langLabels[value] || value;
                            } else if (selectType === 'title-mode') {
                                nativeSelect = settingsTitleMode;
                                settingsKey = 'titleGenerationMode';
                                const titleModeLabels = {
                                    currentProvider: t('settings.titleModeCurrentProvider'),
                                    fixedProvider: t('settings.titleModeFixedProvider'),
                                    firstMessage: t('settings.titleModeFirstMessage')
                                };
                                labelText = titleModeLabels[value] || value;
                            } else if (selectType === 'title-fixed-provider') {
                                nativeSelect = settingsTitleFixedProvider;
                                settingsKey = 'titleFixedProvider';
                                const providerLabels = { codex: 'Codex', claude: 'Claude', pi: 'Pi' };
                                labelText = providerLabels[value] || value;
                            } else if (selectType === 'pi-thinking-level') {
                                nativeSelect = settingsPiThinkingLevel;
                                settingsKey = 'piThinkingLevel';
                                const thinkingLevelLabels = {
                                    default: t('settings.piThinkingLevelDefault'),
                                    off: 'Off',
                                    minimal: 'Minimal',
                                    low: 'Low',
                                    medium: 'Medium',
                                    high: 'High',
                                    xhigh: 'XHigh'
                                };
                                labelText = thinkingLevelLabels[value] || value;
                            } else if (selectType === 'claude-permission-mode') {
                                nativeSelect = settingsClaudePermissionMode;
                                settingsKey = 'claudePermissionMode';
                                const permissionModeLabels = {
                                    dangerouslySkip: t('settings.claudePermissionModeDangerouslySkip'),
                                    allowDangerouslySkip: t('settings.claudePermissionModeAllowDangerouslySkip'),
                                    default: t('settings.claudePermissionModeDefault')
                                };
                                labelText = permissionModeLabels[value] || value;
                            }

                            if (nativeSelect) {
                                nativeSelect.value = value;
                                nativeSelect.dispatchEvent(new Event('change'));
                            }

                            updateSettingsSelectDisplay('settings-' + selectType, value, labelText);
                            closeAllSettingsSelects();
                        });
                    });

                    // Close settings selects when clicking outside
                    document.addEventListener('click', event => {
                        const target = event.target;
                        if (!target.closest('.settings-select-wrap')) {
                            closeAllSettingsSelects();
                        }
                    });

                    if (settingsLanguage) {
                        settingsLanguage.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'language', value: settingsLanguage.value },
                            });
                        });
                    }

                    if (settingsShowToolIndicator) {
                        settingsShowToolIndicator.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'showToolUsageIndicator', value: settingsShowToolIndicator.checked },
                            });
                        });
                    }

                    if (settingsStepDetailLevel) {
                        settingsStepDetailLevel.addEventListener('change', () => {
                            stepDetailLevel = settingsStepDetailLevel.value;
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'stepDetailLevel', value: settingsStepDetailLevel.value },
                            });
                        });
                    }

                    if (settingsStepDetailLevelTrigger) {
                        settingsStepDetailLevelTrigger.addEventListener('click', event => {
                            event.preventDefault();
                            toggleSettingsSelect('settings-step-detail-level-wrap');
                        });
                    }

                    if (settingsThinkingFilter) {
                        settingsThinkingFilter.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'codexThinkingNoiseFilterEnabled', value: settingsThinkingFilter.checked },
                            });
                        });
                    }

                    if (settingsCodexHideThinking) {
                        settingsCodexHideThinking.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'codexHideThinking', value: settingsCodexHideThinking.checked },
                            });
                        });
                    }

                    if (settingsClaudeDisableThinking) {
                        settingsClaudeDisableThinking.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'claudeDisableThinking', value: settingsClaudeDisableThinking.checked },
                            });
                        });
                    }

                    if (settingsPiDisableThinking) {
                        settingsPiDisableThinking.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'piDisableThinking', value: settingsPiDisableThinking.checked },
                            });
                        });
                    }

                    if (settingsCodexAutoResume) {
                        settingsCodexAutoResume.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'codexAutoResumeSession', value: settingsCodexAutoResume.checked },
                            });
                        });
                    }

                    if (settingsClaudeAutoResume) {
                        settingsClaudeAutoResume.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'claudeAutoResumeSession', value: settingsClaudeAutoResume.checked },
                            });
                        });
                    }

                    if (settingsPiAutoResume) {
                        settingsPiAutoResume.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'piAutoResumeSession', value: settingsPiAutoResume.checked },
                            });
                        });
                    }

                    if (settingsTitleMode) {
                        settingsTitleMode.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'titleGenerationMode', value: settingsTitleMode.value },
                            });
                            if (settingsTitleFixedProviderItem) {
                                settingsTitleFixedProviderItem.style.display = settingsTitleMode.value === 'fixedProvider' ? 'flex' : 'none';
                            }
                        });
                    }

                    if (settingsTitleFixedProvider) {
                        settingsTitleFixedProvider.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'titleFixedProvider', value: settingsTitleFixedProvider.value },
                            });
                        });
                    }

                    // Pi configuration event listeners
                    if (settingsPiModel) {
                        settingsPiModel.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'piModel', value: settingsPiModel.value },
                            });
                        });
                        settingsPiModel.addEventListener('blur', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'piModel', value: settingsPiModel.value },
                            });
                        });
                    }

                    if (settingsPiApiKey) {
                        settingsPiApiKey.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'piApiKey', value: settingsPiApiKey.value },
                            });
                        });
                        settingsPiApiKey.addEventListener('blur', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'piApiKey', value: settingsPiApiKey.value },
                            });
                        });
                    }

                    if (settingsPiThinkingLevel) {
                        settingsPiThinkingLevel.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'piThinkingLevel', value: settingsPiThinkingLevel.value },
                            });
                        });
                    }

                    if (settingsPiThinkingLevelTrigger) {
                        settingsPiThinkingLevelTrigger.addEventListener('click', event => {
                            event.preventDefault();
                            toggleSettingsSelect('settings-pi-thinking-level-wrap');
                        });
                    }

                    // Codex configuration event listeners
                    if (settingsCodexModel) {
                        settingsCodexModel.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'codexModel', value: settingsCodexModel.value },
                            });
                        });
                        settingsCodexModel.addEventListener('blur', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'codexModel', value: settingsCodexModel.value },
                            });
                        });
                    }

                    if (settingsCodexConfigOverrides) {
                        settingsCodexConfigOverrides.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'codexConfigOverrides', value: settingsCodexConfigOverrides.value },
                            });
                        });
                        settingsCodexConfigOverrides.addEventListener('blur', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'codexConfigOverrides', value: settingsCodexConfigOverrides.value },
                            });
                        });
                    }

                    if (settingsCodexProfile) {
                        settingsCodexProfile.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'codexProfile', value: settingsCodexProfile.value },
                            });
                        });
                        settingsCodexProfile.addEventListener('blur', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'codexProfile', value: settingsCodexProfile.value },
                            });
                        });
                    }

                    if (settingsCodexOss) {
                        settingsCodexOss.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'codexOss', value: settingsCodexOss.checked },
                            });
                        });
                    }

                    // Codex sandbox mode select
                    if (settingsCodexSandboxModeTrigger) {
                        settingsCodexSandboxModeTrigger.addEventListener('click', () => {
                            toggleSettingsSelect('settings-codex-sandbox-mode-wrap');
                        });
                    }

                    if (settingsCodexSandboxModeMenu) {
                        settingsCodexSandboxModeMenu.querySelectorAll('[data-settings-select="codex-sandbox-mode"]').forEach(option => {
                            option.addEventListener('click', () => {
                                const value = option.getAttribute('data-settings-option');
                                if (settingsCodexSandboxMode) {
                                    settingsCodexSandboxMode.value = value;
                                }
                                const sandboxModeLabels = {
                                    'default': t('settings.codexSandboxModeDefault'),
                                    'read-only': t('settings.codexSandboxModeReadOnly'),
                                    'workspace-write': t('settings.codexSandboxModeWorkspaceWrite'),
                                    'danger-full-access': t('settings.codexSandboxModeDangerFullAccess')
                                };
                                updateSettingsSelectDisplay('settings-codex-sandbox-mode', value, sandboxModeLabels[value] || value);
                                closeAllSettingsSelects();
                                vscode.postMessage({
                                    type: 'settings-update',
                                    value: { key: 'codexSandboxMode', value: value },
                                });
                            });
                        });
                    }

                    // Codex approval policy select
                    if (settingsCodexApprovalPolicyTrigger) {
                        settingsCodexApprovalPolicyTrigger.addEventListener('click', () => {
                            toggleSettingsSelect('settings-codex-approval-policy-wrap');
                        });
                    }

                    if (settingsCodexApprovalPolicyMenu) {
                        settingsCodexApprovalPolicyMenu.querySelectorAll('[data-settings-select="codex-approval-policy"]').forEach(option => {
                            option.addEventListener('click', () => {
                                const value = option.getAttribute('data-settings-option');
                                if (settingsCodexApprovalPolicy) {
                                    settingsCodexApprovalPolicy.value = value;
                                }
                                const approvalPolicyLabels = {
                                    'default': t('settings.codexApprovalPolicyDefault'),
                                    'untrusted': t('settings.codexApprovalPolicyUntrusted'),
                                    'on-failure': t('settings.codexApprovalPolicyOnFailure'),
                                    'never': t('settings.codexApprovalPolicyNever')
                                };
                                updateSettingsSelectDisplay('settings-codex-approval-policy', value, approvalPolicyLabels[value] || value);
                                closeAllSettingsSelects();
                                vscode.postMessage({
                                    type: 'settings-update',
                                    value: { key: 'codexApprovalPolicy', value: value },
                                });
                            });
                        });
                    }

                    // Codex full auto toggle
                    if (settingsCodexFullAuto) {
                        settingsCodexFullAuto.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'codexFullAuto', value: settingsCodexFullAuto.checked },
                            });
                        });
                    }

                    // Claude configuration event listeners
                    if (settingsClaudeModel) {
                        settingsClaudeModel.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'claudeModel', value: settingsClaudeModel.value },
                            });
                        });
                        settingsClaudeModel.addEventListener('blur', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'claudeModel', value: settingsClaudeModel.value },
                            });
                        });
                    }

                    if (settingsClaudeAgent) {
                        settingsClaudeAgent.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'claudeAgent', value: settingsClaudeAgent.value },
                            });
                        });
                        settingsClaudeAgent.addEventListener('blur', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'claudeAgent', value: settingsClaudeAgent.value },
                            });
                        });
                    }

                    if (settingsClaudeTools) {
                        settingsClaudeTools.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'claudeTools', value: settingsClaudeTools.value },
                            });
                        });
                        settingsClaudeTools.addEventListener('blur', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'claudeTools', value: settingsClaudeTools.value },
                            });
                        });
                    }

                    if (settingsClaudePermissionMode) {
                        settingsClaudePermissionMode.addEventListener('change', () => {
                            vscode.postMessage({
                                type: 'settings-update',
                                value: { key: 'claudePermissionMode', value: settingsClaudePermissionMode.value },
                            });
                        });
                    }

                    if (settingsClaudePermissionModeTrigger) {
                        settingsClaudePermissionModeTrigger.addEventListener('click', event => {
                            event.preventDefault();
                            toggleSettingsSelect('settings-claude-permission-mode-wrap');
                        });
                    }

                    // Open config buttons
                    if (settingsPiOpenConfig) {
                        settingsPiOpenConfig.addEventListener('click', () => {
                            vscode.postMessage({ type: 'open-provider-config', value: 'pi' });
                        });
                    }

                    if (settingsCodexOpenConfig) {
                        settingsCodexOpenConfig.addEventListener('click', () => {
                            vscode.postMessage({ type: 'open-provider-config', value: 'codex' });
                        });
                    }

                    if (settingsClaudeOpenConfig) {
                        settingsClaudeOpenConfig.addEventListener('click', () => {
                            vscode.postMessage({ type: 'open-provider-config', value: 'claude' });
                        });
                    }

                    if (historySearchInput) {
                        const historySearchContainer = historySearchInput.closest('.history-search-container');
                        const historySearchClear = historySearchContainer ? historySearchContainer.querySelector('.history-search-clear') : null;

                        function updateSearchContainerState() {
                            if (historySearchContainer) {
                                historySearchContainer.classList.toggle('has-value', Boolean(historySearchInput.value));
                            }
                        }

                        historySearchInput.addEventListener('input', () => {
                            historySearchText = historySearchInput.value || '';
                            updateSearchContainerState();
                            renderHistoryList();
                        });

                        if (historySearchClear) {
                            historySearchClear.addEventListener('click', () => {
                                historySearchInput.value = '';
                                historySearchText = '';
                                updateSearchContainerState();
                                renderHistoryList();
                                historySearchInput.focus();
                            });
                        }
                    }

                    if (settingsSearchInput) {
                        const settingsSearchContainer = settingsSearchInput.closest('.settings-search-container');
                        const settingsSearchClear = settingsSearchContainer ? settingsSearchContainer.querySelector('.settings-search-clear') : null;

                        function updateSettingsSearchContainerState() {
                            if (settingsSearchContainer) {
                                settingsSearchContainer.classList.toggle('has-value', Boolean(settingsSearchInput.value));
                            }
                        }

                        function filterSettingsItems(query) {
                            const normalizedQuery = String(query || '').trim().toLowerCase();
                            const settingsContent = document.querySelector('.settings-content');
                            if (!settingsContent) {
                                return;
                            }

                            const sections = settingsContent.querySelectorAll('.settings-section');
                            sections.forEach(section => {
                                const items = section.querySelectorAll('.settings-item');
                                let visibleItemCount = 0;

                                items.forEach(item => {
                                    if (!normalizedQuery) {
                                        item.classList.remove('hidden-by-search');
                                        visibleItemCount++;
                                        return;
                                    }

                                    const label = item.querySelector('.settings-item-label');
                                    const desc = item.querySelector('.settings-item-desc');
                                    const labelText = label ? label.textContent.toLowerCase() : '';
                                    const descText = desc ? desc.textContent.toLowerCase() : '';

                                    if (labelText.includes(normalizedQuery) || descText.includes(normalizedQuery)) {
                                        item.classList.remove('hidden-by-search');
                                        visibleItemCount++;
                                    } else {
                                        item.classList.add('hidden-by-search');
                                    }
                                });

                                const sectionTitle = section.querySelector('.settings-section-title');
                                const sectionTitleText = sectionTitle ? sectionTitle.textContent.toLowerCase() : '';
                                const sectionMatches = normalizedQuery && sectionTitleText.includes(normalizedQuery);

                                if (sectionMatches) {
                                    items.forEach(item => item.classList.remove('hidden-by-search'));
                                    section.classList.remove('hidden-by-search');
                                } else if (visibleItemCount > 0 || !normalizedQuery) {
                                    section.classList.remove('hidden-by-search');
                                } else {
                                    section.classList.add('hidden-by-search');
                                }
                            });
                        }

                        settingsSearchInput.addEventListener('input', () => {
                            updateSettingsSearchContainerState();
                            filterSettingsItems(settingsSearchInput.value);
                        });

                        if (settingsSearchClear) {
                            settingsSearchClear.addEventListener('click', () => {
                                settingsSearchInput.value = '';
                                updateSettingsSearchContainerState();
                                filterSettingsItems('');
                                settingsSearchInput.focus();
                            });
                        }
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

                    if (historyMultiSelectAllBtn) {
                        historyMultiSelectAllBtn.addEventListener('click', () => {
                            const historySessions = getHistorySessions();
                            historySessions.forEach(session => {
                                if (session && session.id) {
                                    selectedSessionIds.add(session.id);
                                }
                            });
                            updateMultiSelectUi();
                            renderHistoryList();
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

                            vscode.postMessage({ type: 'session-switch', value: { sessionId } });
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

                            if (!isHomeMode && activeSessionId && currentProvider !== nextProvider) {
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
                                showHintMessage(t('message.emptyTitleError'), 2200);
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

                    // Copy button event handler (event delegation)
                    container.addEventListener('click', event => {
                        const target = event.target;
                        if (!(target instanceof Element)) {
                            return;
                        }

                        const copyBtn = target.closest('.copy-btn');
                        if (!copyBtn) {
                            return;
                        }

                        let textToCopy = copyBtn.getAttribute('data-copy-text') || '';

                        // For streaming messages, get content from activeStreamState
                        if (copyBtn.classList.contains('stream-copy-btn') && activeStreamState) {
                            textToCopy = activeStreamState.targetContent || activeStreamState.targetThought || '';
                        }

                        if (!textToCopy) {
                            return;
                        }

                        navigator.clipboard.writeText(textToCopy).then(() => {
                            const originalText = copyBtn.innerHTML;
                            copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19L21 7l-1.41-1.41z"/></svg>';
                            copyBtn.classList.add('copied');
                            setTimeout(() => {
                                copyBtn.innerHTML = originalText;
                                copyBtn.classList.remove('copied');
                            }, 1500);
                        }).catch(err => {
                            console.error('Failed to copy:', err);
                        });
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
                            if (statusModal && statusModal.getAttribute('aria-hidden') === 'false') {
                                closeStatusModal();
                            }
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
                            if (msg.value && msg.value.stepDetailLevel) {
                                stepDetailLevel = msg.value.stepDetailLevel;
                            }
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
                            const showHome = value.showHome === true;

                            if (showHome) {
                                setHomeMode(true);
                                if (toolbarTitle) {
                                    toolbarTitle.textContent = HOME_TITLE;
                                }
                                return;
                            }

                            if (!session) {
                                activeSessionId = '';
                                sessionMessages = [];
                                renderSessionOptions();
                                renderChatMessages([]);
                                if (toolbarTitle) {
                                    toolbarTitle.textContent = HOME_TITLE;
                                }
                                resetTokenCounter();
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
                            if (toolbarTitle) {
                                toolbarTitle.textContent = session.title || HOME_TITLE;
                            }
                            return;
                        }

                        if (msg.type === 'attachments-update') {
                            const attachments = msg.value && Array.isArray(msg.value.attachments)
                                ? msg.value.attachments
                                : [];
                            const mergeResult = mergeAttachments(attachments);
                            renderAttachments();
                            if (mergeResult.hiddenByLimit > 0) {
                                showHintMessage(t('message.attachmentLimitHint'), 2500);
                            }
                            return;
                        }

                        if (msg.type === 'settings-data') {
                            const settings = msg.value || {};
                            updateSettingsUi(settings);
                            return;
                        }

                        if (msg.type === 'translations-update') {
                            const value = msg.value || {};
                            if (value.translations) {
                                currentLanguage = value.language || currentLanguage;
                                applyTranslations(value.translations);
                            }
                            return;
                        }

                        if (msg.type === 'status-response') {
                            renderStatusResponse(msg.value);
                            return;
                        }

                        addMessage(msg.type, msg.value);
                    });

                    vscode.postMessage({ type: 'session-list-request' });
                    updateRecentTasksCollapsedState();
`;
