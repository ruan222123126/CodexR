import type { SupportedLanguage, TranslationStrings } from '../types';
import { en } from './en';
import { zhCN } from './zh-CN';

/**
 * Locale registry mapping language codes to translation objects
 */
export const locales: Record<SupportedLanguage, TranslationStrings> = {
    'en': en,
    'zh-CN': zhCN,
};
