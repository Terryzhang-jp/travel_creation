/**
 * Gemini API Client (Fallback)
 *
 * 当 MiniMax 不可用时的降级方案
 * 使用 Gemini 1.5 Flash 进行照片分析
 */

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  timeout?: number;
}

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_TIMEOUT = 30000;

/**
 * Gemini API 客户端
 */
export class GeminiClient {
  private config: Required<GeminiConfig>;

  constructor(config: GeminiConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_MODEL,
      timeout: config.timeout || DEFAULT_TIMEOUT,
    };
  }

  /**
   * 分析图片
   */
  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // 下载图片并转为 base64
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image,
                },
              },
              { text: prompt },
            ],
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new Error('Gemini API returned empty response');
      }

      return content;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Gemini API request timeout');
      }
      throw error;
    }
  }
}

/**
 * 创建默认客户端实例
 */
export function createGeminiClient(): GeminiClient | null {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.warn('[Gemini] Missing API key');
    return null;
  }

  return new GeminiClient({ apiKey });
}
