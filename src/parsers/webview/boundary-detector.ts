export const BOUNDARY_DETECTOR = `
                    function trimWrapper(line) {
                        return line.trim()
                            .replace(/^[([{]+/, '')
                            .replace(/[)\]}]+$/, '')
                            .trim();
                    }

                    function isExecStart(line) {
                        const normalized = trimWrapper(line).toLowerCase();
                        return normalized === 'exec' || normalized.startsWith('exec ');
                    }

                    function isPatchStart(line) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('*** Begin Patch')) {
                            return true;
                        }

                        const normalized = trimmed.toLowerCase();
                        return normalized.startsWith('apply_patch') || normalized.startsWith('exec apply_patch');
                    }

                    function isBoundary(line) {
                        const trimmed = line.trim();
                        if (!trimmed) {
                            return false;
                        }
                        return isExecStart(trimmed) || isPatchStart(trimmed);
                    }

                    function isThoughtStepLine(line) {
                        const trimmed = line.trim();
                        if (!trimmed) {
                            return false;
                        }
                        if (trimmed.toLowerCase() === 'thinking') {
                            return true;
                        }
                        return trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4;
                    }
`;
