/**
 * Photo Tagger Service
 *
 * 核心标签生成服务，协调 AI 客户端进行照片分析
 */

import { createMiniMaxClient, type MiniMaxClient } from './minimax-client';
import { createGeminiClient, type GeminiClient } from './gemini-client';
import { PHOTO_TAGGING_PROMPT, parsePhotoAnalysisResponse, type PhotoAnalysisResult } from './prompts';

export interface TaggingResult {
  success: boolean;
  data?: PhotoAnalysisResult;
  model?: string;
  error?: string;
}

/**
 * Photo Tagger 服务
 */
export class PhotoTagger {
  private minimax: MiniMaxClient | null;
  private gemini: GeminiClient | null;

  constructor() {
    this.minimax = createMiniMaxClient();
    this.gemini = createGeminiClient();
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.minimax !== null || this.gemini !== null;
  }

  /**
   * 分析单张照片
   */
  async analyzePhoto(imageUrl: string): Promise<TaggingResult> {
    // 优先使用 MiniMax
    if (this.minimax) {
      try {
        const response = await this.minimax.analyzeImage(imageUrl, PHOTO_TAGGING_PROMPT);
        const parsed = parsePhotoAnalysisResponse(response);

        if (parsed) {
          return {
            success: true,
            data: parsed,
            model: 'minimax',
          };
        }

        // 解析失败，尝试降级
        console.warn('[PhotoTagger] MiniMax response parse failed, trying Gemini');
      } catch (error) {
        console.error('[PhotoTagger] MiniMax error:', error);
      }
    }

    // 降级到 Gemini
    if (this.gemini) {
      try {
        const response = await this.gemini.analyzeImage(imageUrl, PHOTO_TAGGING_PROMPT);
        const parsed = parsePhotoAnalysisResponse(response);

        if (parsed) {
          return {
            success: true,
            data: parsed,
            model: 'gemini',
          };
        }

        return {
          success: false,
          error: 'Failed to parse Gemini response',
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: `Gemini error: ${errorMessage}`,
        };
      }
    }

    return {
      success: false,
      error: 'No AI service available',
    };
  }

  /**
   * 批量分析照片
   */
  async analyzePhotos(
    imageUrls: string[],
    options: {
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<Map<string, TaggingResult>> {
    const { concurrency = 3, onProgress } = options;
    const results = new Map<string, TaggingResult>();
    let completed = 0;

    // 分批处理
    for (let i = 0; i < imageUrls.length; i += concurrency) {
      const batch = imageUrls.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (url) => {
          const result = await this.analyzePhoto(url);
          return { url, result };
        })
      );

      for (const { url, result } of batchResults) {
        results.set(url, result);
        completed++;
        onProgress?.(completed, imageUrls.length);
      }

      // 批次间隔，避免触发限流
      if (i + concurrency < imageUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }
}

/**
 * 默认实例
 */
let photoTaggerInstance: PhotoTagger | null = null;

export function getPhotoTagger(): PhotoTagger {
  if (!photoTaggerInstance) {
    photoTaggerInstance = new PhotoTagger();
  }
  return photoTaggerInstance;
}
