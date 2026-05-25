// Types for paper2vn translations. Hand-authored to match the
// typesafe-i18n generator output so the file can later be regenerated
// in place when a typesafe-i18n CLI task is added to mise.
/* eslint-disable */

import type {
  BaseTranslation as BaseTranslationType,
  LocalizedString,
} from 'typesafe-i18n';

export type BaseTranslation = BaseTranslationType;
export type BaseLocale = 'en';

export type Locales =
  | 'en'
  | 'zh'
  | 'ja'
  | 'ru';

export type Translation = RootTranslation;

export type Translations = RootTranslation;

type RootTranslation = {
  /** App display name. */
  appName: string;
  /** Main menu: Start. */
  start: string;
  /** Main menu: Saves. */
  saves: string;
  /** Main menu: Settings. */
  settings: string;
  /** Main menu: About / community. */
  community: string;
  /** Select-paper screen heading. */
  selectTopic: string;
  /** Select-paper hint copy. */
  selectTopicHint: string;
  /** Upload button label. */
  upload: string;
  /** File input accept= attribute. */
  uploadAccept: string;
  /** Paste-text section label. */
  pasteText: string;
  /** Paste-text textarea placeholder. */
  pasteTextPlaceholder: string;
  /** Submit-paper button. */
  startLecture: string;
  /** Lecture toolbar Back. */
  back: string;
  /** Lecture toolbar Auto. */
  auto: string;
  /** Lecture toolbar Log. */
  log: string;
  /** Lecture toolbar Hide. */
  hide: string;
  /** Lecture toolbar Ask. */
  ask: string;
  /** Generic Next button. */
  next: string;
  /** Ask form heading. */
  askPrompt: string;
  /** Ask textarea placeholder. */
  askPlaceholder: string;
  /** Ask submit button. */
  askSend: string;
  /** Ask in-flight indicator. */
  askThinking: string;
  /** Chapter-generation in-flight message. */
  generating: string;
  /** Chapter-generation error prefix. */
  generationError: string;
  /** Missing-API-key warning. */
  apiKeyMissing: string;
  /** Configure-provider button. */
  configureProvider: string;
  /** Save slot row prefix. */
  saveSlot: string;
  /** New save button. */
  newSave: string;
  /** Load existing save button. */
  loadSave: string;
  /** Delete save button. */
  deleteSave: string;
  /** Empty-saves-list message. */
  noSaves: string;
  /** Settings: language. */
  language: string;
  /** Settings: voice volume. */
  voiceVolume: string;
  /** Settings: BGM volume. */
  bgmVolume: string;
  /** Settings: text speed. */
  textSpeed: string;
  /** Settings: font size. */
  fontSize: string;
  /** Settings: auto-advance delay. */
  autoAdvanceDelay: string;
  /** Settings: voice toggle. */
  voiceEnabled: string;
  /** Settings: provider section label. */
  provider: string;
  /** Provider name: OpenRouter. */
  providerOpenrouter: string;
  /** Provider name: OpenAI. */
  providerOpenai: string;
  /** Provider name: Anthropic. */
  providerAnthropic: string;
  /** Provider name: Ollama. */
  providerOllama: string;
  /** Settings: model. */
  model: string;
  /** Settings: API key. */
  apiKey: string;
  /** Settings: API key explanatory hint. */
  apiKeyHint: string;
  /** Settings: base URL override. */
  baseUrl: string;
  /** Settings: base URL hint. */
  baseUrlHint: string;
  /** Settings: save and close button. */
  saveAndClose: string;
  /** Settings: Anthropic CORS warning copy. */
  anthropicWarning: string;
  /** Settings: Anthropic warning accept toggle label. */
  anthropicAccept: string;
  /** Memory-log screen heading. */
  memoryLog: string;
  /** Memory-log empty message. */
  noLog: string;
  /** Speaker name shown for the human user in the log. */
  speakerYou: string;
  /** Fallback paper title when the LLM omits one. */
  defaultPaperTitle: string;
  /** System-prompt persona description sent to the LLM. */
  persona: string;
  /** System-prompt instruction for the chapter-generation call. */
  chapterInstruction: string;
  /** System-prompt instruction for the Ask call. */
  askInstruction: string;
};

export type TranslationFunctions = {
  appName: () => LocalizedString;
  start: () => LocalizedString;
  saves: () => LocalizedString;
  settings: () => LocalizedString;
  community: () => LocalizedString;
  selectTopic: () => LocalizedString;
  selectTopicHint: () => LocalizedString;
  upload: () => LocalizedString;
  uploadAccept: () => LocalizedString;
  pasteText: () => LocalizedString;
  pasteTextPlaceholder: () => LocalizedString;
  startLecture: () => LocalizedString;
  back: () => LocalizedString;
  auto: () => LocalizedString;
  log: () => LocalizedString;
  hide: () => LocalizedString;
  ask: () => LocalizedString;
  next: () => LocalizedString;
  askPrompt: () => LocalizedString;
  askPlaceholder: () => LocalizedString;
  askSend: () => LocalizedString;
  askThinking: () => LocalizedString;
  generating: () => LocalizedString;
  generationError: () => LocalizedString;
  apiKeyMissing: () => LocalizedString;
  configureProvider: () => LocalizedString;
  saveSlot: () => LocalizedString;
  newSave: () => LocalizedString;
  loadSave: () => LocalizedString;
  deleteSave: () => LocalizedString;
  noSaves: () => LocalizedString;
  language: () => LocalizedString;
  voiceVolume: () => LocalizedString;
  bgmVolume: () => LocalizedString;
  textSpeed: () => LocalizedString;
  fontSize: () => LocalizedString;
  autoAdvanceDelay: () => LocalizedString;
  voiceEnabled: () => LocalizedString;
  provider: () => LocalizedString;
  providerOpenrouter: () => LocalizedString;
  providerOpenai: () => LocalizedString;
  providerAnthropic: () => LocalizedString;
  providerOllama: () => LocalizedString;
  model: () => LocalizedString;
  apiKey: () => LocalizedString;
  apiKeyHint: () => LocalizedString;
  baseUrl: () => LocalizedString;
  baseUrlHint: () => LocalizedString;
  saveAndClose: () => LocalizedString;
  anthropicWarning: () => LocalizedString;
  anthropicAccept: () => LocalizedString;
  memoryLog: () => LocalizedString;
  noLog: () => LocalizedString;
  speakerYou: () => LocalizedString;
  defaultPaperTitle: () => LocalizedString;
  persona: () => LocalizedString;
  chapterInstruction: () => LocalizedString;
  askInstruction: () => LocalizedString;
};

export type Formatters = {};
