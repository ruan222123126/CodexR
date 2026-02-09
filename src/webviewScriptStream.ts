export const WEBVIEW_SCRIPT_STREAM = `
                    function createStreamMessage(requestId) {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'message bot';
                        wrapper.dataset.streamId = String(requestId);

                        const details = document.createElement('details');
                        details.className = 'thinking-block';
                        details.open = true;

                        const summary = document.createElement('summary');
                        applyThinkingSummary(details, summary, '', []);

                        const thinkingContent = document.createElement('div');
                        thinkingContent.className = 'thinking-content';

                        const answerBlock = document.createElement('div');
                        answerBlock.className = 'answer-block';
                        answerBlock.style.display = 'none';

                        const actionsDiv = document.createElement('div');
                        actionsDiv.className = 'message-actions';
                        actionsDiv.innerHTML = '<button class="copy-btn stream-copy-btn" title="' + t('message.copy') + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M9 18q-.825 0-1.412-.587T7 16V4q0-.825.588-1.412T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.587 1.413T18 18zm-4 4q-.825 0-1.412-.587T3 20V6h2v14h11v2z"/></svg></button>';

                        details.appendChild(summary);
                        details.appendChild(thinkingContent);
                        wrapper.appendChild(details);
                        wrapper.appendChild(answerBlock);
                        wrapper.appendChild(actionsDiv);

                        container.appendChild(wrapper);
                        container.scrollTop = container.scrollHeight;

                        return { wrapper, details, summary, thinkingContent, answerBlock, actionsDiv };
                    }

                    function renderStreamPlaceholder(label) {
                        return \`<div class="thinking-text stream-placeholder">\${escapeHtml(label)}<span class="stream-caret">▍</span></div>\`;
                    }

                    function scheduleThinkingTyping() {
                        if (!activeStreamState || activeStreamState.thinkingTimer) {
                            return;
                        }

                        activeStreamState.thinkingTimer = setTimeout(() => {
                            if (!activeStreamState || !activeStreamElements) {
                                return;
                            }

                            activeStreamState.thinkingTimer = null;

                            const target = activeStreamState.targetThought || '';
                            if (!target) {
                                if (activeStreamState.phase !== 'answering') {
                                    activeStreamElements.thinkingContent.innerHTML = renderStreamPlaceholder(t('message.waitingForOutput'));
                                }
                                return;
                            }

                            if (!target.startsWith(activeStreamState.displayedThought)) {
                                activeStreamState.displayedThought = '';
                            }

                            if (activeStreamState.displayedThought.length < target.length) {
                                const remaining = target.length - activeStreamState.displayedThought.length;
                                const step = Math.max(1, Math.ceil(remaining / 45));
                                const nextLength = Math.min(target.length, activeStreamState.displayedThought.length + step);
                                activeStreamState.displayedThought = target.slice(0, nextLength);
                                activeStreamElements.thinkingContent.innerHTML = renderThinkingContent(activeStreamState.displayedThought, activeStreamState.targetSegments || []);
                                container.scrollTop = container.scrollHeight;
                            }

                            if (activeStreamState.displayedThought.length < target.length) {
                                scheduleThinkingTyping();
                            }
                        }, 14);
                    }

                    function scheduleAnswerTyping() {
                        if (!activeStreamState || activeStreamState.typingTimer) {
                            return;
                        }

                        if (activeStreamElements && activeStreamState.targetContent && !activeStreamState.displayedContent) {
                            activeStreamElements.answerBlock.innerHTML = \`<div class="stream-placeholder">Generating response<span class="stream-caret">▍</span></div>\`;
                        }

                        activeStreamState.typingTimer = setTimeout(() => {
                            if (!activeStreamState) {
                                return;
                            }

                            activeStreamState.typingTimer = null;

                            if (!activeStreamElements) {
                                return;
                            }

                            const target = activeStreamState.targetContent || '';
                            if (!target) {
                                return;
                            }

                            if (!target.startsWith(activeStreamState.displayedContent)) {
                                activeStreamState.displayedContent = '';
                            }

                            if (activeStreamState.displayedContent.length < target.length) {
                                const remaining = target.length - activeStreamState.displayedContent.length;
                                const step = Math.max(1, Math.ceil(remaining / 40));
                                const nextLength = Math.min(target.length, activeStreamState.displayedContent.length + step);
                                activeStreamState.displayedContent = target.slice(0, nextLength);
                                activeStreamElements.answerBlock.innerHTML = renderMarkdownSafe(activeStreamState.displayedContent);
                                container.scrollTop = container.scrollHeight;
                            }

                            if (activeStreamState.displayedContent.length < target.length) {
                                scheduleAnswerTyping();
                            }
                        }, 18);
                    }

                    function renderStreamUpdate(payload) {
                        if (!activeStreamElements || payload.requestId !== activeStreamId) {
                            return;
                        }

                        if (!activeStreamState) {
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
                        }

                        // Update token usage if available
                        if (payload.usage && typeof payload.usage.totalTokens === 'number') {
                            updateTokenCounter(payload.usage.totalTokens);
                        }

                        const segments = Array.isArray(payload.segments) ? payload.segments : [];
                        const thoughtText = payload.thought || '';
                        let answerText = payload.content || '';

                        if (segments.length > 0) {
                            const fromSegments = extractAnswerTextFromSegments(segments);
                            if (fromSegments) {
                                answerText = fromSegments;
                            }
                            activeStreamState.targetSegments = segments;
                        } else if (looksLikeThinkingOnly(answerText)) {
                            answerText = '';
                        }

                        const incomingStage = payload.stage === 'answering' ? 'answering' : 'thinking';
                        if (incomingStage === 'answering' || activeStreamState.phase === 'answering') {
                            activeStreamState.phase = 'answering';
                        }

                        activeStreamState.targetThought = String(thoughtText);

                        applyThinkingSummary(
                            activeStreamElements.details,
                            activeStreamElements.summary,
                            activeStreamState.targetThought,
                            activeStreamState.targetSegments || [],
                        );

                        if (activeStreamState.phase !== 'answering' && segments.length === 0) {
                            scheduleThinkingTyping();
                        }

                        if (segments.length > 0) {
                            activeStreamState.displayedThought = activeStreamState.targetThought;
                            activeStreamElements.thinkingContent.innerHTML = renderThinkingContent(activeStreamState.displayedThought, segments);
                        }

                        if (activeStreamState.phase === 'answering') {
                            if (activeStreamState.targetThought && activeStreamState.displayedThought !== activeStreamState.targetThought && segments.length === 0) {
                                activeStreamState.displayedThought = activeStreamState.targetThought;
                                activeStreamElements.thinkingContent.innerHTML = renderThinkingContent(activeStreamState.displayedThought, activeStreamState.targetSegments || []);
                            }

                            activeStreamElements.answerBlock.style.display = '';
                            activeStreamElements.details.open = false;

                            if (answerText) {
                                activeStreamState.targetContent = String(answerText);
                            }
                            scheduleAnswerTyping();
                        } else {
                            activeStreamElements.answerBlock.style.display = 'none';
                            activeStreamElements.answerBlock.innerHTML = '';
                            activeStreamElements.details.open = true;
                            activeStreamState.targetContent = '';
                            activeStreamState.displayedContent = '';
                        }

                        container.scrollTop = container.scrollHeight;
                    }

`;
