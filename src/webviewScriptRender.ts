export const WEBVIEW_SCRIPT_RENDER = `
                    // 更新UI为思考状态
                    function setThinkingState(thinking) {
                        isThinking = thinking;

                        if (thinking) {
                            inputContainer.classList.add('thinking');
                            inputBox.disabled = true;
                            inputBox.placeholder = 'AI is processing...';
                            addBtn.disabled = true;
                            if (providerSelect) {
                                providerSelect.disabled = true;
                            }

                            sendBtn.classList.add('thinking');
                            sendIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />';
                            sendIcon.classList.add('stop-icon');

                            if (!sendBtn.querySelector('.obsidian-send-btn-thinking-bg')) {
                                const bg = document.createElement('div');
                                bg.className = 'obsidian-send-btn-thinking-bg';
                                sendBtnContent.appendChild(bg);
                            }

                            statusText.innerHTML = '<span class="status-dot"></span> Thinking';
                            hintText.textContent = 'Click to stop';
                        } else {
                            inputContainer.classList.remove('thinking');
                            inputBox.disabled = false;
                            inputBox.placeholder = 'Ask anything...';
                            addBtn.disabled = false;
                            if (providerSelect) {
                                providerSelect.disabled = false;
                            }

                            sendBtn.classList.remove('thinking');
                            sendIcon.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>';
                            sendIcon.classList.remove('stop-icon');

                            const bg = sendBtnContent.querySelector('.obsidian-send-btn-thinking-bg');
                            if (bg) bg.remove();

                            statusText.innerHTML = '<span class="status-dot"></span> Ready';
                            hintText.textContent = '';
                        }
                    }

                    function renderExecCard(entry) {
                        const statusLabel = entry.exitCode
                            ? ('Exit ' + escapeHtml(entry.exitCode))
                            : (entry.status
                                ? entry.status.charAt(0).toUpperCase() + entry.status.slice(1)
                                : 'Executed');

                        const statusClass = entry.status === 'failed' ? 'failed' : 'success';
                        const timeLabel = entry.duration ? escapeHtml(entry.duration) : '';

                        const chunks = [
                            '<div class="op-card op-exec">',
                            '  <div class="op-card-head">',
                            '    <span class="op-badge">' + escapeHtml(entry.runnerLabel || 'Command') + '</span>',
                            '    <div class="op-head-right">',
                            '      <span class="op-status ' + statusClass + '">' + statusLabel + '</span>',
                            timeLabel ? ('      <span class="op-time">' + timeLabel + '</span>') : '',
                            '    </div>',
                            '  </div>',
                            '  <div class="op-command">' + escapeHtml(entry.command) + '</div>',
                            entry.output ? ('  <div class="op-output">' + escapeHtml(entry.output) + '</div>') : '',
                            '</div>',
                        ];

                        return chunks.filter(Boolean).join('');
                    }

                    function renderPatchCard(entry) {
                        const summary = 'Add ' + entry.added + ' · Update ' + entry.updated + ' · Delete ' + entry.deleted;
                        const filesHtml = entry.files.length > 0
                            ? ('<ul class="op-files">' + entry.files.map(file => '<li>' + escapeHtml(file) + '</li>').join('') + '</ul>')
                            : '';

                        return [
                            '<div class="op-card op-patch">',
                            '  <div class="op-card-head">',
                            '    <span class="op-badge">File Change</span>',
                            '    <span class="op-status success">Applied</span>',
                            '  </div>',
                            '  <div class="op-command">' + escapeHtml(summary) + '</div>',
                            filesHtml,
                            '</div>',
                        ].join('');
                    }

                    function renderThinkingContent(thoughtText) {
                        const parts = parseThinkingParts(thoughtText);
                        if (parts.length === 0) {
                            return '';
                        }

                        return parts.map(part => {
                            if (part.type === 'exec') {
                                return renderExecCard(part.value);
                            }
                            if (part.type === 'patch') {
                                return renderPatchCard(part.value);
                            }
                            return '<div class="thinking-text">' + escapeHtml(part.value) + '</div>';
                        }).join('');
                    }

`;
