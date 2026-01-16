/**
 * AI Prompt Templates
 *
 * 用于照片分析和标签生成的 Prompt 模板
 */

/**
 * 照片标签生成 Prompt
 */
export const PHOTO_TAGGING_PROMPT = `你是一个专业的照片分析助手，帮助用户整理旅行素材库。

请仔细观察这张照片，识别并分析其中的所有可见元素。

## 标签要求
生成不少于 10 个标签，必须覆盖以下维度：

1. 【具体识别】这具体是什么？尽可能精确识别（2-4个标签）
   - 地点：具体地标名称（如：浅草寺、清水寺、东京塔、富士山）
   - 建筑风格：具体风格（如：唐破风、千鸟破风、入母屋造、和风建筑、哥特式）
   - 物品/元素：可识别的具体元素（如：族徽/家纹、灯笼、鸟居、石狮、注连绳）
   - 文字：画面中可见的文字内容

2. 【场景类型】这是什么类型的地方？（1-2个标签）
   如：神社、寺庙、商业街、居酒屋、车站、公园、海滩、咖啡馆

3. 【画面元素】画面中有哪些主要元素？（2-3个标签）
   如：游客、僧侣、樱花树、石阶、木质结构、瓦片屋顶、招牌、车辆

4. 【氛围/时间】氛围和时间特征（1-2个标签）
   如：阴天、晴天、黄昏、夜景、人流密集、安静、庄严

5. 【色彩构图】视觉特征（1-2个标签）
   如：红色为主、暖色调、冷色调、对称构图、框架构图、极简

6. 【创作适用】适合什么用途（1个标签）
   如：适合封面、适合背景、适合横版配图、适合竖版

## 自由描述（重要！）
用一句话（40-80字）**具体识别**画面内容。

**必须包含：**
- 这具体是什么（如能识别：浅草寺雷门、清水寺本堂、伏见稻荷千本鸟居）
- 可见的具体元素名称（如：唐破风屋顶、三叶葵族徽、铜制灯笼、注连绳、狛犬）
- 建筑/物品的具体特征（如：朱红色漆面、金箔装饰、青铜瓦当）

**禁止使用：**
- ❌ 情绪词：庄严、宁静、氛围、感受、文化气息
- ❌ 模糊词：传统建筑、日式风格、东方韵味
- ❌ 主观评价：美丽的、壮观的、独特的

**好的例子：**
✅ "浅草寺雷门，可见巨型红色灯笼、唐破风屋顶、风神雷神像，门前游客密集"
✅ "日本寺庙入口，红色木构建筑配唐破风，悬挂白色灯笼，屋脊有金色族徽装饰"

**差的例子：**
❌ "庄严的日本寺庙，充满传统文化的宁静氛围，让人感受到历史的厚重"

## 输出格式
请严格按照以下 JSON 格式输出，不要输出其他内容：

{
  "tags": {
    "identity": ["具体地点或建筑名", "建筑风格", "特殊元素"],
    "scene": ["场景类型"],
    "elements": ["元素1", "元素2"],
    "mood": ["氛围标签"],
    "visual": ["色彩或构图"],
    "usage": ["用途标签"]
  },
  "description": "客观描述画面内容..."
}`;

/**
 * 标签结构类型
 */
export interface PhotoTags {
  identity: string[];  // 具体识别：地点、建筑风格、特殊元素
  scene: string[];     // 场景类型
  elements: string[];  // 画面元素
  mood: string[];      // 氛围/时间
  visual: string[];    // 色彩构图
  usage: string[];     // 创作适用
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
  const tagFields = ['identity', 'scene', 'elements', 'mood', 'visual', 'usage'];
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
      identity: [],
      scene: [],
      elements: [],
      mood: [],
      visual: [],
      usage: [],
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
