/**
 * Input Events Module
 * Handles keyboard events, paste events, and send button functionality
 */

export const INPUT_EVENTS_SCRIPT = `
                    function send() {
                        if (isThinking) {
                            vscode.postMessage({ type: 'cancel' });
                            return;
                        }

                        const text = inputBox.value.trim();
                        if (!text) return;

                        if (isHomeMode) {
                            vscode.postMessage({
                                type: 'userInput',
                                value: {
                                    prompt: text,
                                    provider: newSessionProvider,
                                    attachments: selectedAttachments,
                                    startFromHome: true,
                                },
                            });
                            inputBox.value = '';
                            selectedAttachments = [];
                            renderAttachments();
                            setHomeMode(false);
                            return;
                        }

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

                    // Send button click handler
                    document.getElementById('send-btn').addEventListener('click', send);

                    // Input box keydown handler
                    inputBox.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                    });

                    // Recent tasks list click handler
                    if (recentTasksList) {
                        recentTasksList.addEventListener('click', event => {
                            const target = event.target;
                            if (!target || !(target instanceof Element)) {
                                return;
                            }

                            const item = target.closest('[data-recent-session-id]');
                            if (!item || isThinking) {
                                return;
                            }

                            const sessionId = item.getAttribute('data-recent-session-id') || '';
                            if (!sessionId) {
                                return;
                            }

                            vscode.postMessage({ type: 'session-switch', value: { sessionId } });
                            setHomeMode(false);
                        });
                    }

                    // Handle paste event for attachments
                    inputBox.addEventListener('paste', event => {
                        if (isThinking) {
                            return;
                        }

                        const items = event.clipboardData && event.clipboardData.items
                            ? event.clipboardData.items
                            : [];
                        
                        if (items.length === 0) {
                            return;
                        }

                        const files = [];
                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            if (item && item.kind === 'file' && item.type) {
                                const file = item.getAsFile();
                                if (file) {
                                    files.push(file);
                                }
                            }
                        }

                        if (files.length === 0) {
                            return;
                        }

                        // Convert webkitRelativePath if available
                        const attachments = files.map(file => ({
                            path: file.webkitRelativePath || file.name,
                            name: file.name,
                            size: file.size,
                        }));

                        const mergeResult = mergeAttachments(attachments);
                        renderAttachments();
                        if (mergeResult.hiddenByLimit > 0) {
                            showHintMessage('Only first 8 attachments kept', 2500);
                        }
                    });
`;
