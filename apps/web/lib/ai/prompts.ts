/**
 * AI Prompt Templates
 *
 * 用于照片分析和标签生成的 Prompt 模板
 */

/**
 * 照片标签生成 Prompt
 */
export const PHOTO_TAGGING_PROMPT = `你是一个专业的照片分析助手，帮助用户整理旅行素材库。

请分析这张照片，生成以下信息：

## 标签要求
生成不少于 8 个标签，必须覆盖以下维度（每个维度 1-3 个标签）：

1. 【场景类型】这是什么地方？如：海滩、咖啡馆、古镇、博物馆、街道、酒店
2. 【氛围情绪】给人什么感觉？如：宁静、浪漫、热闹、治愈、壮观、神秘
3. 【时间光线】什么时间/光线？如：黄金时刻、夜景、自然光、逆光、阴天、日出
4. 【色彩基调】整体色彩？如：暖色调、冷色调、高饱和、柔和、黑白、复古
5. 【内容主体】画面主体？如：人物、美食、建筑、自然风光、动物、静物
6. 【构图风格】拍摄方式？如：特写、全景、对称、俯拍、仰拍、极简
7. 【创作适用】适合怎么用？如：适合封面、适合背景、适合配图、适合竖版、适合横版
8. 【补充标签】其他显著特征，自由发挥

## 自由描述
用一句话（30-60字）描述这张照片的内容和氛围，要具体生动，便于后续搜索。

## 输出格式
请严格按照以下 JSON 格式输出，不要输出其他内容：

{
  "tags": {
    "scene": ["标签1", "标签2"],
    "mood": ["标签1"],
    "lighting": ["标签1"],
    "color": ["标签1"],
    "subject": ["标签1", "标签2"],
    "composition": ["标签1"],
    "usage": ["标签1"],
    "extra": ["标签1", "标签2"]
  },
  "description": "一句话描述..."
}`;

/**
 * 标签结构类型
 */
export interface PhotoTags {
  scene: string[];
  mood: string[];
  lighting: string[];
  color: string[];
  subject: string[];
  composition: string[];
  usage: string[];
  extra: string[];
}

/**
 * AI 分析结果类型
 */
export interface PhotoAnalysisResult {
  tags: PhotoTags;
  description: string;
}

/**
 * 验证标签结构是否有效
 */
function isValidPhotoTags(tags: unknown): tags is Partial<PhotoTags> {
  if (!tags || typeof tags !== 'object') return false;
  const tagObj = tags as Record<string, unknown>;

  // 检查每个存在的字段是否为数组
  const tagFields = ['scene', 'mood', 'lighting', 'color', 'subject', 'composition', 'usage', 'extra'];
  for (const field of tagFields) {
    if (field in tagObj && !Array.isArray(tagObj[field])) {
      return false;
    }
  }
  return true;
}

/**
 * 验证并解析 AI 响应
 */
export function parsePhotoAnalysisResponse(response: string): PhotoAnalysisResult | null {
  try {
    // 尝试提取 JSON（处理可能的 markdown 代码块）
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // 验证结构
    if (!parsed.tags || !parsed.description) {
      console.warn('[parsePhotoAnalysisResponse] Invalid structure: missing tags or description');
      return null;
    }

    // 使用类型守卫验证 tags 结构
    if (!isValidPhotoTags(parsed.tags)) {
      console.warn('[parsePhotoAnalysisResponse] Invalid tags structure: tag fields must be arrays');
      return null;
    }

    // 确保所有标签维度存在
    const defaultTags: PhotoTags = {
      scene: [],
      mood: [],
      lighting: [],
      color: [],
      subject: [],
      composition: [],
      usage: [],
      extra: [],
    };

    return {
      tags: { ...defaultTags, ...parsed.tags },
      description: String(parsed.description),
    };
  } catch (error) {
    console.warn('[parsePhotoAnalysisResponse] Failed to parse response:', error);
    return null;
  }
}
