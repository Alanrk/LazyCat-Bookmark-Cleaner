import { loadLlmConfig, saveLlmConfig, testLlmConnection } from './settings.js';
import { createConfetti } from './confetti.js';
import {
    flattenBookmarkTree,
    classifyAllBookmarks,
    mergeCategories,
    generateFolderPlan,
    applyOrganizationPlan,
    undoOrganization,
    checkUndoAvailable,
    VALID_PROTOCOLS
} from './bookmarkOrganizer.js';

// 状态变量
let isClassifying = false;
let classificationResult = null;   // { categories, uncategorized }
let selectedTargetParentId = '2';   // 默认「其他书签」
let classificationAbortController = null;

// 辅助：获取本地化消息
function getMessage(messageName, substitutions = null) {
    return chrome.i18n.getMessage(messageName, substitutions);
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化 i18n
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const message = element.getAttribute('data-i18n');
        const localizedText = chrome.i18n.getMessage(message);
        if (localizedText) {
            element.textContent = localizedText;
        }
    });

    // 加载 LLM 配置
    const config = await loadLlmConfig();
    document.getElementById('api-base-url').value = config.apiBaseUrl;
    document.getElementById('api-model').value = config.model;
    if (config.apiKey) {
        document.getElementById('api-key').value = config.apiKey;
    }

    // 加载目标文件夹设置
    const targetData = await chrome.storage.local.get('organizeTargetFolder');
    if (targetData.organizeTargetFolder) {
        selectedTargetParentId = targetData.organizeTargetFolder;
        const radio = document.querySelector(`input[name="targetFolder"][value="${selectedTargetParentId}"]`);
        if (radio) radio.checked = true;
    }

    // 检查撤销状态
    await initUndoBanner();

    // 初始化进度环
    initializeProgressRing();

    // 获取书签总数
    await loadBookmarkCount();

    // 绑定事件
    initEventListeners();

    // 添加版本号
    addVersionTag();

    // 初始化猫咪
    createMovingCat();
});

// ===== 进度环 =====
function initializeProgressRing() {
    const progressRing = document.querySelector('.progress-ring-circle');
    const progressText = document.querySelector('.progress-text');
    const radius = 70;
    const circumference = 2 * Math.PI * radius;

    if (progressRing) {
        progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
        progressRing.style.strokeDashoffset = circumference;
    }
    if (progressText) {
        progressText.textContent = '0%';
        progressText.style.opacity = '1';
    }

    const container = document.querySelector('.scan-container');
    if (container) {
        container.classList.remove('scanning');
        container.classList.remove('scan-complete');
    }
}

function updateProgress(current, total) {
    const progressRing = document.querySelector('.progress-ring-circle');
    const progressText = document.querySelector('.progress-text');
    const container = document.querySelector('.scan-container');

    current = Math.min(current, total);
    const percentage = (current / total) * 100;
    const displayPercentage = current === total ? 100 : Math.floor(percentage);

    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    requestAnimationFrame(() => {
        if (progressRing) {
            progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
            progressRing.style.strokeDashoffset = offset;
        }
        if (progressText) {
            progressText.style.opacity = '1';
            progressText.textContent = `${displayPercentage}%`;
        }
        if (container) {
            container.classList.add('scanning');
            if (current === total) {
                container.classList.add('scan-complete');
                setTimeout(() => {
                    container.classList.remove('scanning');
                    container.classList.remove('scan-complete');
                }, 1000);
            }
        }
    });
}

// ===== 书签计数 =====
async function loadBookmarkCount() {
    try {
        const tree = await chrome.bookmarks.getTree();
        const flat = flattenBookmarkTree(tree[0]);
        document.getElementById('organize-total').textContent = flat.length;
    } catch {
        document.getElementById('organize-total').textContent = '-';
    }
}

// ===== 事件绑定 =====
function initEventListeners() {
    // 开始分类按钮
    document.getElementById('classify-button').addEventListener('click', handleClassifyClick);

    // AI 设置按钮
    document.getElementById('llm-settings-button').addEventListener('click', showLlmSettings);

    // 设置对话框 - 保存
    document.getElementById('save-llm-settings').addEventListener('click', handleSaveSettings);

    // 设置对话框 - 取消
    document.getElementById('cancel-llm-settings').addEventListener('click', hideLlmSettings);

    // 设置对话框 - 测试连接
    document.getElementById('test-connection-btn').addEventListener('click', handleTestConnection);

    // 预览 - 返回
    document.getElementById('back-button').addEventListener('click', backToClassify);

    // 预览 - 应用
    document.getElementById('apply-button').addEventListener('click', handleApply);

    // 成功 - 再次整理
    document.getElementById('organize-again-button').addEventListener('click', backToClassify);

    // 撤销
    document.getElementById('undo-button').addEventListener('click', handleUndo);
    document.getElementById('dismiss-undo-button').addEventListener('click', dismissUndo);
}

// ===== LLM 设置 =====
function showLlmSettings() {
    if (isClassifying) {
        showToast(getMessage('cannotChangeSettingsDuringClassify'));
        return;
    }
    document.getElementById('llm-settings-dialog').style.display = 'flex';
}

function hideLlmSettings() {
    document.getElementById('llm-settings-dialog').style.display = 'none';
    // 隐藏测试结果
    document.getElementById('test-connection-result').style.display = 'none';
}

async function handleSaveSettings() {
    const config = {
        apiBaseUrl: document.getElementById('api-base-url').value.trim() || 'https://api.openai.com/v1',
        model: document.getElementById('api-model').value.trim() || 'gpt-4o-mini',
        apiKey: document.getElementById('api-key').value.trim()
    };

    // 保存目标文件夹
    const targetRadio = document.querySelector('input[name="targetFolder"]:checked');
    if (targetRadio) {
        selectedTargetParentId = targetRadio.value;
        await chrome.storage.local.set({ organizeTargetFolder: selectedTargetParentId });
    }

    await saveLlmConfig(config);
    hideLlmSettings();
    showToast(getMessage('settingsSaved'));
}

async function handleTestConnection() {
    const btn = document.getElementById('test-connection-btn');
    const resultEl = document.getElementById('test-connection-result');

    const config = {
        apiBaseUrl: document.getElementById('api-base-url').value.trim() || 'https://api.openai.com/v1',
        model: document.getElementById('api-model').value.trim() || 'gpt-4o-mini',
        apiKey: document.getElementById('api-key').value.trim()
    };

    if (!config.apiKey) {
        resultEl.textContent = getMessage('errNoApiKey');
        resultEl.className = 'test-result error';
        resultEl.style.display = 'inline-block';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Testing...';
    resultEl.style.display = 'none';

    const result = await testLlmConnection(config);

    btn.disabled = false;
    btn.textContent = getMessage('testConnection');

    resultEl.style.display = 'inline-block';
    if (result.ok) {
        resultEl.textContent = getMessage('testSuccess', [result.model || 'API']);
        resultEl.className = 'test-result success';
    } else {
        resultEl.textContent = getMessage('testFailure', [result.error]);
        resultEl.className = 'test-result error';
    }
}

// ===== 分类流程 =====
async function handleClassifyClick() {
    const container = document.querySelector('.scan-container');
    const buttonText = document.querySelector('#classify-button .button-text');

    // 如果正在分类中，取消
    if (isClassifying) {
        cancelClassification();
        return;
    }

    // 验证 LLM 配置
    const config = await loadLlmConfig();
    if (!config.apiKey) {
        showLlmSettings();
        showToast(getMessage('noApiConfig'));
        return;
    }

    // 开始分类
    isClassifying = true;
    classificationAbortController = new AbortController();

    // 更新 UI
    container.classList.add('scanning');
    document.getElementById('classify-button').classList.add('cancel');
    buttonText.textContent = getMessage('cancelClassify');
    document.getElementById('llm-settings-button').style.display = 'none';
    initializeProgressRing();

    try {
        // 获取书签
        const tree = await chrome.bookmarks.getTree();
        const allBookmarks = flattenBookmarkTree(tree[0]);

        if (allBookmarks.length === 0) {
            showToast(getMessage('noBookmarksToClassify'));
            resetClassifyUI();
            return;
        }

        document.getElementById('organize-total').textContent = allBookmarks.length;

        // 分批分类
        classificationResult = await classifyAllBookmarks(
            allBookmarks,
            (progress) => {
                updateProgress(progress.processed, progress.total);
                document.getElementById('organize-classified').textContent = progress.processed;
                document.getElementById('organize-uncategorized').textContent = progress.uncategorizedCount;
                document.getElementById('organize-categories').textContent = progress.categoriesCount;
            },
            classificationAbortController.signal
        );

        // 合并相似类别
        classificationResult.categories = mergeCategories(classificationResult.categories);

        // 显示预览
        showPreviewPhase(classificationResult);

    } catch (err) {
        if (err.message === 'Classification cancelled') {
            showToast(getMessage('classifyCancelled'));
        } else {
            console.error('Classification error:', err);
            showToast(getMessage('errUnknownClassify', [err.message]));
        }
        resetClassifyUI();
    }
}

function cancelClassification() {
    if (classificationAbortController) {
        classificationAbortController.abort();
        classificationAbortController = null;
    }
    isClassifying = false;
    resetClassifyUI();
}

function resetClassifyUI() {
    isClassifying = false;
    const container = document.querySelector('.scan-container');
    const buttonText = document.querySelector('#classify-button .button-text');
    const settingsBtn = document.getElementById('llm-settings-button');

    container.classList.remove('scanning');
    document.getElementById('classify-button').classList.remove('cancel');
    buttonText.textContent = getMessage('startClassify');
    if (settingsBtn) settingsBtn.style.display = '';

    initializeProgressRing();
}

// ===== 预览阶段 =====
function showPreviewPhase(result) {
    isClassifying = false;
    resetClassifyUI();

    document.getElementById('classify-phase').style.display = 'none';
    document.getElementById('preview-phase').style.display = 'block';
    document.getElementById('success-phase').style.display = 'none';

    const categories = result.categories;
    const uncategorized = result.uncategorized;

    // 更新汇总
    const classifiedCount = categories.reduce((sum, c) => sum + c.bookmarks.length, 0);
    document.getElementById('preview-category-count').textContent = categories.length;
    document.getElementById('preview-classified-count').textContent = classifiedCount;
    document.getElementById('preview-uncategorized-count').textContent = uncategorized.length;

    // 渲染类别卡片
    renderCategoryCards(categories);

    // 渲染未分类区域
    renderUncategorized(uncategorized);
}

function renderCategoryCards(categories) {
    const container = document.getElementById('category-list');
    container.innerHTML = '';

    if (categories.length === 0) {
        container.innerHTML = `<div class="empty-state"><p data-i18n="noCategoriesFound">No categories found</p></div>`;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
            if (msg) el.textContent = msg;
        });
        return;
    }

    categories.forEach((cat, catIndex) => {
        const card = createCategoryCard(cat, catIndex);
        container.appendChild(card);
    });
}

function createCategoryCard(category, catIndex) {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.dataset.categoryIndex = catIndex;
    card.dataset.originalName = category.name;

    // 头部
    const header = document.createElement('div');
    header.className = 'category-card-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'category-name';
    nameEl.textContent = category.name;

    const countEl = document.createElement('span');
    countEl.className = 'category-count';
    countEl.textContent = `${category.bookmarks.length} ${getMessage('bookmarks')}`;

    const renameBtn = document.createElement('button');
    renameBtn.className = 'category-rename-btn';
    renameBtn.textContent = getMessage('rename');
    renameBtn.addEventListener('click', () => handleRenameCategory(card, catIndex));

    header.appendChild(nameEl);
    header.appendChild(countEl);
    header.appendChild(renameBtn);

    // 描述
    const descEl = document.createElement('div');
    descEl.className = 'category-description';
    descEl.textContent = category.description || '';

    // 书签列表（默认显示前5个）
    const bookmarksList = document.createElement('div');
    bookmarksList.className = 'category-bookmarks';

    const showCount = Math.min(category.bookmarks.length, 5);
    for (let i = 0; i < showCount; i++) {
        const bm = category.bookmarks[i];
        const item = document.createElement('div');
        item.className = 'category-bookmark-item';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'cb-title';
        titleSpan.textContent = bm.title;
        titleSpan.title = bm.title;

        const urlSpan = document.createElement('span');
        urlSpan.className = 'cb-url';
        try {
            const host = new URL(bm.url).hostname;
            urlSpan.textContent = host;
        } catch {
            urlSpan.textContent = bm.url;
        }
        urlSpan.title = bm.url;

        item.appendChild(titleSpan);
        item.appendChild(urlSpan);
        bookmarksList.appendChild(item);
    }

    // 更多书签折叠
    if (category.bookmarks.length > 5) {
        const moreEl = document.createElement('div');
        moreEl.className = 'cb-show-more';
        moreEl.textContent = getMessage('showMore', [category.bookmarks.length - 5]);
        moreEl.addEventListener('click', () => {
            const isExpanded = moreEl.dataset.expanded === 'true';
            if (isExpanded) {
                // 折叠
                const items = bookmarksList.querySelectorAll('.cb-expanded');
                items.forEach(el => el.remove());
                moreEl.textContent = getMessage('showMore', [category.bookmarks.length - 5]);
                moreEl.dataset.expanded = 'false';
            } else {
                // 展开
                for (let i = 5; i < category.bookmarks.length; i++) {
                    const bm = category.bookmarks[i];
                    const item = document.createElement('div');
                    item.className = 'category-bookmark-item cb-expanded';
                    const titleSpan = document.createElement('span');
                    titleSpan.className = 'cb-title';
                    titleSpan.textContent = bm.title;
                    const urlSpan = document.createElement('span');
                    urlSpan.className = 'cb-url';
                    try {
                        urlSpan.textContent = new URL(bm.url).hostname;
                    } catch {
                        urlSpan.textContent = bm.url;
                    }
                    item.appendChild(titleSpan);
                    item.appendChild(urlSpan);
                    bookmarksList.appendChild(item);
                }
                moreEl.textContent = getMessage('showLess');
                moreEl.dataset.expanded = 'true';
            }
        });
        bookmarksList.appendChild(moreEl);
    }

    card.appendChild(header);
    card.appendChild(descEl);
    card.appendChild(bookmarksList);
    return card;
}

function renderUncategorized(uncategorized) {
    const section = document.getElementById('uncategorized-section');
    const container = document.getElementById('uncategorized-list');

    if (uncategorized.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = '';

    uncategorized.forEach(bm => {
        const item = document.createElement('div');
        item.className = 'category-bookmark-item';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'cb-title';
        titleSpan.textContent = bm.title;
        titleSpan.title = bm.title;

        const urlSpan = document.createElement('span');
        urlSpan.className = 'cb-url';
        try {
            urlSpan.textContent = new URL(bm.url).hostname;
        } catch {
            urlSpan.textContent = bm.url;
        }
        urlSpan.title = bm.url;

        item.appendChild(titleSpan);
        item.appendChild(urlSpan);
        container.appendChild(item);
    });
}

function handleRenameCategory(card, catIndex) {
    if (!classificationResult) return;

    const nameEl = card.querySelector('.category-name');
    const currentName = nameEl.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'category-rename-input';
    input.value = currentName;

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const finishRename = () => {
        const newName = input.value.trim() || currentName;
        classificationResult.categories[catIndex].name = newName;
        nameEl.textContent = newName;
        input.replaceWith(nameEl);
    };

    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finishRename();
        if (e.key === 'Escape') {
            input.value = currentName;
            finishRename();
        }
    });
}

function backToClassify() {
    document.getElementById('classify-phase').style.display = 'block';
    document.getElementById('preview-phase').style.display = 'none';
    document.getElementById('success-phase').style.display = 'none';
    classificationResult = null;
    loadBookmarkCount();
    initializeProgressRing();
}

// ===== 应用组织 =====
async function handleApply() {
    if (!classificationResult) return;

    const plan = generateFolderPlan(
        classificationResult.categories,
        classificationResult.uncategorized,
        selectedTargetParentId
    );

    const confirmed = confirm(getMessage('confirmApply', [
        plan.totalBookmarks,
        Object.keys(plan.grouped).length
    ]));

    if (!confirmed) return;

    // 显示进度
    const applyBtn = document.getElementById('apply-button');
    applyBtn.disabled = true;
    applyBtn.textContent = getMessage('applyingOrganization');

    try {
        const result = await applyOrganizationPlan(plan, (progress) => {
            // 可以在这里更新进度
        });

        // 显示成功
        showSuccessPhase(result);

        // 检查撤销状态
        await initUndoBanner();

        // 触发撒花
        createConfetti();

    } catch (err) {
        console.error('Apply error:', err);
        showToast(getMessage('errApplyOrganization', [err.message]));
    } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = getMessage('applyOrganization');
    }
}

function showSuccessPhase(result) {
    document.getElementById('classify-phase').style.display = 'none';
    document.getElementById('preview-phase').style.display = 'none';
    document.getElementById('success-phase').style.display = 'block';

    const msgText = document.getElementById('success-message-text');
    msgText.textContent = getMessage('applySuccess', [result.moved, result.categoryCount]);
}

// ===== 撤销功能 =====
async function initUndoBanner() {
    const banner = document.getElementById('undo-banner');
    const undoInfo = await checkUndoAvailable();

    if (undoInfo) {
        const minutes = Math.ceil(undoInfo.remainingMs / 60000);
        banner.querySelector('#undo-banner-text').textContent =
            getMessage('undoAvailableWithTime', [minutes, undoInfo.bookmarkCount, undoInfo.folderCount]);
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
}

async function handleUndo() {
    const confirmed = confirm(getMessage('undoConfirm'));
    if (!confirmed) return;

    try {
        const result = await undoOrganization();
        showToast(getMessage('undoSuccess', [result.restored]));
        document.getElementById('undo-banner').style.display = 'none';
        backToClassify();
    } catch (err) {
        showToast(getMessage('errUndo', [err.message]));
    }
}

function dismissUndo() {
    document.getElementById('undo-banner').style.display = 'none';
}

// ===== UI 工具 =====
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 2500);
}

function addVersionTag() {
    if (document.querySelector('.version-tag')) return;

    const manifest = chrome.runtime.getManifest();
    const versionTag = document.createElement('span');
    versionTag.className = 'version-tag';
    versionTag.textContent = `v${manifest.version}`;

    const brandDiv = document.querySelector('.brand');
    if (brandDiv) {
        brandDiv.appendChild(versionTag);
    }
}

// ===== 猫咪动画 =====
function createMovingCat() {
    const statsWrapper = document.querySelector('.scan-stats-wrapper');
    if (!statsWrapper) return;

    const catContainer = document.createElement('div');
    catContainer.className = 'moving-cat-container';

    const cat = document.createElement('img');
    cat.src = 'images/logo.jpg';
    cat.className = 'moving-cat';
    cat.alt = '懒猫书签清理';

    catContainer.appendChild(cat);
    statsWrapper.after(catContainer);

    initCatInteraction(cat);
}

function initCatInteraction(cat) {
    const tooltip = document.querySelector('.cat-tooltip');
    if (!tooltip) return;

    const messages = Array.from({ length: 20 }, (_, i) =>
        chrome.i18n.getMessage(`catMessage${i + 1}`)
    ).filter(Boolean);

    let timeoutId;

    cat.addEventListener('click', () => {
        const message = messages[Math.floor(Math.random() * messages.length)] || '喵~';
        const tooltipText = tooltip.querySelector('.tooltip-text');
        if (tooltipText) tooltipText.textContent = message;

        tooltip.style.display = 'block';
        tooltip.style.opacity = '1';

        const catRect = cat.getBoundingClientRect();
        tooltip.style.left = `${catRect.left + (catRect.width / 2) - (tooltip.offsetWidth / 2)}px`;
        tooltip.style.top = `${catRect.top - tooltip.offsetHeight - 10}px`;

        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            tooltip.style.opacity = '0';
            setTimeout(() => { tooltip.style.display = 'none'; }, 300);
        }, 2000);
    });
}
