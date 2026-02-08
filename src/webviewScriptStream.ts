export const WEBVIEW_SCRIPT_STREAM = `
                    function createStreamMessage(requestId) {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'message bot';
                        wrapper.dataset.streamId = String(requestId);

                        const details = document.createElement('details');
                        details.className = 'thinking-block';
                        details.open = true;

                        const summary = document.createElement('summary');
                        summary.innerText = 'Thinking Process';

                        const thinkingContent = document.createElement('div');
                        thinkingContent.className = 'thinking-content';

                        const answerBlock = document.createElement('div');
                        answerBlock.className = 'answer-block';
                        answerBlock.style.display = 'none';

                        details.appendChild(summary);
                        details.appendChild(thinkingContent);
                        wrapper.appendChild(details);
                        wrapper.appendChild(answerBlock);

                        container.appendChild(wrapper);
                        container.scrollTop = container.scrollHeight;

                        return { wrapper, details, thinkingContent, answerBlock };
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
                                    activeStreamElements.thinkingContent.innerHTML = renderStreamPlaceholder('Waiting for first output');
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
                                activeStreamElements.thinkingContent.innerHTML = renderThinkingContent(activeStreamState.displayedThought);
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
                                activeStreamElements.answerBlock.innerHTML = marked.parse(activeStreamState.displayedContent);
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
                            };
                        }

                        const thoughtText = payload.thought || '';
                        let answerText = payload.content || '';

                        if (looksLikeThinkingOnly(answerText)) {
                            answerText = '';
                        }

                        const incomingStage = payload.stage === 'answering' ? 'answering' : 'thinking';
                        if (incomingStage === 'answering' || activeStreamState.phase === 'answering') {
                            activeStreamState.phase = 'answering';
                        }

                        activeStreamState.targetThought = String(thoughtText);

                        if (activeStreamState.phase !== 'answering') {
                            scheduleThinkingTyping();
                        }

                        if (activeStreamState.phase === 'answering') {
                            if (activeStreamState.targetThought && activeStreamState.displayedThought !== activeStreamState.targetThought) {
                                activeStreamState.displayedThought = activeStreamState.targetThought;
                                activeStreamElements.thinkingContent.innerHTML = renderThinkingContent(activeStreamState.displayedThought);
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
