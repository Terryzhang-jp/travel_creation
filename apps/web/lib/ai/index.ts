/**
 * AI Module
 *
 * 导出所有 AI 相关功能
 */

export { PhotoTagger, getPhotoTagger, type TaggingResult } from './photo-tagger';
export { MiniMaxClient, createMiniMaxClient } from './minimax-client';
export { GeminiClient, createGeminiClient } from './gemini-client';
export {
  PHOTO_TAGGING_PROMPT,
  parsePhotoAnalysisResponse,
  type PhotoTags,
  type PhotoAnalysisResult,
} from './prompts';
