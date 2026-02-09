export const SEGMENT_PARSER = `
                    function parseExecSummary(summaryLine) {
                        let cleaned = trimWrapper(summaryLine).trim();
                        if (cleaned.toLowerCase().startsWith('exec ')) {
                            cleaned = cleaned.slice(5).trim();
                        }

                        const lower = cleaned.toLowerCase();
                        let status = '';
                        let marker = '';
                        let exitCode = '';

                        if (lower.includes(' succeeded in ')) {
                            status = 'succeeded';
                            marker = ' succeeded in ';
                        } else if (lower.includes(' failed in ')) {
                            status = 'failed';
                            marker = ' failed in ';
                        } else if (lower.includes(' exited ')) {
                            status = 'failed';
                            marker = ' exited ';
                        }

                        if (marker) {
                            const markerIndex = lower.lastIndexOf(marker);
                            const beforeStatus = cleaned.slice(0, markerIndex).trim();
                            const afterStatus = cleaned.slice(markerIndex + marker.length).trim();

                            let durationRaw = afterStatus;
                            if (marker === ' exited ') {
                                const afterLower = afterStatus.toLowerCase();
                                const inIndex = afterLower.indexOf(' in ');
                                if (inIndex !== -1) {
                                    exitCode = afterStatus.slice(0, inIndex).trim();
                                    durationRaw = afterStatus.slice(inIndex + 4).trim();
                                } else {
                                    exitCode = afterStatus.trim();
                                    durationRaw = '';
                                }
                                if (exitCode === '0') {
                                    status = 'succeeded';
                                }
                            }

                            const duration = durationRaw.endsWith(':') ? durationRaw.slice(0, -1).trim() : durationRaw;

                            const beforeLower = beforeStatus.toLowerCase();
                            const inMarker = ' in ';
                            const inIndex = beforeLower.lastIndexOf(inMarker);

                            let rawCommand = beforeStatus;
                            let cwd = '';
                            if (inIndex > 0) {
                                rawCommand = beforeStatus.slice(0, inIndex).trim();
                                cwd = beforeStatus.slice(inIndex + inMarker.length).trim();
                            }

                            const commandInfo = extractCommandInfo(rawCommand);

                            return {
                                runnerLabel: commandInfo.runnerLabel,
                                command: commandInfo.command,
                                cwd,
                                status,
                                duration,
                                exitCode,
                                output: '',
                            };
                        }

                        const fallbackInfo = extractCommandInfo(cleaned || '(empty command)');
                        return {
                            runnerLabel: fallbackInfo.runnerLabel,
                            command: fallbackInfo.command,
                            cwd: '',
                            status: '',
                            duration: '',
                            exitCode: '',
                            output: '',
                        };
                    }

                    function extractCommandInfo(rawCommand) {
                        const cleaned = String(rawCommand || '').trim();
                        const lower = cleaned.toLowerCase();

                        const stripQuote = (value) => {
                            const text = String(value || '').trim();
                            if (text.length < 2) {
                                return text;
                            }
                            const first = text[0];
                            const last = text[text.length - 1];
                            const isSingleQuoted = first.charCodeAt(0) === 39 && last.charCodeAt(0) === 39;
                            const isDoubleQuoted = first.charCodeAt(0) === 34 && last.charCodeAt(0) === 34;
                            if (isSingleQuoted || isDoubleQuoted) {
                                return text.slice(1, -1).trim();
                            }
                            return text;
                        };

                        const removeRunner = (text) => {
                            const value = String(text || '').trim();
                            const firstSpace = value.indexOf(' ');
                            if (firstSpace === -1) {
                                return '';
                            }
                            return value.slice(firstSpace + 1).trim();
                        };

                        const fromSwitch = (text, switches) => {
                            const value = String(text || '').trim();
                            if (!value) {
                                return value;
                            }
                            const valueLower = value.toLowerCase();

                            for (const sw of switches) {
                                const key = sw.toLowerCase();
                                const patterns = [key + ' ', key + ':'];
                                for (const pattern of patterns) {
                                    const idx = valueLower.indexOf(pattern);
                                    if (idx !== -1) {
                                        return stripQuote(value.slice(idx + pattern.length).trim());
                                    }
                                }
                            }

                            return stripQuote(value);
                        };

                        if (lower.startsWith('powershell.exe') || lower.startsWith('pwsh') || lower.startsWith('powershell ')) {
                            const rest = removeRunner(cleaned);
                            return {
                                runnerLabel: 'PowerShell',
                                command: fromSwitch(rest, ['-command', '-c']) || cleaned,
                            };
                        }

                        if (lower.startsWith('cmd.exe') || lower.startsWith('cmd ')) {
                            const cmdBody = removeRunner(cleaned);
                            const cmdLower = cmdBody.toLowerCase();
                            let commandText = cmdBody;
                            const cIndex = cmdLower.indexOf('/c ');
                            const kIndex = cmdLower.indexOf('/k ');

                            if (cIndex !== -1) {
                                commandText = cmdBody.slice(cIndex + 3).trim();
                            } else if (kIndex !== -1) {
                                commandText = cmdBody.slice(kIndex + 3).trim();
                            }

                            return {
                                runnerLabel: 'CMD',
                                command: stripQuote(commandText || cmdBody || cleaned),
                            };
                        }

                        if (lower.startsWith('bash') || lower.startsWith('/bin/bash')) {
                            const rest = removeRunner(cleaned);
                            return {
                                runnerLabel: 'Bash',
                                command: fromSwitch(rest, ['-c']) || cleaned,
                            };
                        }

                        if (lower.startsWith('zsh') || lower.startsWith('/bin/zsh')) {
                            const rest = removeRunner(cleaned);
                            return {
                                runnerLabel: 'Zsh',
                                command: fromSwitch(rest, ['-c']) || cleaned,
                            };
                        }

                        if (lower === 'sh' || lower.startsWith('sh ') || lower.startsWith('/bin/sh')) {
                            const rest = removeRunner(cleaned);
                            return {
                                runnerLabel: 'Shell',
                                command: fromSwitch(rest, ['-c']) || cleaned,
                            };
                        }

                        if (lower.startsWith('python ') || lower.startsWith('python3 ')) {
                            const rest = removeRunner(cleaned);
                            return {
                                runnerLabel: 'Python',
                                command: fromSwitch(rest, ['-c']) || cleaned,
                            };
                        }

                        if (lower.startsWith('node ')) {
                            const rest = removeRunner(cleaned);
                            return {
                                runnerLabel: 'Node',
                                command: fromSwitch(rest, ['-e']) || cleaned,
                            };
                        }

                        return {
                            runnerLabel: 'Command',
                            command: cleaned || '(empty command)',
                        };
                    }

                    function parseThinkingParts(thoughtText) {
                        const normalizedText = filterCodexThinkingNoiseText(thoughtText);
                        if (!normalizedText.trim()) {
                            return [];
                        }

                        const lines = normalizedText.split(String.fromCharCode(10));
                        const parts = [];
                        const textBuffer = [];

                        const flushText = () => {
                            const raw = textBuffer.join(String.fromCharCode(10)).trim();
                            textBuffer.length = 0;
                            if (raw) {
                                parts.push({ type: 'text', value: raw });
                            }
                        };

                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i];
                            const trimmed = line.trim();

                            if (!trimmed) {
                                textBuffer.push(line);
                                continue;
                            }

                            if (isCodexThinkingNoiseLine(trimmed)) {
                                continue;
                            }

                            if (isExecStart(trimmed)) {
                                flushText();

                                const entry = parseExecSummary(line);
                                const outputLines = [];

                                for (let j = i + 1; j < lines.length; j++) {
                                    const current = lines[j];
                                    const currentTrimmed = current.trim();

                                    if (!currentTrimmed) {
                                        if (outputLines.length > 0) {
                                            outputLines.push('');
                                        }
                                        continue;
                                    }

                                    if (isBoundary(currentTrimmed) || currentTrimmed.toLowerCase().startsWith('codex') || isThoughtStepLine(currentTrimmed)) {
                                        break;
                                    }

                                    const lower = currentTrimmed.toLowerCase();
                                    const isSummary = lower.includes(' succeeded in ') || lower.includes(' failed in ') || lower.includes(' exited ');
                                    if (isSummary) {
                                        const summaryEntry = parseExecSummary(currentTrimmed);
                                        if (summaryEntry.status) {
                                            entry.status = summaryEntry.status;
                                        }
                                        if (summaryEntry.duration) {
                                            entry.duration = summaryEntry.duration;
                                        }
                                        if (summaryEntry.exitCode) {
                                            entry.exitCode = summaryEntry.exitCode;
                                        }
                                        i = j;
                                        continue;
                                    }

                                    outputLines.push(current);
                                    i = j;
                                }

                                entry.output = outputLines.join(String.fromCharCode(10)).trim();
                                parts.push({ type: 'exec', value: entry });
                                continue;
                            }

                            if (isPatchStart(trimmed)) {
                                flushText();

                                const patchEntry = {
                                    added: 0,
                                    updated: 0,
                                    deleted: 0,
                                    moved: 0,
                                    hunks: 0,
                                    additions: 0,
                                    deletions: 0,
                                    files: [],
                                };

                                let foundEnd = false;

                                for (let j = i; j < lines.length; j++) {
                                    const currentLine = lines[j];
                                    const current = currentLine.trim();

                                    if (current.startsWith('*** Add File:')) {
                                        patchEntry.added += 1;
                                        patchEntry.files.push('+ ' + current.slice('*** Add File:'.length).trim());
                                    }
                                    if (current.startsWith('*** Update File:')) {
                                        patchEntry.updated += 1;
                                        patchEntry.files.push('~ ' + current.slice('*** Update File:'.length).trim());
                                    }
                                    if (current.startsWith('*** Delete File:')) {
                                        patchEntry.deleted += 1;
                                        patchEntry.files.push('- ' + current.slice('*** Delete File:'.length).trim());
                                    }
                                    if (current.startsWith('*** Move to:')) {
                                        patchEntry.moved += 1;
                                        patchEntry.files.push('> ' + current.slice('*** Move to:'.length).trim());
                                    }
                                    if (current.startsWith('@@')) {
                                        patchEntry.hunks += 1;
                                    }
                                    if (currentLine.startsWith('+') && !current.startsWith('+++')) {
                                        patchEntry.additions += 1;
                                    }
                                    if (currentLine.startsWith('-') && !current.startsWith('---')) {
                                        patchEntry.deletions += 1;
                                    }

                                    if (current.startsWith('*** End Patch')) {
                                        i = j;
                                        foundEnd = true;
                                        break;
                                    }

                                    if (j > i && isBoundary(current)) {
                                        i = j - 1;
                                        break;
                                    }

                                    if (j === lines.length - 1) {
                                        i = j;
                                    }
                                }

                                if (!foundEnd && patchEntry.added === 0 && patchEntry.updated === 0 && patchEntry.deleted === 0 && patchEntry.moved === 0) {
                                    patchEntry.updated = 1;
                                }

                                parts.push({ type: 'patch', value: patchEntry });
                                continue;
                            }

                            textBuffer.push(line);
                        }

                        flushText();

                        return parts;
                    }

                    function parseStreamSegments(segments, fallbackThoughtText) {
                        if (!Array.isArray(segments) || segments.length === 0) {
                            return parseThinkingParts(fallbackThoughtText);
                        }

                        const parts = [];
                        for (const segment of segments) {
                            if (!segment || segment.phase !== 'thinking') {
                                continue;
                            }

                            if (segment.type === 'text' || segment.type === 'error') {
                                const value = filterCodexThinkingNoiseText(String(segment.value || '')).trim();
                                if (value) {
                                    parts.push({ type: 'text', value: value });
                                }
                                continue;
                            }

                            if (segment.type === 'exec') {
                                const value = segment.value || {};
                                parts.push({
                                    type: 'exec',
                                    value: {
                                        runnerLabel: String(value.runnerLabel || 'Command'),
                                        command: String(value.command || '(empty command)'),
                                        cwd: String(value.cwd || ''),
                                        status: String(value.status || ''),
                                        duration: String(value.duration || ''),
                                        exitCode: String(value.exitCode || ''),
                                        output: String(value.output || ''),
                                    },
                                });
                                continue;
                            }

                            if (segment.type === 'patch') {
                                const value = segment.value || {};
                                parts.push({
                                    type: 'patch',
                                    value: {
                                        added: Number(value.added || 0),
                                        updated: Number(value.updated || 0),
                                        deleted: Number(value.deleted || 0),
                                        moved: Number(value.moved || 0),
                                        hunks: Number(value.hunks || 0),
                                        additions: Number(value.additions || 0),
                                        deletions: Number(value.deletions || 0),
                                        files: Array.isArray(value.files) ? value.files.map(item => String(item)) : [],
                                    },
                                });
                            }
                        }

                        if (parts.length > 0) {
                            return parts;
                        }

                        return parseThinkingParts(fallbackThoughtText);
                    }

                    function countToolUsage(segments, fallbackThoughtText) {
                        if (Array.isArray(segments) && segments.length > 0) {
                            const countFromSegments = segments
                                .filter(segment => segment && segment.phase === 'thinking' && (segment.type === 'exec' || segment.type === 'patch'))
                                .length;

                            if (countFromSegments > 0) {
                                return countFromSegments;
                            }
                        }

                        const fallbackParts = parseThinkingParts(fallbackThoughtText);
                        return fallbackParts.filter(part => part && (part.type === 'exec' || part.type === 'patch')).length;
                    }

                    function extractAnswerTextFromSegments(segments) {
                        if (!Array.isArray(segments) || segments.length === 0) {
                            return '';
                        }

                        const answerText = segments
                            .filter(segment => segment && segment.phase === 'answer' && segment.type === 'text')
                            .map(segment => String(segment.value || '').trim())
                            .filter(Boolean)
                            .join(String.fromCharCode(10) + String.fromCharCode(10))
                            .trim();

                        if (answerText) {
                            return answerText;
                        }

                        return segments
                            .filter(segment => segment && segment.type === 'error')
                            .map(segment => String(segment.value || '').trim())
                            .filter(Boolean)
                            .join(String.fromCharCode(10))
                            .trim();
                    }
`;
