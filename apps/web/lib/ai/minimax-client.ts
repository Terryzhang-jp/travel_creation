/**
 * MiniMax API Client
 *
 * 用于调用 MiniMax 视觉 AI 进行照片分析
 * 文档: https://platform.minimaxi.com/document/guides/chat-model/vision
 */

export interface MiniMaxConfig {
  apiKey: string;
  groupId: string;
  model?: string;
  timeout?: number;
}

export interface MiniMaxMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
}

export interface MiniMaxResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    total_tokens: number;
  };
}

const DEFAULT_MODEL = 'abab6.5s-chat';
const DEFAULT_TIMEOUT = 30000;
const API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';

/**
 * MiniMax API 客户端
 */
export class MiniMaxClient {
  private config: Required<MiniMaxConfig>;

  constructor(config: MiniMaxConfig) {
    this.config = {
      apiKey: config.apiKey,
      groupId: config.groupId,
      model: config.model || DEFAULT_MODEL,
      timeout: config.timeout || DEFAULT_TIMEOUT,
    };
  }

  /**
   * 分析图片
   */
  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    const messages: MiniMaxMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: prompt },
        ],
      },
    ];

    const response = await this.chat(messages);
    return response;
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: MiniMaxMessage[]): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          max_tokens: 1024,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
      }

      const data: MiniMaxResponse = await response.json();

      if (!data.choices?.[0]?.message?.content) {
        throw new Error('MiniMax API returned empty response');
      }

      return data.choices[0].message.content;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('MiniMax API request timeout');
      }
      throw error;
    }
  }
}

/**
 * 创建默认客户端实例
 */
export function createMiniMaxClient(): MiniMaxClient | null {
  const apiKey = process.env.MINIMAX_API_KEY;
  const groupId = process.env.MINIMAX_GROUP_ID;

  if (!apiKey || !groupId) {
    console.warn('[MiniMax] Missing API key or group ID');
    return null;
  }

  return new MiniMaxClient({ apiKey, groupId });
}
