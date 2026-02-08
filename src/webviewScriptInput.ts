export const WEBVIEW_SCRIPT_INPUT = `
                    function formatAttachmentSize(bytes) {
                        const size = Number(bytes);
                        if (!Number.isFinite(size) || size < 0) {
                            return '';
                        }
                        if (size < 1024) {
                            return size + ' B';
                        }
                        if (size < 1024 * 1024) {
                            return (size / 1024).toFixed(1) + ' KB';
                        }
                        return (size / (1024 * 1024)).toFixed(1) + ' MB';
                    }

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

                    function mergeAttachments(nextAttachments) {
                        const beforeCount = selectedAttachments.length;
                        const merged = new Map();
                        selectedAttachments.forEach(item => {
                            if (item && item.path) {
                                merged.set(item.path, item);
                            }
                        });
                        (nextAttachments || []).forEach(item => {
                            if (item && item.path) {
                                merged.set(item.path, item);
                            }
                        });
                        selectedAttachments = Array.from(merged.values()).slice(0, 8);

                        const incomingCount = Array.isArray(nextAttachments) ? nextAttachments.length : 0;
                        const hiddenByLimit = Math.max(0, beforeCount + incomingCount - selectedAttachments.length);
                        return { hiddenByLimit };
                    }

                    function removeAttachmentByIndex(index) {
                        if (!Number.isInteger(index) || index < 0 || index >= selectedAttachments.length) {
                            return;
                        }
                        selectedAttachments.splice(index, 1);
                        renderAttachments();
                    }

                    function renderAttachments() {
                        if (!attachmentList) {
                            return;
                        }

                        if (!selectedAttachments.length) {
                            attachmentList.innerHTML = '';
                            attachmentList.style.display = 'none';
                            return;
                        }

                        attachmentList.style.display = 'flex';
                        attachmentList.innerHTML = selectedAttachments.map((item, index) => {
                            const name = escapeHtml(item.name || item.path || 'attachment');
                            const filePath = escapeHtml(item.path || '');
                            const sizeText = formatAttachmentSize(item.size);
                            const sizeHtml = sizeText ? ('<span class="attachment-chip-size">' + escapeHtml(sizeText) + '</span>') : '';
                            return [
                                '<div class="attachment-chip" title="' + filePath + '">',
                                '  <span class="attachment-chip-name">' + name + '</span>',
                                sizeHtml,
                                '  <button class="attachment-chip-remove" data-index="' + index + '" title="Remove attachment">×</button>',
                                '</div>',
                            ].join('');
                        }).join('');

                        attachmentList.querySelectorAll('.attachment-chip-remove').forEach(button => {
                            button.addEventListener('click', event => {
                                const target = event.currentTarget;
                                if (!target) {
                                    return;
                                }
                                const indexText = target.getAttribute('data-index');
                                if (indexText === null) {
                                    return;
                                }
                                const index = Number(indexText);
                                removeAttachmentByIndex(index);
                            });
                        });
                    }

                    function setDropState(active) {
                        if (!inputContainer) {
                            return;
                        }
                        if (active) {
                            inputContainer.classList.add('drop-active');
                            showHintMessage('Drop files to attach', 0);
                            return;
                        }
                        inputContainer.classList.remove('drop-active');
                        if (!isThinking) {
                            showHintMessage('', 0);
                        }
                    }

                    function buildAttachmentsFromDrop(files) {
                        const result = [];
                        for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            if (!file || !file.path) {
                                continue;
                            }
                            result.push({
                                path: file.path,
                                name: file.name || file.path,
                                size: Number.isFinite(file.size) ? file.size : undefined,
                            });
                        }
                        return result;
                    }

                    function handleDropEvent(event) {
                        if (isThinking) {
                            return;
                        }

                        const files = event.dataTransfer && event.dataTransfer.files
                            ? event.dataTransfer.files
                            : null;
                        if (!files || files.length === 0) {
                            return;
                        }

                        const attachments = buildAttachmentsFromDrop(files);
                        if (!attachments.length) {
                            return;
                        }

                        const mergeResult = mergeAttachments(attachments);
                        renderAttachments();
                        if (mergeResult.hiddenByLimit > 0) {
                            showHintMessage('Only first 8 attachments kept', 2500);
                        }
                    }

                    function isFileDrag(event) {
                        const types = event.dataTransfer && event.dataTransfer.types ? event.dataTransfer.types : [];
                        if (!types || !types.length) {
                            return false;
                        }
                        return Array.from(types).includes('Files');
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

                    function setProvider(provider) {
                        const normalizedProvider = provider === 'claude'
                            ? 'claude'
                            : (provider === 'pi' ? 'pi' : 'codex');
                        currentProvider = normalizedProvider;

                        if (providerSelect) {
                            providerSelect.value = normalizedProvider;
                        }
                    }

                    function setNewSessionProvider(provider) {
                        const normalizedProvider = provider === 'claude'
                            ? 'claude'
                            : (provider === 'pi' ? 'pi' : 'codex');
                        newSessionProvider = normalizedProvider;
                        if (providerSelect) {
                            providerSelect.value = normalizedProvider;
                        }
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

                    function send() {
                        if (isThinking) {
                            vscode.postMessage({ type: 'cancel' });
                            return;
                        }

                        const text = inputBox.value.trim();
                        if (!text) return;

                        if (!activeSessionId) {
                            showHintMessage('Please create a session first', 2000);
                            return;
                        }

                        vscode.postMessage({
                            type: 'userInput',
                            value: {
                                prompt: text,
                                provider: currentProvider,
                                attachments: selectedAttachments,
                                sessionId: activeSessionId,
                            },
                        });
                        inputBox.value = '';
                        selectedAttachments = [];
                        renderAttachments();
                    }

                    if (sessionSelect) {
                        sessionSelect.addEventListener('change', () => {
                            if (isThinking) {
                                return;
                            }
                            const sessionId = sessionSelect.value;
                            if (!sessionId) {
                                return;
                            }
                            vscode.postMessage({ type: 'session-switch', value: { sessionId } });
                        });
                    }

                    if (sessionNewBtn) {
                        sessionNewBtn.addEventListener('click', () => {
                            if (isThinking) {
                                return;
                            }
                            vscode.postMessage({ type: 'session-create', value: { provider: newSessionProvider } });
                        });
                    }

                    if (providerSelect) {
                        providerSelect.addEventListener('change', () => {
                            const nextProvider = providerSelect.value === 'claude'
                                ? 'claude'
                                : (providerSelect.value === 'pi' ? 'pi' : 'codex');
                            setNewSessionProvider(nextProvider);
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

                    document.addEventListener('dragenter', event => {
                        if (!isFileDrag(event) || isThinking) {
                            return;
                        }
                        event.preventDefault();
                        dragDepth += 1;
                        setDropState(true);
                    });

                    document.addEventListener('dragover', event => {
                        if (!isFileDrag(event) || isThinking) {
                            return;
                        }
                        event.preventDefault();
                    });

                    document.addEventListener('dragleave', event => {
                        if (!isFileDrag(event)) {
                            return;
                        }
                        event.preventDefault();
                        dragDepth = Math.max(0, dragDepth - 1);
                        if (dragDepth === 0) {
                            setDropState(false);
                        }
                    });

                    document.addEventListener('drop', event => {
                        if (!isFileDrag(event)) {
                            return;
                        }
                        event.preventDefault();
                        dragDepth = 0;
                        setDropState(false);
                        handleDropEvent(event);
                    });

                    document.getElementById('send-btn').addEventListener('click', send);
                    inputBox.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
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
                            renderChatMessages(sessionMessages);
                            selectedAttachments = [];
                            renderAttachments();
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
