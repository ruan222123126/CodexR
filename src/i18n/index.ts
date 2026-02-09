import type { SupportedLanguage, TranslationStrings } from './types';
import { locales } from './locales';

export type { SupportedLanguage, TranslationStrings };

/**
 * Get all translations for a specific language
 * Falls back to English if the language is not supported
 */
export function getTranslations(lang: SupportedLanguage): TranslationStrings {
    return locales[lang] || locales['en'];
}

/**
 * Get a single translation string
 * Falls back to English if the language is not supported
 */
export function t(key: keyof TranslationStrings, lang: SupportedLanguage): string {
    const translations = getTranslations(lang);
    return translations[key] || locales['en'][key] || key;
}

/**
 * Normalize a language value to a supported language
 */
export function normalizeLanguage(value: unknown): SupportedLanguage {
    if (value === 'zh-CN') {
        return 'zh-CN';
    }
    return 'en';
}
