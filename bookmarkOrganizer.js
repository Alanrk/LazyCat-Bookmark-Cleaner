// 书签整理核心逻辑 — 扁平化、分批分类、类别合并、文件夹方案、撤销

// 不需要检查的特殊协议
const VALID_PROTOCOLS = ['chrome:', 'chrome-extension:', 'file:', 'javascript:', 'data:', 'about:', 'edge:', 'brave:'];

// 特殊文件夹 ID（根、书签栏、其他书签、移动设备）
const SPECIAL_FOLDER_IDS = ['0', '1', '2', '3'];

// 批次配置
const BATCH_CONFIG = {
    BATCH_SIZE: 25,
    DELAY_MS: 800,
    MAX_RETRIES: 3
};

// 扁平化书签树
function flattenBookmarkTree(nodes, path = []) {
    const result = [];
    // 兼容传入数组或对象
    const children = Array.isArray(nodes) ? nodes : nodes?.children;
    if (!children) return result;

    for (const node of children) {
        const parentId = node.parentId || null;
        const index = node.index !== undefined ? node.index : null;

        if (node.url && !VALID_PROTOCOLS.some(p => node.url.startsWith(p))) {
            result.push({
                id: node.id,
                title: node.title || '(untitled)',
                url: node.url,
                path: [...path],
                parentId,
                index,
                dateAdded: node.dateAdded
            });
        }

        if (node.children) {
            const currentPath = node.title ? [...path, node.title] : path;
            result.push(...flattenBookmarkTree(node.children, currentPath));
        }
    }
    return result;
}

// 分批分类所有书签
async function classifyAllBookmarks(allBookmarks, onProgress, signal) {
    const aggregatedCategories = {}; // categoryName -> { name, description, bookmarks[] }
    const uncategorized = [];
    let totalProcessed = 0;
    const total = allBookmarks.length;

    for (let i = 0; i < allBookmarks.length; i += BATCH_CONFIG.BATCH_SIZE) {
        // 检查取消信号
        if (signal && signal.aborted) {
            throw new Error('Classification cancelled');
        }

        const batch = allBookmarks.slice(i, i + BATCH_CONFIG.BATCH_SIZE);
        const batchPayload = batch.map((bm, idx) => ({
            index: idx,
            title: bm.title,
            url: bm.url
        }));

        const batchIndex = Math.floor(i / BATCH_CONFIG.BATCH_SIZE);

        // 带重试的 API 调用
        let result = null;
        for (let attempt = 0; attempt <= BATCH_CONFIG.MAX_RETRIES; attempt++) {
            if (signal && signal.aborted) {
                throw new Error('Classification cancelled');
            }

            try {
                result = await chrome.runtime.sendMessage({
                    type: 'classifyBookmarks',
                    batchIndex,
                    bookmarks: batchPayload
                });

                if (result.error) {
                    throw new Error(result.error);
                }
                break;
            } catch (err) {
                if (err.message === 'Classification cancelled') throw err;
                if (attempt === BATCH_CONFIG.MAX_RETRIES) throw err;
                await sleep(BATCH_CONFIG.DELAY_MS * Math.pow(2, attempt));
            }
        }

        // 合并批次结果
        for (const cat of result.categories) {
            if (!aggregatedCategories[cat.name]) {
                aggregatedCategories[cat.name] = {
                    name: cat.name,
                    description: cat.description || '',
                    bookmarks: []
                };
            }
            for (const idx of cat.bookmarkIndices) {
                if (idx >= 0 && idx < batch.length) {
                    aggregatedCategories[cat.name].bookmarks.push(batch[idx]);
                }
            }
        }
        for (const idx of result.uncategorized || []) {
            if (idx >= 0 && idx < batch.length) {
                uncategorized.push(batch[idx]);
            }
        }

        totalProcessed = Math.min(i + BATCH_CONFIG.BATCH_SIZE, total);

        if (onProgress) {
            onProgress({
                processed: totalProcessed,
                total,
                categoriesCount: Object.keys(aggregatedCategories).length,
                uncategorizedCount: uncategorized.length
            });
        }

        // 批次间延迟
        if (i + BATCH_CONFIG.BATCH_SIZE < allBookmarks.length) {
            await sleep(BATCH_CONFIG.DELAY_MS);
        }
    }

    return {
        categories: Object.values(aggregatedCategories),
        uncategorized
    };
}

// 合并相似类别（跨批次去重）
function mergeCategories(categories) {
    if (categories.length <= 1) return categories;

    const merged = [];
    const used = new Set();

    for (let i = 0; i < categories.length; i++) {
        if (used.has(i)) continue;

        const base = categories[i];
        const combined = {
            name: base.name,
            description: base.description,
            bookmarks: [...base.bookmarks]
        };
        used.add(i);

        for (let j = i + 1; j < categories.length; j++) {
            if (used.has(j)) continue;

            const other = categories[j];

            // 相似度检测：名称的 Jaccard 相似度 或 子串包含
            if (areCategoriesSimilar(base.name, other.name)) {
                combined.bookmarks.push(...other.bookmarks);
                // 保留较长/较好的描述
                if (other.description && other.description.length > combined.description.length) {
                    combined.description = other.description;
                }
                used.add(j);
            }
        }

        merged.push(combined);
    }

    return merged;
}

// 判断两个类别名是否相似
function areCategoriesSimilar(nameA, nameB) {
    const a = nameA.toLowerCase().trim();
    const b = nameB.toLowerCase().trim();

    // 完全相同
    if (a === b) return true;

    // 一个是另一个的子串
    if (a.includes(b) || b.includes(a)) return true;

    // Jaccard 相似度（基于词）
    const wordsA = new Set(a.split(/[\s\/\-]+/).filter(w => w.length > 0));
    const wordsB = new Set(b.split(/[\s\/\-]+/).filter(w => w.length > 0));

    if (wordsA.size === 0 || wordsB.size === 0) return false;

    const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);

    const similarity = intersection.size / union.size;
    return similarity > 0.5;
}

// 生成文件夹创建方案
function generateFolderPlan(categories, uncategorized, targetParentId = '2') {
    const plan = {
        targetParentId,
        parentFolderName: null,
        grouped: {},
        totalBookmarks: 0
    };

    // 生成带时间戳的父文件夹名
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    plan.parentFolderName = `🤖 AI 智能分类 - ${dateStr}`;

    for (const cat of categories) {
        if (cat.bookmarks.length > 0) {
            plan.grouped[cat.name] = [...cat.bookmarks];
            plan.totalBookmarks += cat.bookmarks.length;
        }
    }

    if (uncategorized.length > 0) {
        plan.grouped['📦 未分类'] = [...uncategorized];
        plan.totalBookmarks += uncategorized.length;
    }

    return plan;
}

// 创建撤销快照
async function createUndoSnapshot(bookmarks) {
    const snapshot = {
        timestamp: Date.now(),
        operations: bookmarks.map(bm => ({
            id: bm.id,
            originalParentId: bm.parentId,
            originalIndex: bm.index
        })),
        createdFolderIds: []
    };
    await chrome.storage.local.set({ organizeUndoData: snapshot });
    return snapshot;
}

// 应用组织方案
async function applyOrganizationPlan(plan, onProgress) {
    let moved = 0;
    const total = plan.totalBookmarks;

    // 1. 创建父文件夹
    const parentFolder = await chrome.bookmarks.create({
        parentId: plan.targetParentId,
        title: plan.parentFolderName
    });

    const createdFolderIds = [parentFolder.id];

    // 2. 保存撤销快照（在移动前记录原始位置）
    const allBookmarks = [];
    for (const bookmarks of Object.values(plan.grouped)) {
        allBookmarks.push(...bookmarks);
    }
    await createUndoSnapshot(allBookmarks);

    // 3. 为每个类别创建子文件夹并移动书签
    for (const [categoryName, bookmarks] of Object.entries(plan.grouped)) {
        try {
            // 创建类别文件夹
            const categoryFolder = await chrome.bookmarks.create({
                parentId: parentFolder.id,
                title: categoryName
            });
            createdFolderIds.push(categoryFolder.id);

            // 移动书签到该文件夹
            for (const bm of bookmarks) {
                try {
                    await chrome.bookmarks.move(bm.id, {
                        parentId: categoryFolder.id
                    });
                    moved++;
                    if (onProgress) {
                        onProgress({ moved, total, currentCategory: categoryName });
                    }
                } catch (moveErr) {
                    console.warn(`Failed to move bookmark ${bm.id}:`, moveErr);
                    // 继续处理其他书签
                }
            }
        } catch (folderErr) {
            console.warn(`Failed to create folder "${categoryName}":`, folderErr);
            // 继续处理其他类别
        }
    }

    // 4. 更新撤销快照（记录创建的文件夹）
    const snapshotData = await chrome.storage.local.get('organizeUndoData');
    if (snapshotData.organizeUndoData) {
        snapshotData.organizeUndoData.createdFolderIds = createdFolderIds;
        await chrome.storage.local.set({
            organizeUndoData: snapshotData.organizeUndoData
        });
    }

    return {
        moved,
        total,
        parentFolderId: parentFolder.id,
        createdFolderIds,
        categoryCount: Object.keys(plan.grouped).length
    };
}

// 执行撤销
async function undoOrganization() {
    const data = await chrome.storage.local.get('organizeUndoData');
    const snapshot = data.organizeUndoData;

    if (!snapshot) {
        throw new Error('No undo data available');
    }

    // 检查是否过期（30分钟）
    const elapsed = Date.now() - snapshot.timestamp;
    if (elapsed > 30 * 60 * 1000) {
        await chrome.storage.local.remove('organizeUndoData');
        throw new Error('Undo window expired (30 minutes)');
    }

    let restored = 0;
    let errors = 0;

    // 1. 将书签移回原始位置
    for (const op of snapshot.operations) {
        try {
            await chrome.bookmarks.move(op.id, {
                parentId: op.originalParentId,
                index: op.originalIndex
            });
            restored++;
        } catch (err) {
            errors++;
            console.warn(`Failed to restore bookmark ${op.id}:`, err);
        }
    }

    // 2. 删除创建的文件夹
    for (const folderId of (snapshot.createdFolderIds || [])) {
        try {
            await chrome.bookmarks.removeTree(folderId);
        } catch (err) {
            console.warn(`Failed to remove folder ${folderId}:`, err);
        }
    }

    // 3. 清除快照
    await chrome.storage.local.remove('organizeUndoData');

    return { restored, errors };
}

// 检查是否有可用的撤销数据
async function checkUndoAvailable() {
    const data = await chrome.storage.local.get('organizeUndoData');
    const snapshot = data.organizeUndoData;

    if (!snapshot) return false;

    const elapsed = Date.now() - snapshot.timestamp;
    if (elapsed > 30 * 60 * 1000) {
        await chrome.storage.local.remove('organizeUndoData');
        return false;
    }

    return {
        timestamp: snapshot.timestamp,
        remainingMs: 30 * 60 * 1000 - elapsed,
        bookmarkCount: snapshot.operations.length,
        folderCount: (snapshot.createdFolderIds || []).length
    };
}

// 工具函数：延迟
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export {
    BATCH_CONFIG,
    VALID_PROTOCOLS,
    flattenBookmarkTree,
    classifyAllBookmarks,
    mergeCategories,
    areCategoriesSimilar,
    generateFolderPlan,
    createUndoSnapshot,
    applyOrganizationPlan,
    undoOrganization,
    checkUndoAvailable
};
