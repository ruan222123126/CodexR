/**
 * Input Modules Index
 * Exports all input-related script modules
 */

import { ATTACHMENT_MANAGER_SCRIPT } from './attachment-manager';
import { DROP_HANDLER_SCRIPT } from './drop-handler';
import { INPUT_EVENTS_SCRIPT } from './input-events';

export {
    ATTACHMENT_MANAGER_SCRIPT,
    DROP_HANDLER_SCRIPT,
    INPUT_EVENTS_SCRIPT
};

export const INPUT_MODULES = [
    ATTACHMENT_MANAGER_SCRIPT,
    DROP_HANDLER_SCRIPT,
    INPUT_EVENTS_SCRIPT
].join('\n');
