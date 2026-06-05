// LLM API 客户端 — OpenAI 兼容接口调用、重试、响应验证

const BATCH_CONFIG = {
    BATCH_SIZE: 25,            // 每批书签数量
    DELAY_MS: 800,             // 批次间延迟
    MAX_RETRIES: 3,            // 最大重试次数
    RETRY_BASE_DELAY_MS: 2000  // 重试基础延迟
};

// 系统提示词
function buildSystemPrompt(locale = 'zh') {
    const prompts = {
        zh: `你是一个专业的书签整理专家。你的任务是根据书签的标题和 URL 将它们分组到有意义的类别中。

规则：
1. 为这批书签创建有意义的类别。不要使用预定义的分类 — 根据实际内容发明描述性的类别名称。
2. 每个类别必须有简短清晰的名称（2-4个字）和一句话描述。
3. 每个书签最多属于一个类别。如果不确定，放入 "uncategorized"。
4. 只返回 JSON，不要有任何 markdown 或解释。
5. 类别名称使用中文。

请严格按照以下 JSON 格式返回：
{
  "categories": [
    {
      "name": "类别名称",
      "description": "该类别的简要描述",
      "bookmarkIndices": [0, 1, 5]
    }
  ],
  "uncategorized": [3, 7]
}`,
        en: `You are an expert bookmark organizer. Your task is to group the following bookmarks into meaningful categories based on their titles and URLs.

RULES:
1. Create categories that make sense for THIS specific set of bookmarks. Do NOT use predefined categories — invent descriptive names.
2. Each category must have a short, clear name (2-4 words) and a one-sentence description.
3. A bookmark belongs to at most ONE category. If you are unsure, put it in "uncategorized".
4. Respond ONLY with a JSON object. No markdown, no explanation.

Respond with this exact JSON structure:
{
  "categories": [
    {
      "name": "Category Name",
      "description": "Brief description of this category",
      "bookmarkIndices": [0, 1, 5]
    }
  ],
  "uncategorized": [3, 7]
}`
    };
    return prompts[locale] || prompts.en;
}

// 构建用户消息
function buildUserPrompt(batchBookmarks) {
    return `Classify these bookmarks:\n${JSON.stringify(batchBookmarks, null, 2)}`;
}

// 验证 LLM 返回的 JSON 结构
function validateLlmResponse(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return { valid: false, error: 'Response is not a valid JSON object' };
    }
    if (!Array.isArray(parsed.categories)) {
        return { valid: false, error: 'Missing or invalid "categories" array' };
    }
    if (!Array.isArray(parsed.uncategorized)) {
        // 允许没有 uncategorized 字段，默认为空数组
        parsed.uncategorized = [];
    }

    // 验证每个 category 的结构
    for (const cat of parsed.categories) {
        if (!cat.name || typeof cat.name !== 'string') {
            return { valid: false, error: 'Category missing valid "name" field' };
        }
        if (!Array.isArray(cat.bookmarkIndices)) {
            return { valid: false, error: `Category "${cat.name}" missing valid "bookmarkIndices" array` };
        }
        // 确保 description 存在
        if (!cat.description) {
            cat.description = '';
        }
    }

    return { valid: true };
}

// 调用 LLM API（带重试逻辑）
async function callLlmApi(config, batchBookmarks, signal, locale = 'zh') {
    const baseUrl = config.apiBaseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;
    let lastError;

    for (let attempt = 0; attempt <= BATCH_CONFIG.MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        { role: 'system', content: buildSystemPrompt(locale) },
                        { role: 'user', content: buildUserPrompt(batchBookmarks) }
                    ],
                    temperature: 0.1,
                    response_format: { type: 'json_object' }
                }),
                signal
            });

            // 处理 429 限流
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
                console.warn(`Rate limited, waiting ${retryAfter}s before retry...`);
                await sleep(retryAfter * 1000);
                continue;
            }

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                lastError = new Error(`API ${response.status}: ${body.slice(0, 300)}`);
                if (attempt < BATCH_CONFIG.MAX_RETRIES) {
                    await sleep(BATCH_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
                }
                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                lastError = new Error('Empty LLM response');
                if (attempt < BATCH_CONFIG.MAX_RETRIES) {
                    await sleep(BATCH_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
                }
                continue;
            }

            // 尝试解析 JSON（处理可能的 markdown 代码块包裹）
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch {
                // 尝试提取代码块中的 JSON
                const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (jsonMatch) {
                    try {
                        parsed = JSON.parse(jsonMatch[1].trim());
                    } catch {
                        lastError = new Error('Failed to parse LLM response as JSON');
                        if (attempt < BATCH_CONFIG.MAX_RETRIES) {
                            await sleep(BATCH_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
                        }
                        continue;
                    }
                } else {
                    lastError = new Error('Failed to parse LLM response as JSON');
                    if (attempt < BATCH_CONFIG.MAX_RETRIES) {
                        await sleep(BATCH_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
                    }
                    continue;
                }
            }

            // 验证响应结构
            const validation = validateLlmResponse(parsed);
            if (!validation.valid) {
                lastError = new Error(validation.error);
                if (attempt < BATCH_CONFIG.MAX_RETRIES) {
                    await sleep(BATCH_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
                }
                continue;
            }

            return {
                categories: parsed.categories,
                uncategorized: parsed.uncategorized || [],
                model: data.model || config.model,
                usage: data.usage || null
            };

        } catch (err) {
            if (err.name === 'AbortError') throw err;
            lastError = err;
            if (attempt < BATCH_CONFIG.MAX_RETRIES) {
                await sleep(BATCH_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
            }
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

// 工具函数：延迟
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export {
    BATCH_CONFIG,
    buildSystemPrompt,
    buildUserPrompt,
    validateLlmResponse,
    callLlmApi
};
