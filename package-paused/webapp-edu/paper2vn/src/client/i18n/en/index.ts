import type { BaseTranslation, } from '../i18n-types.ts';

/**
 * English (base locale) translations.
 */
const en = {
  appName: 'paper2vn',
  start: 'Start',
  saves: 'Saves',
  settings: 'Settings',
  community: 'About',
  selectTopic: 'Select Paper',
  selectTopicHint: 'Upload a PDF, TXT, or Markdown paper, or paste raw text.',
  upload: 'Upload paper',
  uploadAccept: '.pdf,.txt,.md,text/plain,text/markdown,application/pdf',
  pasteText: 'Or paste paper text',
  pasteTextPlaceholder: 'Paste the paper text here...',
  startLecture: 'Start lecture',
  back: 'Back',
  auto: 'Auto',
  log: 'Log',
  hide: 'Hide',
  ask: 'Ask',
  next: 'Next',
  askPrompt: 'Ask a question about this paper',
  askPlaceholder: 'Type your question; the persona answers from the paper.',
  askSend: 'Send',
  askThinking: 'Thinking...',
  generating: 'Generating chapters...',
  generationError: 'Generation failed: ',
  apiKeyMissing:
    'No API key configured. Open Settings to add one before starting a lecture.',
  configureProvider: 'Configure provider',
  saveSlot: 'Save slot',
  newSave: 'New save',
  loadSave: 'Load',
  deleteSave: 'Delete',
  noSaves: 'No saves yet.',
  language: 'Language',
  voiceVolume: 'Voice volume',
  bgmVolume: 'BGM volume',
  textSpeed: 'Text speed',
  fontSize: 'Font size',
  autoAdvanceDelay: 'Auto-advance delay',
  voiceEnabled: 'Read dialogue aloud',
  provider: 'Provider',
  providerOpenrouter: 'OpenRouter',
  providerOpenai: 'OpenAI',
  providerAnthropic: 'Anthropic',
  providerOllama: 'Ollama (local)',
  model: 'Model',
  apiKey: 'API key',
  apiKeyHint: 'Stored in localStorage. Never leaves the browser except to your provider.',
  baseUrl: 'Base URL',
  baseUrlHint: 'Defaults to provider standard. Override for self-hosted endpoints.',
  saveAndClose: 'Save and close',
  anthropicWarning:
    'Anthropic blocks browser CORS by default. Enabling this mode adds dangerous-direct-browser-access headers; the request is technically supported but Anthropic recommends against it.',
  anthropicAccept: 'I understand, enable browser-direct mode',
  memoryLog: 'Memory log',
  noLog: 'Log is empty.',
  speakerYou: 'You',
  defaultPaperTitle: 'Untitled paper',
  persona:
    'You are Ruka, a soft-spoken classroom tutor who reads academic papers aloud to her single student ("Master"). You are precise, gently enthusiastic, and faithful to the source material. You never invent results that are not in the paper.',
  chapterInstruction:
    'Split the paper into 3 to 8 chapters that follow the paper\'s logical structure. Return JSON with shape `{ "title": string, "chapters": [{ "title": string, "summary": string, "dialogue": [{ "text": string, "pose": "neutral" | "thinking" | "happy" }] }] }`. Each chapter should have 3 to 6 dialogue beats; each beat is one to three sentences.',
  askInstruction:
    "Answer the user's question grounded in the paper text below. If the paper does not address the question, say so plainly in character.",
} satisfies BaseTranslation;

export default en;
