export const WEBVIEW_SCRIPT_RENDER = `
                    // 格式化 token 数量显示
                    function formatTokenCount(count) {
                        if (count >= 1000000) {
                            return (count / 1000000).toFixed(1) + 'M';
                        }
                        if (count >= 1000) {
                            return (count / 1000).toFixed(1) + 'k';
                        }
                        return String(count);
                    }

                    // 获取 token 使用量级别
                    function getTokenLevel(count) {
                        // 基于 Claude 的上下文窗口大小 (200k tokens)
                        if (count < 50000) return 'low';
                        if (count < 100000) return 'medium';
                        if (count < 150000) return 'high';
                        return 'critical';
                    }

                    // 更新 token 计数器显示
                    function updateTokenCounter(totalTokens) {
                        if (!tokenCounter || !tokenCounterValue) {
                            return;
                        }

                        currentTokenUsage = totalTokens;

                        if (totalTokens > 0) {
                            tokenCounter.classList.add('visible');
                            tokenCounterValue.textContent = formatTokenCount(totalTokens);

                            // 更新级别样式
                            const level = getTokenLevel(totalTokens);
                            tokenCounter.classList.remove('level-low', 'level-medium', 'level-high', 'level-critical');
                            tokenCounter.classList.add('level-' + level);
                        } else {
                            tokenCounter.classList.remove('visible');
                        }
                    }

                    // 重置 token 计数器
                    function resetTokenCounter() {
                        if (!tokenCounter || !tokenCounterValue) {
                            return;
                        }
                        currentTokenUsage = 0;
                        tokenCounter.classList.remove('visible', 'level-low', 'level-medium', 'level-high', 'level-critical');
                        tokenCounterValue.textContent = '0';
                    }

                    // 应用思考摘要到summary元素
                    function applyThinkingSummary(details, summary, thoughtText, segments) {
                        const toolCount = countToolUsage(segments, thoughtText);
                        const hasTools = toolCount > 0;

                        details.classList.toggle('has-tools', hasTools);

                        if (hasTools && showToolUsageIndicator) {
                            summary.innerHTML = t('message.thinkingProcess') + ' <span class="thinking-tool-count">' + toolCount + '</span>';
                        } else {
                            summary.textContent = t('message.thinkingProcess');
                        }
                    }

                    // 更新UI为思考状态
                    function setThinkingState(thinking) {
                        isThinking = thinking;

                        if (thinking) {
                            inputContainer.classList.add('thinking');
                            inputBox.disabled = true;
                            inputBox.placeholder = t('input.placeholderThinking');
                            addBtn.disabled = true;
                            if (providerSelect) {
                                providerSelect.disabled = true;
                            }
                            if (sessionSelect) {
                                sessionSelect.disabled = true;
                            }
                            if (sessionNewBtn) {
                                sessionNewBtn.disabled = true;
                            }
                            if (sessionRenameBtn) {
                                sessionRenameBtn.disabled = true;
                            }
                            if (sessionDeleteBtn) {
                                sessionDeleteBtn.disabled = true;
                            }

                            sendBtn.classList.add('thinking');
                            sendIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />';
                            sendIcon.classList.add('stop-icon');

                            if (!sendBtn.querySelector('.obsidian-send-btn-thinking-bg')) {
                                const bg = document.createElement('div');
                                bg.className = 'obsidian-send-btn-thinking-bg';
                                sendBtnContent.appendChild(bg);
                            }

                            statusText.innerHTML = '<span class="status-dot"></span> ' + t('status.thinking');
                            hintText.textContent = t('status.clickToStop');
                        } else {
                            inputContainer.classList.remove('thinking');
                            inputBox.disabled = false;
                            inputBox.placeholder = t('input.placeholder');
                            addBtn.disabled = false;
                            if (providerSelect) {
                                providerSelect.disabled = false;
                                providerSelect.value = newSessionProvider;
                            }
                            if (sessionSelect) {
                                sessionSelect.disabled = false;
                            }
                            if (sessionNewBtn) {
                                sessionNewBtn.disabled = false;
                            }
                            if (sessionRenameBtn) {
                                sessionRenameBtn.disabled = false;
                            }
                            if (sessionDeleteBtn) {
                                sessionDeleteBtn.disabled = false;
                            }

                            sendBtn.classList.remove('thinking');
                            sendIcon.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>';
                            sendIcon.classList.remove('stop-icon');

                            const bg = sendBtnContent.querySelector('.obsidian-send-btn-thinking-bg');
                            if (bg) bg.remove();

                            statusText.innerHTML = '<span class="status-dot"></span> ' + t('status.ready');
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
                        const summary = [
                            'Add ' + (entry.added || 0),
                            'Update ' + (entry.updated || 0),
                            'Delete ' + (entry.deleted || 0),
                            'Move ' + (entry.moved || 0),
                        ].join(' · ');

                        const detail = [
                            'Hunks ' + (entry.hunks || 0),
                            '+' + (entry.additions || 0),
                            '-' + (entry.deletions || 0),
                        ].join(' · ');

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
                            '  <div class="op-output">' + escapeHtml(detail) + '</div>',
                            filesHtml,
                            '</div>',
                        ].join('');
                    }

                    function renderToolUseCard(entry) {
                        const toolName = entry.name || 'Tool';
                        let inputDisplay = '';
                        let secondaryInfo = '';

                        // Tool icon mapping
                        const toolIcons = {
                            'Read': '📄',
                            'Write': '✏️',
                            'Edit': '🔧',
                            'Bash': '⚡',
                            'Grep': '🔍',
                            'Glob': '📁',
                            'WebFetch': '🌐',
                            'WebSearch': '🔎',
                            'Task': '📋',
                            'TodoWrite': '✅',
                        };
                        const icon = toolIcons[toolName] || '🔧';

                        // Try to parse and format the input JSON
                        if (entry.input) {
                            try {
                                const parsed = JSON.parse(entry.input);
                                // Extract key info based on tool type
                                if (toolName === 'Bash' && parsed.command) {
                                    inputDisplay = parsed.command;
                                    if (parsed.description) {
                                        secondaryInfo = parsed.description;
                                    }
                                } else if ((toolName === 'Read' || toolName === 'Write' || toolName === 'Edit') && parsed.file_path) {
                                    inputDisplay = parsed.file_path;
                                } else if (toolName === 'Grep' && parsed.pattern) {
                                    inputDisplay = parsed.pattern;
                                    if (parsed.path) {
                                        secondaryInfo = parsed.path;
                                    }
                                } else if (toolName === 'Glob' && parsed.pattern) {
                                    inputDisplay = parsed.pattern;
                                    if (parsed.path) {
                                        secondaryInfo = parsed.path;
                                    }
                                } else if (toolName === 'WebFetch' && parsed.url) {
                                    inputDisplay = parsed.url;
                                } else if (toolName === 'WebSearch' && parsed.query) {
                                    inputDisplay = parsed.query;
                                } else if (toolName === 'Task' && parsed.description) {
                                    inputDisplay = parsed.description;
                                    if (parsed.subagent_type) {
                                        secondaryInfo = parsed.subagent_type;
                                    }
                                } else {
                                    // Fallback: show first key-value pair
                                    const keys = Object.keys(parsed);
                                    if (keys.length > 0) {
                                        const firstKey = keys[0];
                                        const firstValue = String(parsed[firstKey] || '');
                                        inputDisplay = firstValue.length > 100 ? firstValue.slice(0, 100) + '...' : firstValue;
                                    }
                                }
                            } catch {
                                // If JSON parsing fails, show raw input (truncated)
                                inputDisplay = entry.input.length > 100 ? entry.input.slice(0, 100) + '...' : entry.input;
                            }
                        }

                        // Build the card with border-box style
                        const lines = [
                            '<div class="tool-card">',
                            '  <div class="tool-card-header">',
                            '    <span class="tool-card-icon">' + icon + '</span>',
                            '    <span class="tool-card-name">' + escapeHtml(toolName) + '</span>',
                            '  </div>',
                        ];

                        if (inputDisplay) {
                            lines.push('  <div class="tool-card-content">' + escapeHtml(inputDisplay) + '</div>');
                        }

                        if (secondaryInfo) {
                            lines.push('  <div class="tool-card-secondary">' + escapeHtml(secondaryInfo) + '</div>');
                        }

                        lines.push('</div>');

                        return lines.join('');
                    }

                    function renderThinkingContent(thoughtText, segments) {
                        const parts = parseStreamSegments(segments, thoughtText);
                        if (parts.length === 0) {
                            return '';
                        }

                        const rendered = [];
                        for (const part of parts) {
                            if (part.type === 'exec') {
                                rendered.push(renderExecCard(part.value));
                                continue;
                            }
                            if (part.type === 'patch') {
                                rendered.push(renderPatchCard(part.value));
                                continue;
                            }
                            if (part.type === 'tool_use') {
                                rendered.push(renderToolUseCard(part.value));
                                continue;
                            }
                            // Split text by double newlines to create separate paragraphs
                            const newline = String.fromCharCode(10);
                            const doubleNewline = newline + newline;
                            const paragraphs = String(part.value || '').split(doubleNewline).map(p => p.trim()).filter(Boolean);
                            for (const para of paragraphs) {
                                rendered.push('<div class="thinking-text">' + escapeHtml(para) + '</div>');
                            }
                        }
                        return rendered.join('');
                    }

`;
