/**
 * Drop Handler Module
 * Handles drag and drop functionality for file attachments
 */

export const DROP_HANDLER_SCRIPT = `
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

                    // Drag and drop event listeners
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
`;
