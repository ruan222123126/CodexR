/**
 * Attachment Manager Module
 * Handles attachment management functionality including merging, removing, and rendering
 */

export const ATTACHMENT_MANAGER_SCRIPT = `
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
`;
