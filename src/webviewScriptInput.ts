export const WEBVIEW_SCRIPT_INPUT = `
                    function addMessage(type, data) {
                        if (loadingDiv) { loadingDiv.remove(); loadingDiv = null; }
                        if (type === 'done') return;

                        if (type === 'stream-start') {
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
                            };
                            activeStreamElements.thinkingContent.innerHTML = renderStreamPlaceholder('Waiting for first output');
                            setThinkingState(true);
                            return;
                        }

                        if (type === 'stream-update') {
                            renderStreamUpdate(data);
                            return;
                        }

                        if (type === 'stream-end') {
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
                                    activeStreamElements.thinkingContent.innerHTML = renderThinkingContent(activeStreamState.targetThought);
                                }

                                if (data.finished && activeStreamState?.targetContent) {
                                    activeStreamState.displayedContent = activeStreamState.targetContent;
                                    activeStreamElements.answerBlock.style.display = '';
                                    activeStreamElements.answerBlock.innerHTML = marked.parse(activeStreamState.targetContent);
                                }

                                if (data.canceled) {
                                    activeStreamElements.details.open = false;
                                    if (activeStreamElements.answerBlock.style.display === 'none') {
                                        activeStreamElements.answerBlock.style.display = '';
                                        activeStreamElements.answerBlock.innerHTML = marked.parse('Request canceled.');
                                    }
                                }
                                if (data.timedOut && activeStreamElements.answerBlock.style.display === 'none') {
                                    activeStreamElements.answerBlock.style.display = '';
                                    activeStreamElements.answerBlock.innerHTML = marked.parse('Request timed out.');
                                    activeStreamElements.details.open = false;
                                }
                                if (data.error && activeStreamElements.answerBlock.style.display === 'none') {
                                    activeStreamElements.answerBlock.style.display = '';
                                    activeStreamElements.answerBlock.innerHTML = marked.parse(String(data.error));
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

                        const div = document.createElement('div');
                        
                        if (type === 'user') {
                            div.className = 'message user';
                            div.innerText = data;
                        } 
                        else if (type === 'bot-complex') {
                            // 🔥 处理复杂的 { thought, content } 对象
                            div.className = 'message bot';
                            
                            let html = '';
                            
                            // 1. 如果有思考过程，添加折叠面板
                            if (data.thought && data.thought.length > 5) {
                                const thinkingHtml = renderThinkingContent(data.thought);
                                html += \`<details class="thinking-block">
                                    <summary>Thinking Process</summary>
                                    <div class="thinking-content">\${thinkingHtml}</div>
                                </details>\`;
                            }
                            
                            // 2. 添加最终回答
                            html += \`<div class="answer-block">\${marked.parse(data.content)}</div>\`;
                            
                            div.innerHTML = html;
                        } 
                        else if (type === 'bot') {
                            // 兼容旧的纯文本模式
                            div.className = 'message bot';
                            div.innerHTML = \`<div class="answer-block">\${marked.parse(data)}</div>\`;
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
                            // 停止当前请求
                            vscode.postMessage({ type: 'cancel' });
                            return;
                        }

                        const text = inputBox.value.trim();
                        if (!text) return;
                        vscode.postMessage({ type: 'userInput', value: { prompt: text, provider: currentProvider } });
                        inputBox.value = '';
                    }

                    if (providerSelect) {
                        providerSelect.addEventListener('change', () => {
                            currentProvider = providerSelect.value === 'claude' ? 'claude' : 'codex';
                        });
                    }

                    document.getElementById('send-btn').addEventListener('click', send);
                    inputBox.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                    });

                    window.addEventListener('message', event => {
                        const msg = event.data;
                        if (msg.type === 'provider-init') {
                            const provider = msg.value && msg.value.provider === 'claude' ? 'claude' : 'codex';
                            currentProvider = provider;
                            if (providerSelect) {
                                providerSelect.value = provider;
                            }
                            return;
                        }
                        addMessage(msg.type, msg.value);
                    });
`;
