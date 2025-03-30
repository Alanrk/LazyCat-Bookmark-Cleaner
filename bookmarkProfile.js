// 在文件开头导入 html2canvas
import html2canvas from './html2canvas.min.js';

console.log('BookmarkProfile module loaded');

// 添加获取存储的昵称函数
async function getNickname() {
    const result = await chrome.storage.local.get('bookmarkProfileNickname');
    return result.bookmarkProfileNickname;
}

// 添加设置昵称函数
async function setNickname(nickname) {
    await chrome.storage.local.set({ 'bookmarkProfileNickname': nickname });
}

// 修改 DOMContentLoaded 事件处理
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 初始化本地化文本
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const message = element.getAttribute('data-i18n');
            const localizedText = chrome.i18n.getMessage(message);
            if (localizedText) {
                element.textContent = localizedText;
            }
        });

        // 检查是否已有昵称
        const nickname = await getNickname();
        if (!nickname) {
            // 如果没有昵称，显示输入对话框
            showNicknameModal();
        } else {
            // 如果有昵称，更新标题并初始化
            updateProfileTitle(nickname);
            await initBookmarkProfile();
        }
        
        // 初始化分享功能
        await initShareFeature();
        
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// 修改显示昵称输入对话框函数
function showNicknameModal(isFirstTime = true) {  // 添加参数标识是否首次设置
    const modalOverlay = document.querySelector('.modal-overlay');
    const nicknameInput = modalOverlay.querySelector('.nickname-input');
    const confirmButton = modalOverlay.querySelector('.confirm');
    const cancelButton = modalOverlay.querySelector('.cancel');
    const modalTitle = modalOverlay.querySelector('.modal-title');

    // 根据是否首次设置显示不同的标题
    if (modalTitle) {
        modalTitle.textContent = getMessage(isFirstTime ? 'shareModalTitle' : 'editNicknameTitle');
    }

    // 显示模态框
    modalOverlay.style.display = 'flex';

    // 如果是编辑模式，填入当前昵称
    if (!isFirstTime) {
        getNickname().then(currentNickname => {
            if (nicknameInput && currentNickname) {
                nicknameInput.value = currentNickname;
                // 选中文本以方便修改
                nicknameInput.select();
            }
        });
    }

    // 根据是否首次设置来显示/隐藏取消按钮
    if (cancelButton) {
        cancelButton.style.display = isFirstTime ? 'none' : 'block';
    }

    // 取消按钮处理
    const handleCancel = () => {
        modalOverlay.style.display = 'none';
        nicknameInput.value = '';
    };

    // 确认按钮处理
    const handleConfirm = async () => {
        const nickname = nicknameInput.value.trim();
        if (!nickname) {
            alert(getMessage('pleaseEnterNickname'));
            return;
        }

        try {
            // 保存昵称
            await setNickname(nickname);
            // 更新标题
            updateProfileTitle(nickname);
            if (isFirstTime) {
                await initBookmarkProfile();
            }
            modalOverlay.style.display = 'none';
        } catch (error) {
            console.error('Error saving nickname:', error);
            alert(getMessage('nicknameError'));
        }
    };

    // 移除旧的事件监听器（如果有的话）
    confirmButton?.removeEventListener('click', handleConfirm);
    cancelButton?.removeEventListener('click', handleCancel);

    // 添加新的事件监听器
    confirmButton?.addEventListener('click', handleConfirm);
    cancelButton?.addEventListener('click', handleCancel);

    // 添加 ESC 键关闭功能（仅在非首次设置时）
    const handleEscape = (e) => {
        if (e.key === 'Escape' && !isFirstTime) {
            handleCancel();
        }
    };
    document.addEventListener('keydown', handleEscape);

    // 点击遮罩层关闭（仅在非首次设置时）
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay && !isFirstTime) {
            handleCancel();
        }
    });
}

// 添加修改昵称的功能
function addEditNicknameFeature() {
    const profileTitle = document.querySelector('.profile-title h2');
    if (!profileTitle) return;

    // 添加编辑图标
    const editIcon = document.createElement('span');
    editIcon.innerHTML = '✎'; // 使用编辑图标
    editIcon.className = 'edit-nickname-icon';
    editIcon.style.cursor = 'pointer';
    editIcon.style.marginLeft = '8px';
    editIcon.style.fontSize = '14px';
    editIcon.style.opacity = '0.5';
    editIcon.title = getMessage('editNickname');

    // 鼠标悬停效果
    editIcon.addEventListener('mouseenter', () => editIcon.style.opacity = '1');
    editIcon.addEventListener('mouseleave', () => editIcon.style.opacity = '0.5');

    // 点击编辑
    editIcon.addEventListener('click', () => {
        showNicknameModal(false); // 显示带取消按钮的模态框
    });

    profileTitle.appendChild(editIcon);
}

// 修改 DOMContentLoaded 事件处理
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 初始化本地化文本
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const message = element.getAttribute('data-i18n');
            const localizedText = chrome.i18n.getMessage(message);
            if (localizedText) {
                element.textContent = localizedText;
            }
        });

        // 检查是否已有昵称
        const nickname = await getNickname();
        if (!nickname) {
            // 如果没有昵称，显示输入对话框（首次设置）
            showNicknameModal(true);
        } else {
            // 如果有昵称，更新标题并初始化
            updateProfileTitle(nickname);
            await initBookmarkProfile();
            // 添加编辑昵称功能
            addEditNicknameFeature();
        }
        
        // 初始化分享功能
        await initShareFeature();
        
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// 修改更新标题函数
function updateProfileTitle(nickname) {
    const profileTitle = document.querySelector('.profile-title h2');
    if (!profileTitle) return;

    const nicknameSpan = profileTitle.querySelector('.nickname') || document.createElement('span');
    const profileTextSpan = profileTitle.querySelector('.profile-text') || document.createElement('span');
    
    if (!nicknameSpan.classList.contains('nickname')) {
        nicknameSpan.classList.add('nickname');
        profileTitle.insertBefore(nicknameSpan, profileTitle.firstChild);
    }
    
    if (!profileTextSpan.classList.contains('profile-text')) {
        profileTextSpan.classList.add('profile-text');
        profileTitle.appendChild(profileTextSpan);
    }

    // 使用本地化模板来设置内容
    const localizedTitle = getMessage('bookmarkProfileTitle', [nickname]);
    const parts = localizedTitle.split(nickname);
    
    // 设置内容
    nicknameSpan.textContent = nickname;
    profileTextSpan.textContent = parts[1] || '的书签画像';

    // 只保留必要的样式设置
    nicknameSpan.style.cursor = 'pointer';
    nicknameSpan.title = getMessage('editNickname');

    // 添加点击事件（仅在昵称部分）
    nicknameSpan.addEventListener('click', () => {
        showNicknameModal(false);
    });

    // 添加悬停效果（仅在昵称部分）
    nicknameSpan.addEventListener('mouseenter', () => {
        nicknameSpan.style.color = '#10b981';
    });
    nicknameSpan.addEventListener('mouseleave', () => {
        nicknameSpan.style.color = '#1d1d1f';
    });
}

// 添加获取本地化消息的辅助函数
function getMessage(messageName, substitutions = null) {
    return chrome.i18n.getMessage(messageName, substitutions);
}

// 添加书签画像初始化函数
async function initBookmarkProfile() {
    const profileEl = document.querySelector('.bookmark-profile');
    if (!profileEl) return;

    try {
        // 获取书签树
        const tree = await chrome.bookmarks.getTree();
        
        // 显示画像卡片
        profileEl.style.display = 'block';
        
        // 初始化日期范围
        await updateProfileDateRange(tree[0]);
        
        // 初始化基础数据
        const stats = await calculateBookmarkStats(tree[0]);
        
        // 生成���签画像
        await generateBookmarkProfile(tree[0]);
        
        // 更新域名分析
        await updateDomainAnalysis(profileEl, stats);
        
        // 添加趋势图渲染
        await renderTrendChart(tree[0]);
        
    } catch (error) {
        console.error('Error initializing bookmark profile:', error);
        profileEl.style.display = 'none';
    }
}

// 更新日期范围显示
async function updateProfileDateRange(rootNode) {
    const dateEl = document.querySelector('.profile-date');
    if (!dateEl) return;

    try {
        const dates = await getBookmarkDateRange(rootNode);
        const startDate = new Date(dates.oldest).toISOString().split('T')[0].replace(/-/g, '.');
        const endDate = new Date(dates.newest).toISOString().split('T')[0].replace(/-/g, '.');
        dateEl.textContent = `${startDate}-${endDate}`;
    } catch (error) {
        console.error('Error updating date range:', error);
        dateEl.textContent = '';
    }
}

// 获取书签的日期范围
async function getBookmarkDateRange(node) {
    let oldest = Date.now();
    let newest = 0;

    function traverse(node) {
        if (node.dateAdded) {
            oldest = Math.min(oldest, node.dateAdded);
            newest = Math.max(newest, node.dateAdded);
        }
        if (node.children) {
            node.children.forEach(traverse);
        }
    }

    traverse(node);
    return { oldest, newest };
}

// 获取按年份分组的书签数据
async function getBookmarksByYear(rootNode) {
    const bookmarksByYear = new Map();

    function traverse(node) {
        if (node.dateAdded) {
            const year = new Date(node.dateAdded).getFullYear();
            bookmarksByYear.set(year, (bookmarksByYear.get(year) || 0) + 1);
        }
        if (node.children) {
            node.children.forEach(traverse);
        }
    }

    traverse(rootNode);
    return new Map([...bookmarksByYear.entries()].sort((a, b) => a[0] - b[0]));
}

// 渲染趋势图
async function renderTrendChart(rootNode) {
    const chartContainer = document.querySelector('.chart-container');
    if (!chartContainer) return;

    // 获取书签数据并按年份分组
    const bookmarksByYear = await getBookmarksByYear(rootNode);
    
    // 创建容器布局
    chartContainer.style.display = 'flex';
    chartContainer.style.alignItems = 'stretch';
    chartContainer.innerHTML = '';

    // 创建趋势图 SVG 容器
    const trendSvgContainer = document.createElement('div');
    trendSvgContainer.style.flex = '1';
    const trendSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    trendSvg.setAttribute('width', '100%');
    trendSvg.setAttribute('height', '100%');
    trendSvg.style.overflow = 'visible';
    trendSvgContainer.appendChild(trendSvg);

    // 创建Y轴 SVG 容器
    const yAxisSvgContainer = document.createElement('div');
    yAxisSvgContainer.style.width = '60px';
    const yAxisSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    yAxisSvg.setAttribute('width', '100%');
    yAxisSvg.setAttribute('height', '100%');
    yAxisSvg.style.overflow = 'visible';
    yAxisSvgContainer.appendChild(yAxisSvg);

    // 添加到主容器
    chartContainer.appendChild(trendSvgContainer);
    chartContainer.appendChild(yAxisSvgContainer);

    // 绘制趋势图和Y轴
    drawTrendLine(trendSvg, bookmarksByYear);
    drawYAxis(yAxisSvg, bookmarksByYear);
}

// 绘制趋势线
function drawTrendLine(svg, data) {
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const padding = {
        left: 0,
        right: 20,
        top: 20,
        bottom: 40
    };

    // 计算数据范围
    const years = Array.from(data.keys());
    const counts = Array.from(data.values());
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const yAxisMax = Math.ceil(maxCount * 1.1);

    // 创建比例尺
    const xScale = (width - padding.right) / (years.length - 1);
    const yScale = (height - (padding.top + padding.bottom)) / (yAxisMax - minCount);

    // 计算年份标签的显示间隔
    const maxLabels = 10;
    const yearInterval = Math.ceil(years.length / maxLabels);

    // 清空现有内容
    svg.innerHTML = '';

    // 创建渐变
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'line-gradient');
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', '0');
    gradient.setAttribute('x2', '0');
    gradient.setAttribute('y2', height);

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#10b981'); // Updated color

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#10b981'); // Updated color

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    svg.appendChild(gradient);

    // 添加X轴年份标签和参考线
    years.forEach((year, index) => {
        if (index === 0 || index === years.length - 1 || index % yearInterval === 0) {
            const x = index * xScale;

            // 添加年份标签
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', height - padding.bottom / 2);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '12');
            text.setAttribute('fill', '#86868b');
            text.textContent = year;

            if (yearInterval === 1 && years.length > maxLabels) {
                text.setAttribute('transform', `rotate(45, ${x}, ${height - padding.bottom / 2})`);
                text.setAttribute('y', height - padding.bottom / 4);
            }

            svg.appendChild(text);

            // 添加参考线
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('x2', x);
            line.setAttribute('y1', padding.top);
            line.setAttribute('y2', height - padding.bottom);
            line.setAttribute('stroke', '#f5f5f7');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('stroke-dasharray', '4,4');
            svg.appendChild(line);
        }
    });

    // 生成路径数据
    let pathData = '';
    Array.from(data.entries()).forEach(([year, count], index) => {
        const x = index * xScale;
        const y = height - (padding.bottom + (count - minCount) * yScale);
        pathData += (index === 0 ? 'M' : 'L') + `${x},${y}`;
    });

    // 创建路径元素
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', 'url(#line-gradient)');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    path.style.strokeDasharray = path.getTotalLength();
    path.style.strokeDashoffset = path.getTotalLength();
    path.style.animation = 'draw 1.5s ease forwards';

    svg.appendChild(path);

    // 添加数据点
    Array.from(data.entries()).forEach(([year, count], index) => {
        const x = index * xScale;
        const y = height - (padding.bottom + (count - minCount) * yScale);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', 'white');
        circle.setAttribute('stroke', '#10b981');
        circle.setAttribute('stroke-width', '2');

        circle.addEventListener('mouseover', (e) => {
            showTooltip(e, `${year}: ${count} bookmarks`);
            circle.setAttribute('r', '6');
        });

        circle.addEventListener('mouseout', () => {
            hideTooltip();
            circle.setAttribute('r', '4');
        });

        svg.appendChild(circle);
    });
}

// 绘制Y轴
function drawYAxis(svg, data) {
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const padding = {
        top: 20,
        bottom: 40
    };

    // 计算数据范围
    const counts = Array.from(data.values());
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const yAxisMax = Math.ceil(maxCount * 1.1);

    // 创建比例尺
    const yScale = (height - (padding.top + padding.bottom)) / (yAxisMax - minCount);

    // 清空现有内容
    svg.innerHTML = '';

    // 添加Y轴刻度
    const yAxisSteps = 5;
    for (let i = 0; i <= yAxisSteps; i++) {
        const value = Math.round(minCount + (yAxisMax - minCount) * (i / yAxisSteps));
        const y = height - (padding.bottom + (value - minCount) * yScale);

        // 添加刻度线
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('x2', 5);
        line.setAttribute('y1', y);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', '#86868b');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);

        // 添加刻度值
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 8);
        text.setAttribute('y', y + 4);
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('font-size', '12');
        text.setAttribute('fill', '#86868b');
        text.textContent = value;
        svg.appendChild(text);
    }
}

// 工具提示函数
function showTooltip(event, text) {
    let tooltip = document.getElementById('chart-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'chart-tooltip';
        document.body.appendChild(tooltip);
    }
    
    tooltip.textContent = text;
    tooltip.style.display = 'block';
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY - 25) + 'px';
}

function hideTooltip() {
    const tooltip = document.getElementById('chart-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

// 添加书签画像生成函数
async function generateBookmarkProfile(rootNode) {
    try {
        const profileEl = document.querySelector('.bookmark-profile');
        if (!profileEl) return;

        // 获取书签统计数据
        const stats = await calculateBookmarkStats(rootNode);
        console.log('Generated stats:', stats);

        // 计算等级
        const level = calculateCollectorLevel(stats);
        console.log('Calculated level:', level);

        // 计算各项得分 - 移到这里，在使用前先计算
        const scores = calculateDetailedScores(stats);
        console.log('Calculated scores:', scores);

        // 更新等级显示
        const levelEl = profileEl.querySelector('.level');
        if (levelEl) {
            if (!isNaN(level) && level > 0) {
                levelEl.textContent = `Lv.${level}`;
                
                // 添加等级计算逻辑提示
                const tooltip = document.createElement('div');
                tooltip.className = 'level-tooltip';
                
                // 获取当前语言
                const currentLang = chrome.i18n.getUILanguage().startsWith('zh') ? 'zh' : 'en';
                
                // 构建提示内容
                const tooltipContent = {
                    zh: `
                        <div class="tooltip-title">等级计算依据：</div>
                        <div class="score-details">
                            <div class="score-item">
                                <span class="score-label">书签总数：</span>
                                <span class="score-value">${scores.bookmarkScore}分</span>
                                <span class="score-calc">(${stats.totalBookmarks}个 ÷ 100)</span>
                            </div>
                            <div class="score-item">
                                <span class="score-label">收藏时间：</span>
                                <span class="score-value">${scores.timeScore}分</span>
                                <span class="score-calc">(${stats.timeStats.durationDays}天 ÷ 30)</span>
                            </div>
                            <div class="score-item">
                                <span class="score-label">组织评分：</span>
                                <span class="score-value">${scores.orgScore}分</span>
                                <span class="score-calc">(${stats.organizationScore} ÷ 2)</span>
                            </div>
                            <div class="score-item">
                                <span class="score-label">HTTPS比例：</span>
                                <span class="score-value">${scores.httpsScore}分</span>
                                <span class="score-calc">(${Math.round(scores.httpsRatio * 100)}% × 5)</span>
                            </div>
                            <div class="score-item">
                                <span class="score-label">域名多样性：</span>
                                <span class="score-value">${scores.domainScore}分</span>
                                <span class="score-calc">(${stats.uniqueDomains.size}个 ÷ 50)</span>
                            </div>
                        </div>
                        <div class="total-score">
                            总分：${scores.totalScore}分
                        </div>
                        <div class="tooltip-note">
                            最终等级 = log2(${scores.totalScore} + 16) + 1 = ${level}
                        </div>
                    `,
                    en: `
                        <div class="tooltip-title">Level Calculation:</div>
                        <div class="score-details">
                            <div class="score-item">
                                <span class="score-label">Total Bookmarks:</span>
                                <span class="score-value">${scores.bookmarkScore} pts</span>
                                <span class="score-calc">(${stats.totalBookmarks} ÷ 100)</span>
                            </div>
                            <div class="score-item">
                                <span class="score-label">Collection Time:</span>
                                <span class="score-value">${scores.timeScore} pts</span>
                                <span class="score-calc">(${stats.timeStats.durationDays} days ÷ 30)</span>
                            </div>
                            <div class="score-item">
                                <span class="score-label">Organization:</span>
                                <span class="score-value">${scores.orgScore} pts</span>
                                <span class="score-calc">(${stats.organizationScore} ÷ 2)</span>
                            </div>
                            <div class="score-item">
                                <span class="score-label">HTTPS Ratio:</span>
                                <span class="score-value">${scores.httpsScore} pts</span>
                                <span class="score-calc">(${Math.round(scores.httpsRatio * 100)}% × 5)</span>
                            </div>
                            <div class="score-item">
                                <span class="score-label">Domain Diversity:</span>
                                <span class="score-value">${scores.domainScore} pts</span>
                                <span class="score-calc">(${stats.uniqueDomains.size} ÷ 50)</span>
                            </div>
                        </div>
                        <div class="total-score">
                            Total Score: ${scores.totalScore} pts
                        </div>
                        <div class="tooltip-note">
                            Final Level = log2(${scores.totalScore} + 16) + 1 = ${level}
                        </div>
                    `
                };
                
                tooltip.innerHTML = tooltipContent[currentLang];
                levelEl.appendChild(tooltip);
            } else {
                levelEl.textContent = 'Lv.1';
            }
        }

        // 更新收藏者称号
        const collectorEl = profileEl.querySelector('.collector');
        if (collectorEl) {
            // 获取当前语言
            const currentLang = chrome.i18n.getUILanguage().startsWith('zh') ? 'zh' : 'en';
            
            // 确保我们有有效的等级值，如果 level 未定义或无效，则默认为 1
            const validLevel = (level && !isNaN(level) && level > 0) ? level : 1;
            
            // 获取对应等级的称号
            const title = COLLECTOR_TITLES[validLevel] || COLLECTOR_TITLES[1];
            collectorEl.textContent = title[currentLang];

            // 添加收藏者称号计算提示
            const tooltip = document.createElement('div');
            tooltip.className = 'collector-tooltip';
            
            // 计算下一级所需总分
            const nextLevelScore = Math.pow(2, validLevel - 1) + 15;
            // 计算分数差值
            const scoreDiff = nextLevelScore - scores.totalScore;
            
            // 构建提示内容
            const tooltipContent = {
                zh: `
                    <div class="tooltip-title">收藏者称号计算：</div>
                    <div class="title-list">
                        ${Object.entries(COLLECTOR_TITLES).map(([lvl, titles]) => {
                            const requiredScore = Math.pow(2, lvl - 1) + 15;
                            return `
                                <div class="title-item ${lvl == validLevel ? 'current' : ''}">
                                    <span class="title-level">Lv.${lvl}</span>
                                    <span class="title-name">${titles.zh}</span>
                                    <span class="title-score">${requiredScore}分</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="calculation-formula">
                        <div>称号等级计算公式：</div>
                        <div>所需分数 = 2^(等级-1) + 15</div>
                        <div>例如：Lv.6需要 2^5 + 15 = 47分</div>
                    </div>
                `,
                en: `
                    <div class="tooltip-title">Collector Title Calculation:</div>
                    <div class="title-list">
                        ${Object.entries(COLLECTOR_TITLES).map(([lvl, titles]) => {
                            const requiredScore = Math.pow(2, lvl - 1) + 15;
                            return `
                                <div class="title-item ${lvl == validLevel ? 'current' : ''}">
                                    <span class="title-level">Lv.${lvl}</span>
                                    <span class="title-name">${titles.en}</span>
                                    <span class="title-score">${requiredScore} pts</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="calculation-formula">
                        <div>Title Level Calculation Formula:</div>
                        <div>Required Score = 2^(level-1) + 15</div>
                        <div>Example: Lv.6 requires 2^5 + 15 = 47 pts</div>
                    </div>
                `
            };
            
            tooltip.innerHTML = tooltipContent[currentLang];
            collectorEl.appendChild(tooltip);
        }

        // 更新基础统计数据
        const overviewStats = profileEl.querySelector('.overview-stats');
        if (overviewStats) {
            overviewStats.innerHTML = `
                <div class="stat-item">
                    <div class="stat-label">${getMessage('totalBookmarksLabel')}</div>
                    <div class="stat-value">${stats.totalBookmarks}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">${getMessage('foldersLabel')}</div>
                    <div class="stat-value">${stats.totalFolders}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">${getMessage('collectionDaysLabel')}</div>
                    <div class="stat-value">${stats.timeStats.durationDays || 0}</div>
                </div>
            `;
        }

        // 更新统计卡片
        await updateStatsCards(profileEl, {
            ...stats,
            largestFolder: {
                title: stats.largestFolder.title,
                count: stats.largestFolder.count + ' bookmarks'  // 添加 "bookmarks" 文本
            },
            timeStats: {
                ...stats.timeStats,
                oldest: new Date(stats.timeStats.oldest),
                newest: new Date(stats.timeStats.newest)
            }
        });

        // 更新域名分析
        await updateDomainAnalysis(profileEl, stats);

        // 更新分类标签
        updateCategoryTags(profileEl, stats);

    } catch (error) {
        console.error('Error generating profile:', error);
        throw error;
    }
}

// 添加详细分数计算函数
function calculateDetailedScores(stats) {
    // 书签总数得分
    const bookmarkScore = Math.floor(Number(stats.totalBookmarks) / 100);
    
    // 收藏时间得分
    const timeScore = Math.floor(Number(stats.timeStats.durationDays) / 30);
    
    // 组织度得分 - 修改除数为2而不是20，这样0-10分的组织度可以得到0-5分的等级得分
    const orgScore = Math.floor(Number(stats.organizationScore) / 2);
    
    // HTTPS比例得分
    const httpsRatio = Number(stats.protocolStats?.https) / 
                      (Number(stats.protocolStats?.https) + Number(stats.protocolStats?.http) || 1);
    const httpsScore = Math.floor(httpsRatio * 5);
    
    // 域名���样性得分
    const domainScore = Math.floor(Number(stats.uniqueDomains?.size) / 50);
    
    // 计算总分
    const totalScore = bookmarkScore + timeScore + orgScore + httpsScore + domainScore;
    
    return {
        bookmarkScore,
        timeScore,
        orgScore,
        httpsScore,
        httpsRatio,
        domainScore,
        totalScore
    };
}

// 添加特殊文件夹判断函数
function isSpecialFolder(id) {
    const specialIds = ['0', '1', '2', '3'];  // 根文件夹、书签栏、其他书签、移动设备书签
    return specialIds.includes(id);
}

// 修改 CONFIG 对象，与 index.js 保持一致
const CONFIG = {
    validProtocols: ['chrome:', 'chrome-extension:', 'file:', 'javascript:', 'data:', 'about:', 'edge:', 'brave:']
};

// 添加书签统计计算函数
async function calculateBookmarkStats(rootNode) {
    const stats = {
        totalBookmarks: 0,
        totalFolders: 0,
        maxDepth: 0,
        timeStats: {
            oldest: null,
            newest: null,
            durationDays: 0,
            peakDate: null,
            peakCount: 0
        },
        largestFolder: {
            title: '',
            count: 0
        },
        emptyFolders: 0,
        domains: new Map(),
        categories: new Map(),
        avgBookmarksPerFolder: 0,
        organizationScore: 0,
        keywords: new Map(),
        uniqueDomains: new Set(),
        protocolStats: {
            http: 0,
            https: 0
        },
        oldestDomain: {
            domain: '',
            age: 0
        },
        oldestBookmark: null,
        newestBookmark: null,
        duplicateUrls: {
            urlCounts: new Map(), // 存储URL及其出现次数
            count: 0,            // 重复的URL数量
            percentage: 0        // 重复URL占比
        }
    };

    // 添加 bookmarksByDate Map
    const bookmarksByDate = new Map();

    // 使用与 index.js 相同的计数方法
    async function countValidBookmarks(node) {
        let count = 0;
        
        if (node.children) {
            for (const child of node.children) {
                if (child.url) {
                    // 只有当 URL 不在有效协议列表中时才计入总数
                    if (!CONFIG.validProtocols.some(protocol => child.url.startsWith(protocol))) {
                        count++;
                    }
                } else {
                    count += await countValidBookmarks(child);
                }
            }
        }
        
        return count;
    }

    // 设置总书签数
    stats.totalBookmarks = await countValidBookmarks(rootNode);

    function traverse(node, depth = 0) {
        if (!node) return;

        if (node.children) {
            // 只有非特殊文件夹才计入统计
            if (node.id && !isSpecialFolder(node.id)) {
                stats.totalFolders++;
                stats.maxDepth = Math.max(stats.maxDepth, depth);
                
                // 修改：计算当前文件夹中的书签数量
                let folderBookmarks = 0;
                let hasSubfolders = false;

                node.children.forEach(child => {
                    if (child.url) {
                        folderBookmarks++;
                    } else if (child.children) {
                        hasSubfolders = true;
                    }
                });

                // 更新最大文件夹统计
                if (folderBookmarks > stats.largestFolder.count) {
                    stats.largestFolder = {
                        title: node.title || 'Unnamed Folder',
                        count: folderBookmarks
                    };
                }

                // 更新空文件夹计数
                if (folderBookmarks === 0 && !hasSubfolders) {
                    stats.emptyFolders++;
                }
            }

            node.children.forEach(child => traverse(child, depth + 1));
        }

        if (node.url) {
            // 只有当 URL 不在有效协议列表中时才计入总数
            if (!CONFIG.validProtocols.some(protocol => node.url.startsWith(protocol))) {
                // 添加日期验证
                let dateAdded;
                try {
                    // 确保 dateAdded 是有效的时间戳
                    if (node.dateAdded && !isNaN(node.dateAdded)) {
                        dateAdded = new Date(node.dateAdded);
                        // 验证日期是否有效
                        if (dateAdded.toString() === 'Invalid Date') {
                            dateAdded = new Date(); // 使用当前日期作为后备
                        }
                    } else {
                        dateAdded = new Date(); // 使用当前日期作为后备
                    }
                    
                    // 更新时间统计
                    if (!stats.timeStats.oldest || dateAdded < stats.timeStats.oldest) {
                        stats.timeStats.oldest = dateAdded;
                        stats.oldestBookmark = {
                            url: node.url,
                            title: node.title,
                            dateAdded: dateAdded
                        };
                    }
                    if (!stats.timeStats.newest || dateAdded > stats.timeStats.newest) {
                        stats.timeStats.newest = dateAdded;
                        stats.newestBookmark = {
                            url: node.url,
                            title: node.title,
                            dateAdded: dateAdded
                        };
                    }

                    // 统计每日书签数量
                    try {
                        const dateKey = dateAdded.toISOString().split('T')[0];
                        bookmarksByDate.set(dateKey, (bookmarksByDate.get(dateKey) || 0) + 1);
                    } catch (e) {
                        console.warn('Error creating date key for bookmark:', e);
                    }

                } catch (e) {
                    console.warn('Error processing date for bookmark:', node.url, e);
                }

                // 统计域名和协议
                try {
                    const url = new URL(node.url);
                    const domain = url.hostname;
                    stats.domains.set(domain, (stats.domains.get(domain) || 0) + 1);
                    stats.uniqueDomains.add(domain);
                    
                    // 统计协议
                    if (url.protocol === 'https:') {
                        stats.protocolStats.https++;
                    } else if (url.protocol === 'http:') {
                        stats.protocolStats.http++;
                    }

                    // 提取关键词 (从标题中)
                    const words = node.title.toLowerCase().split(/\s+/);
                    words.forEach(word => {
                        if (word.length > 3) { // 忽略太短的词
                            stats.keywords.set(word, (stats.keywords.get(word) || 0) + 1);
                        }
                    });
                } catch (e) {
                    // 忽略无效 URL
                }

                // 标准化 URL（移除尾部斜杠等）
                const normalizedUrl = normalizeUrl(node.url);
                // 更新 URL 计数
                const currentCount = stats.duplicateUrls.urlCounts.get(normalizedUrl) || 0;
                stats.duplicateUrls.urlCounts.set(normalizedUrl, currentCount + 1);
            }
        }
    }

    traverse(rootNode);

    // 计算收集天数
    if (stats.timeStats.oldest && stats.timeStats.newest) {
        const oldestDate = new Date(stats.timeStats.oldest);
        const newestDate = new Date(stats.timeStats.newest);
        const timeDiff = newestDate.getTime() - oldestDate.getTime();
        stats.timeStats.durationDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    // 计算峰值
    let maxCount = 0;
    let peakDate = null;
    bookmarksByDate.forEach((count, date) => {
        if (count > maxCount) {
            maxCount = count;
            peakDate = date;
        }
    });
    stats.timeStats.peakDate = peakDate;
    stats.timeStats.peakCount = maxCount;

    // 计算平均每个文件夹的书签数
    stats.avgBookmarksPerFolder = stats.totalFolders > 0 
        ? (stats.totalBookmarks / stats.totalFolders).toFixed(1)
        : 0;

    // 计算组织评分 (0-10分)
    const organizationFactors = {
        folderUsage: stats.totalFolders > 0 ? Math.min(stats.totalBookmarks / stats.totalFolders / 20, 1) : 0,
        emptyFolderRatio: 1 - (stats.emptyFolders / stats.totalFolders),
        depthBalance: Math.min(stats.maxDepth / 5, 1),
        domainDiversity: stats.uniqueDomains.size / stats.totalBookmarks
    };
    stats.organizationScore = (
        (organizationFactors.folderUsage * 3 +
        organizationFactors.emptyFolderRatio * 3 +
        organizationFactors.depthBalance * 2 +
        organizationFactors.domainDiversity * 2) / 10
    ).toFixed(1);

    // 计算重复URL的统计信息
    let duplicateUrlCount = 0;
    stats.duplicateUrls.urlCounts.forEach((count) => {
        if (count > 1) {
            duplicateUrlCount++; // 只统计重复的URL数量
        }
    });

    stats.duplicateUrls.count = duplicateUrlCount;
    stats.duplicateUrls.percentage = ((duplicateUrlCount / stats.totalBookmarks) * 100).toFixed(1);

    return stats;
}

// 辅助函数：格式化日期
function formatDate(date) {
    if (!date) return '';
    try {
        return date.toISOString().split('T')[0].replace(/-/g, '.');
    } catch (e) {
        console.warn('Error formatting date:', e);
        return '';
    }
}

// 添加一个辅助函数来提取主域名
function extractMainDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return url; // 如果 URL 解析失败，返回原始值
    }
}

// 更新统计卡片
function updateStatsCards(profileEl, stats) {
    console.log('Updating stats cards with:', stats);
    
    // 修改选择器以确保能正确找到两行
    const rows = profileEl.querySelectorAll('.stats-row');
    const firstRow = rows[0];  // 获取第一个 .stats-row
    const secondRow = rows[1]; // 获取第二个 .stats-row

    console.log('Found rows:', rows.length);  // 调试日志
    console.log('First row:', firstRow);
    console.log('Second row:', secondRow);

    // 更新第一行统计卡片
    if (firstRow) {
        firstRow.innerHTML = `
            <div class="stat-card">
                <div class="card-label">${getMessage('largestFolderLabel')}</div>
                <div class="card-value">${stats.largestFolder.count}</div>
                <div class="card-subtext">${stats.largestFolder.title}</div>
            </div>
            <div class="stat-card">
                <div class="card-label">${getMessage('emptyFoldersLabel')}</div>
                <div class="card-value">${stats.emptyFolders}</div>
            </div>
            <div class="stat-card">
                <div class="card-label">${getMessage('maxDepthLabel')}</div>
                <div class="card-value">${stats.maxDepth}</div>
            </div>
            <div class="stat-card">
                <div class="card-label">${getMessage('oldestBookmarkLabel')}</div>
                <div class="card-value">${extractMainDomain(stats.oldestBookmark?.url || '')}</div>
                <div class="card-subtext">${formatDate(stats.timeStats.oldest)}</div>
            </div>
            <div class="stat-card">
                <div class="card-label">${getMessage('latestBookmarkLabel')}</div>
                <div class="card-value">${extractMainDomain(stats.newestBookmark?.url || '')}</div>
                <div class="card-subtext">${formatDate(stats.timeStats.newest)}</div>
            </div>
            <div class="stat-card">
                <div class="card-label">${getMessage('bookmarkPeakLabel')}</div>
                <div class="card-value">${stats.timeStats.peakCount}</div>
                <div class="card-subtext">${stats.timeStats.peakDate}</div>
            </div>
        `;
    } else {
        console.error('First row not found');
    }

    // 更新第二行统计卡片
    if (secondRow) {
        secondRow.innerHTML = `
            <div class="stat-card">
                <div class="card-label">${getMessage('avgBookmarksPerFolderLabel')}</div>
                <div class="card-value">${stats.avgBookmarksPerFolder}</div>
            </div>
            <div class="stat-card">
                <div class="card-label">${getMessage('organizationScoreLabel')}</div>
                <div class="card-value">${stats.organizationScore}/10</div>
            </div>
            <div class="stat-card">
                <div class="card-label">${getMessage('topKeywordsLabel')}</div>
                <div class="card-value">${getTopKeywords(stats.keywords, 3)}</div>
            </div>
            <div class="stat-card">
                <div class="card-label">${getMessage('uniqueDomainsLabel')}</div>
                <div class="card-value">${stats.uniqueDomains.size}</div>
            </div>
            <div class="stat-card">
                <div class="card-label">${getMessage('httpsRatioLabel')}</div>
                <div class="card-value">${calculateHttpsRatio(stats.protocolStats)}%</div>
            </div>
            <div class="stat-card">
                <div class="card-label">${getMessage('duplicateUrlsLabel')}</div>
                <div class="card-value">${stats.duplicateUrls.count}</div>
                <div class="card-subtext">${stats.duplicateUrls.percentage}% of total</div>
            </div>
        `;
    } else {
        console.error('Second row not found');
    }
}

// 辅助函数：获取 URL 的域名
function getFirstDomainFromUrl(date) {
    if (!date) return '';
    // 实现获取域名的逻辑
    return 'domain.com'; // 这里需要实际实现
}

// 辅助数：获取前N个关键词
function getTopKeywords(keywords, n) {
    return Array.from(keywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([word]) => word)
        .join(', ');
}

// 辅助函数：计算 HTTPS 比例
function calculateHttpsRatio(protocolStats) {
    const total = protocolStats.http + protocolStats.https;
    return total > 0 
        ? Math.round((protocolStats.https / total) * 100)
        : 0;
}

// 添加 URL 标准化函数
function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.origin + urlObj.pathname.replace(/\/$/, '');
    } catch {
        return url;
    }
}

// 更新域名分析函数
async function updateDomainAnalysis(profileEl, stats) {
    const domainList = profileEl.querySelector('.domain-list');
    if (!domainList) return;

    // 获取所有域名并排序
    const topDomains = Array.from(stats.domains.entries())
        .sort((a, b) => b[1] - a[1]);

    // 计算总书签数用于百分比
    const totalBookmarks = stats.totalBookmarks;

    // 生成主要域名卡片（第一个域名）
    const primaryDomain = topDomains[0];
    const primaryPercentage = ((primaryDomain[1] / totalBookmarks) * 100).toFixed(1);
    const primaryFavicon = await getFavicon(primaryDomain[0]);

    // 生成次要域名列表（第2-5个域名）
    const secondaryDomains = topDomains.slice(1, 5);
    
    // 构建 HTML
    const html = `
        <div class="domain-item primary">
            <img class="domain-favicon" src="${primaryFavicon}" alt="${primaryDomain[0]}" 
                 onerror="this.src='icons/default-favicon.png'">
            <div class="domain-info">
                <div class="domain-name">${primaryDomain[0]}</div>
                <div class="domain-meta">
                    <span class="bookmark-count">${primaryDomain[1]} ${getMessage('bookmarks')}</span>
                    <span class="domain-percentage">${primaryPercentage}%</span>
                </div>
            </div>
        </div>
        <div class="domain-list-secondary">
            ${await Promise.all(secondaryDomains.map(async ([domain, count]) => {
                const percentage = ((count / totalBookmarks) * 100).toFixed(1);
                const favicon = await getFavicon(domain);
                return `
                    <div class="domain-item secondary">
                        <img class="domain-favicon" src="${favicon}" alt="${domain}" 
                             onerror="this.src='icons/default-favicon.png'">
                        <div class="domain-info">
                            <div class="domain-name">${domain}</div>
                            <div class="domain-meta">
                                <span class="bookmark-count">${count} ${getMessage('bookmarks')}</span>
                                <span class="domain-percentage">${percentage}%</span>
                            </div>
                        </div>
                    </div>
                `;
            })).then(items => items.join(''))}
        </div>
    `;

    domainList.innerHTML = html;
}

// 修改获取网站favicon的辅助函数
async function getFavicon(domain) {
    // 优先尝试新Favicon服务
    try {
        const faviconImUrl = `https://favicon.im/${domain}?sz=32`;
        const responseIm = await fetch(faviconImUrl);
        if (responseIm.ok) {
            return faviconImUrl;
        }
    } catch (error) {
        console.log('Favicon.im service failed:', error);
    }

    // 其次尝试Google服务
    try {
        const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        const responseGoogle = await fetch(googleFaviconUrl);
        if (responseGoogle.ok) {
            return googleFaviconUrl;
        }
    } catch (error) {
        console.log('Google favicon service failed:', error);
    }

    // 全部失败后回退到Chrome内置服务
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=https://${domain}&size=32`;
}

// 书签分类相关配置和函数
const TAG_CONFIGS = {
    TECH: {
        id: 'tech',
        domains: [
            // 国际技术站点
            'github.com', 'stackoverflow.com', 'dev.to', 'gitlab.com', 'npmjs.com', 'medium.com',
            'hashnode.com', 'devblogs.microsoft.com', 'aws.amazon.com', 'cloud.google.com',
            'developer.mozilla.org', 'codepen.io', 'freecodecamp.org', 'hackernoon.com',
            'digitalocean.com', 'dzone.com', 'infoq.com', 'nginx.com', 'docker.com',
            
            // 中文技术社区
            'juejin.cn', 'csdn.net', 'oschina.net', 'segmentfault.com', 'v2ex.com', 'cnblogs.com',
            'infoq.cn', 'gitee.com', 'cloud.tencent.com', 'aliyun.com', 'huaweicloud.com',
            'ruanyifeng.com', 'liaoxuefeng.com', 'bootcss.com', 'php.cn', 'pythonheidong.com',
            'kotlincn.net', 'rustcc.cn', 'golangtc.com', 'react.docschina.org', 'vuejs.cn',
            
            // 日本技术社区
            'qiita.com', 'zenn.dev', 'techblog.yahoo.co.jp', 'developers.cyberagent.co.jp',
            'engineering.mercari.com', 'developer.hatenastaff.com', 'tech.pepabo.com',
            'engineering.dena.com', 'techlife.cookpad.com', 'tech.uzabase.com',
            
            // 韩国技术社区
            'tistory.com', 'okky.kr', 'tech.kakao.com', 'woowabros.github.io',
            'tech.naver.com', 'tech.coupang.com', 'netmarble.info',
            
            // 美国技术社区
            'dev.to', 'hashnode.com', 'producthunt.com', 'techcrunch.com', 
            'wired.com', 'arstechnica.com', 'thenextweb.com', 'venturebeat.com',
            'slashdot.org', 'macrumors.com', 'androidcentral.com', '9to5mac.com',
            'zdnet.com', 'cnet.com', 'theverge.com', 'engadget.com',
            
            // 欧洲技术社区
            'heise.de', 'golem.de', 't3n.de', // 德国
            'developpez.com', 'journaldunet.com', // 法国
            'webdesignerdepot.com', // 英国
            'tweakers.net', // 荷兰
            'hwupgrade.it', // 意大利
            'xataka.com', 'genbeta.com', // 西班牙
            'sweclockers.com', // 瑞典
            'root.cz', // 捷克
        ],
        keywords: ['coding', 'programming', 'developer', 'tech', 'github', 'devops', 'frontend', 'backend',
                  '编程', '技术', '开发', '架构', '算法', '数据库', '云计算', '人工智能',
                  'プログラミング', '技術', '開発', 'エンジニア', 'アーキテクチャ',
                  '개발', '프로그래밍', '기술', '엔지니어링', '알고리즘',
                  // 欧洲语言关键词
                  'entwicklung', 'programmierung', // 德语
                  'développement', 'programmation', // 法语
                  'sviluppo', 'programmazione', // 意大利语
                  'desarrollo', 'programación', // 西班牙语
                  'utveckling', 'programmering', // 瑞典语
        ],
        label: {
            zh: '技术达人',
            en: 'Tech Savvy'
        },
        color: '#007AFF',
        threshold: 0.02
    },
    LEARNING: {
        id: 'learning',
        domains: [
            // 国际教育平台
            'coursera.org', 'udemy.com', 'edx.org', 'youtube.com', 'brilliant.org', 'khanacademy.org',
            'codecademy.com', 'pluralsight.com', 'linkedin.com/learning', 'skillshare.com',
            'masterclass.com', 'datacamp.com', 'duolingo.com', 'memrise.com', 'busuu.com',
            'udacity.com', 'sololearn.com', 'w3schools.com', 'geeksforgeeks.org',
            
            // 中文学习平台
            'mooc.cn', 'xuetangx.com', 'icourse163.org', 'bilibili.com', 'zhihu.com',
            'imooc.com', 'xueqiu.com', 'youdao.com', 'hujiang.com', 'tingroom.com',
            'shiguangkey.com', 'koolearn.com', 'wanmen.org', 'doyoudo.com', 'guokr.com',
            'ximalaya.com', 'dedao.cn', 'geekbang.org',
            
            // 日本学习平台
            'schoo.jp', 'prog-8.com', 'studyplus.jp', 'progate.com', 'dotinstall.com',
            'nnn.ed.nico', 'recursionist.io', 'paiza.jp', 'techacademy.jp', 'udemy.benesse.co.jp',
            
            // 韩国学习平台
            'inflearn.com', 'opentutorials.org', 'programmers.co.kr', 'edwith.org',
            'tacademy.skplanet.com', 'codeit.kr', 'fastcampus.co.kr', 'coloso.co.kr',
            
            // 美国教育平台
            'lynda.com', 'teamtreehouse.com', 'codecademy.com', 'brilliant.org',
            'coursera.org', 'edx.org', 'udacity.com', 'skillshare.com',
            'masterclass.com', 'thegreatcourses.com', 'scholastic.com',
            'khanacademy.org', 'brainpop.com', 'ixl.com', 'quizlet.com',
            
            // 欧洲教育平台
            'openclassrooms.com', 'fun-mooc.fr', // 法国
            'studysmarter.de', 'lecturio.de', // 德国
            'futurelearn.com', 'open.edu', // 英国
            'federica.eu', // 意大利
            'miriadax.net', // 西班牙
            'iversity.org', // 德国
            'alison.com', // 爱尔兰
        ],
        keywords: ['course', 'learn', 'tutorial', 'education', 'study', 'training', 'mooc',
                  '学习', '教程', '课程', '培训', '讲座', '考试', '知识', '教育',
                  '講座', '学習', 'レッスン', '教育', 'スキル', 'トレーニング',
                  '강의', '교육', '학습', '튜토리얼', '공부', '트레이닝',
                  // 欧洲语言关键词
                  'lernen', 'bildung', 'kurs', // 德语
                  'apprendre', 'éducation', 'cours', // 法语
                  'imparare', 'educazione', 'corso', // 意大利语
                  'aprender', 'educación', 'curso', // 西班牙语
                  'lära', 'utbildning', 'kurs', // 瑞典语
        ],
        label: {
            zh: '终身学习',
            en: 'Lifelong Learner'
        },
        color: '#34C759',
        threshold: 0.001
    },
    TOOLS: {
        id: 'tools',
        domains: [
            // 通用工具域名
            'tools.', 'app.', 'web.', 'online.', 'converter.', 'generator.',
            'calculator.', 'translate.', 'editor.', 'viewer.',
            
            // 常用工具网站
            'notion.so', 'figma.com', 'canva.com', 'miro.com', 'trello.com',
            'airtable.com', 'evernote.com', 'asana.com', 'monday.com', 'clickup.com',
            'draw.io', 'mindmeister.com', 'xmind.net', 'processon.com', 'regex101.com',
            'caniuse.com', 'jsoneditoronline.org', 'tinypng.com', 'remove.bg',
            
            // 中文工具网站
            'tool.lu', 'toolnb.com', 'tool.oschina.net', 'atool.org', 'tool.chinaz.com',
            'tool.lu', 'bejson.com', 'json.cn', 'tool.browser.qq.com', 'uupoop.com',
            
            // 日本工具网站
            'webtools.dounokouno.com', 'tools.m-bsys.com', 'toolbox.winofsql.jp',
            'tools.stabucky.com', 'tools.digitalstrength.jp',
            
            // 韩国工具网站
            'tools.infocloud.co.kr', 'seochecker.kr', 'regexr.kr', 'miricanvas.com'
        ],
        keywords: ['tool', 'utility', 'generator', 'converter', 'calculator', 'editor', 'viewer',
                  '工具', '在线', '转换器', '生成器', '编辑器', '查看器',
                  'ツール', 'オンライン', 'ジェネレーター', 'エディター', 'ビューア',
                  '도구', '온라인', '변환기', '생성기', '편집기', '뷰어'],
        label: {
            zh: '工具控',
            en: 'Tool Master'
        },
        color: '#FF9500',
        threshold: 0.005
    },
    SOCIAL: {
        id: 'social',
        domains: [
            // 国际社交平台
            'twitter.com', 'linkedin.com', 'facebook.com', 'instagram.com', 'reddit.com',
            'discord.com', 'telegram.org', 'whatsapp.com', 'messenger.com', 'slack.com',
            'pinterest.com', 'tumblr.com', 'quora.com', 'medium.com', 'tiktok.com',
            'snapchat.com', 'meetup.com', 'nextdoor.com', 'twitch.tv', 'clubhouse.com',
            
            // 中文社交平台
            'weibo.com', 'douban.com', 'xiaohongshu.com', 'zhihu.com', 'tieba.baidu.com',
            'douyin.com', 'kuaishou.com', 'qq.com', 'weixin.qq.com', 'hupu.com',
            'dongchedi.com', 'maimai.cn', 'lofter.com', 'douban.com/group', 'jianshu.com',
            'zuimeia.com', 'woshipm.com', 'sspai.com', 'jandan.net', 'guokr.com',
            
            // 日本社交平台
            'mixi.jp', 'line.me', 'ameba.jp', 'note.com', 'pixiv.net',
            'nicovideo.jp', 'booth.pm', '5ch.net', 'gree.jp', 'hatena.ne.jp',
            'space.bilibili.com', 'fantia.jp', 'peing.net', 'marshmallow-qa.com',
            
            // 韩国社交平台
            'naver.com', 'daum.net', 'band.us', 'cafe.naver.com', 'cafe.daum.net',
            'dcinside.com', 'inven.co.kr', 'theqoo.net', 'instiz.net', 'dogdrip.net'
        ],
        keywords: ['social', 'community', 'network', 'share', 'forum', 'chat', 'message',
                  '社交', '社区', '论坛', '聊天', '分享', '交流', '圈子',
                  'コミュニティ', 'フォーラム', 'チャット', 'メッセージ', 'シェア',
                  '커뮤니티', '포럼', '채팅', '메시지', '공유', '소통'],
        label: {
            zh: '社交达人',
            en: 'Social Butterfly'
        },
        color: '#FF2D55',
        threshold: 0.005
    },
    NEWS: {
        id: 'news',
        domains: [
            // 国际新闻
            'news.google.com', 'reuters.com', 'bloomberg.com', 'apnews.com', 'bbc.com',
            'cnn.com', 'nytimes.com', 'wsj.com', 'ft.com', 'economist.com',
            'theguardian.com', 'aljazeera.com', 'time.com', 'forbes.com', 'businessinsider.com',
            'techcrunch.com', 'engadget.com', 'theverge.com', 'wired.com', 'vice.com',
            
            // 中文新闻
            'news.sina.com.cn', 'news.163.com', 'thepaper.cn', 'caixin.com', 'jiemian.com',
            'qq.com/news', 'sohu.com/news', 'ifeng.com', 'people.com.cn', 'xinhuanet.com',
            'huanqiu.com', 'guancha.cn', 'yicai.com', 'ce.cn', 'stcn.com',
            '36kr.com', 'tmtpost.com', 'pingwest.com', 'huxiu.com', 'geekpark.net',
            
            // 日本新闻
            'news.yahoo.co.jp', 'nikkei.com', 'asahi.com', 'yomiuri.co.jp', 'mainichi.jp',
            'sankei.com', 'nhk.or.jp/news', 'news.livedoor.com', 'newsweekjapan.jp',
            'bloomberg.co.jp', 'reuters.co.jp', 'cnn.co.jp', 'bbc.jp', 'huffingtonpost.jp',
            
            // 韩国新闻
            'news.naver.com', 'news.daum.net', 'chosun.com', 'donga.com', 'joongang.co.kr',
            'hani.co.kr', 'mk.co.kr', 'mt.co.kr', 'hankyung.com', 'sedaily.com',
            'nocutnews.co.kr', 'newsis.com', 'ytn.co.kr', 'yna.co.kr', 'newspim.com',
            
            // 美国新闻网站
            'nytimes.com', 'wsj.com', 'washingtonpost.com', 'usatoday.com',
            'latimes.com', 'nypost.com', 'chicagotribune.com', 'sfgate.com',
            'politico.com', 'thehill.com', 'axios.com', 'vox.com', 'slate.com',
            'fivethirtyeight.com', 'bloomberg.com', 'cnbc.com', 'foxnews.com',
            'nbcnews.com', 'abcnews.go.com', 'cbsnews.com',
            
            // 欧洲新闻网站
            // 英国
            'bbc.co.uk', 'theguardian.com', 'telegraph.co.uk', 'independent.co.uk',
            'dailymail.co.uk', 'thetimes.co.uk', 'mirror.co.uk', 'express.co.uk',
            
            // 德国
            'spiegel.de', 'faz.net', 'sueddeutsche.de', 'zeit.de',
            'welt.de', 'bild.de', 'stern.de', 'focus.de',
            
            // 法国
            'lemonde.fr', 'lefigaro.fr', 'liberation.fr', 'leparisien.fr',
            'lexpress.fr', 'lepoint.fr', 'nouvelobs.com', '20minutes.fr',
            
            // 意大利
            'repubblica.it', 'corriere.it', 'lastampa.it', 'ilsole24ore.com',
            
            // 西班牙
            'elpais.com', 'elmundo.es', 'abc.es', 'lavanguardia.com',
            
            // 其他欧洲国家
            'nrc.nl', 'volkskrant.nl', // 荷兰
            'aftonbladet.se', 'dn.se', // 瑞典
            'vg.no', 'dagbladet.no', // 挪威
            'hs.fi', 'yle.fi', // 芬兰
            'dr.dk', 'politiken.dk', // 丹麦
        ],
        keywords: ['news', 'daily', 'newspaper', 'media', 'press', 'journal', 'report',
                  '新闻', '资讯', '日报', '时报', '周刊', '媒体', '报道',
                  'ニュース', '新聞', '報道', 'メディア', 'プレス', 'ジャーナル',
                  '뉴스', '신문', '미디어', '언론', '도', '주간지'],
        label: {
            zh: '新闻达人',
            en: 'News Enthusiast'
        },
        color: '#5856D6',
        threshold: 0.005
    },
    SHOPPING: {
        id: 'shopping',
        domains: [
            // 国际购物
            'amazon.com', 'ebay.com', 'aliexpress.com', 'walmart.com', 'etsy.com',
            'wish.com', 'shopify.com', 'bestbuy.com', 'target.com', 'newegg.com',
            'wayfair.com', 'homedepot.com', 'ikea.com', 'zalando.com', 'asos.com',
            
            // 中国购物
            'taobao.com', 'tmall.com', 'jd.com', 'pinduoduo.com', 'suning.com',
            'vip.com', 'dangdang.com', 'kaola.com', 'xiaomiyoupin.com', 'gome.com.cn',
            'meituan.com', 'ele.me', 'yangkeduo.com', 'mogujie.com', 'xiaohongshu.com',
            
            // 日本购物
            'amazon.co.jp', 'rakuten.co.jp', 'yahoo.co.jp/shopping', 'zozo.jp',
            'mercari.com', 'uniqlo.com/jp', 'yodobashi.com', 'bic-camera.com',
            'muji.com/jp', 'dmm.com', 'bellemaison.jp', 'nissen.co.jp',
            
            // 韩国购物
            'gmarket.co.kr', 'coupang.com', '11st.co.kr', 'auction.co.kr',
            'wemakeprice.com', 'tmon.co.kr', 'musinsa.com', 'gsshop.com',
            'emart.com', 'lotteon.com', 'ssg.com', 'oliveyoung.co.kr',
            
            // 美国购物网站
            'amazon.com', 'walmart.com', 'target.com', 'bestbuy.com',
            'homedepot.com', 'lowes.com', 'costco.com', 'samsclub.com',
            'macys.com', 'nordstrom.com', 'kohls.com', 'wayfair.com',
            'chewy.com', 'dickssportinggoods.com', 'academy.com',
            
            // 欧洲购物网站
            // 跨区域
            'zalando.com', 'asos.com', 'aboutyou.de', 'boozt.com',
            
            // 英国
            'tesco.com', 'sainsburys.co.uk', 'asda.com', 'boots.com',
            'marksandspencer.com', 'johnlewis.com', 'argos.co.uk',
            
            // 德国
            'otto.de', 'mediamarkt.de', 'saturn.de', 'douglas.de',
            'lidl.de', 'aldi.de', 'kaufland.de', 'real.de',
            
            // 法国
            'cdiscount.com', 'fnac.com', 'darty.com', 'carrefour.fr',
            'auchan.fr', 'leclerc.fr', 'boulanger.com',
            
            // 意大利
            'esselunga.it', 'conad.it', 'euronics.it', 'unieuro.it',
            
            // 西班牙
            'elcorteingles.es', 'mediamarkt.es', 'pccomponentes.com',
            
            // 北欧
            'elkjop.no', 'power.dk', 'gigantti.fi', 'komplett.se'
        ],
        keywords: ['shopping', 'store', 'mall', 'market', 'buy', 'shop', 'price',
                  '购物', '商城', '店铺', '市场', '价格', '优惠', '折扣',
                  'ショッピング', '通販', '買い物', 'ストア', 'モール', 'マーケット',
                  '쇼핑', '스토어', '마켓', '구매', '할인', '매장'],
        label: {
            zh: '购物达人',
            en: 'Shopping Expert'
        },
        color: '#FF9500',
        threshold: 0.005
    },
    ENTERTAINMENT: {
        id: 'entertainment',
        domains: [
            // 国际娱乐
            'youtube.com', 'netflix.com', 'spotify.com', 'twitch.tv', 'disney.com',
            'hulu.com', 'soundcloud.com', 'vimeo.com', 'imdb.com', 'rottentomatoes.com',
            'lastfm.com', 'pandora.com', 'deezer.com', 'tidal.com', 'crunchyroll.com',
            
            // 中国娱乐
            'bilibili.com', 'iqiyi.com', 'youku.com', 'qq.com/video', 'le.com',
            'music.163.com', 'y.qq.com', 'kugou.com', 'kuwo.cn', 'douban.com/movie',
            'mgtv.com', 'pptv.com', 'douyu.com', 'huya.com', 'acfun.cn',
            
            // 日本娱乐
            'nicovideo.jp', 'abema.tv', 'tver.jp', 'unext.jp', 'dmm.com',
            'music.jp', 'line.me/music', 'radiko.jp', 'showroom-live.com',
            'bandainamco-ol.jp', 'square-enix.com', 'capcom.com',
            
            // 韩国娱乐
            'vlive.tv', 'melon.com', 'genie.co.kr', 'bugs.co.kr', 'watcha.com',
            'tving.com', 'afreecatv.com', 'gameshot.net', 'nexon.com', 'ncsoft.com',
            
            // 美国娱乐网站
            'hbo.com', 'peacocktv.com', 'paramountplus.com', 'disneyplus.com',
            'espn.com', 'nba.com', 'nfl.com', 'mlb.com', 'nhl.com',
            'ign.com', 'gamespot.com', 'polygon.com', 'kotaku.com',
            'metacritic.com', 'rottentomatoes.com', 'boxofficemojo.com',
            
            // 欧洲娱乐网站
            // 英国
            'bbc.co.uk/iplayer', 'itv.com', 'channel4.com', 'sky.com',
            
            // 德国
            'prosieben.de', 'rtl.de', 'zdf.de', 'ard.de',
            'sky.de', 'dazn.com/de', 'gamestar.de',
            
            // 法国
            'tf1.fr', 'france.tv', 'canalplus.com', 'jeuxvideo.com',
            
            // 北欧
            'viaplay.com', 'cmore.se', 'dplay.dk',
            'ruutu.fi', 'nrk.no', 'tv2.dk',
            
            // 体育网站
            'uefa.com', 'fifa.com', 'eurosport.com', 'skysports.com',
            'marca.com', 'lequipe.fr', 'kicker.de', 'gazzetta.it'
        ],
        keywords: ['entertainment', 'video', 'music', 'movie', 'game', 'anime', 'stream',
                  '娱乐', '视频', '音乐', '电影', '游戏', '动漫', '直播',
                  'エンタメ', '動画', '音楽', '映画', 'ゲーム', 'アニメ', '配信',
                  '엔터테인먼트', '비디오', '음악', '영화', '게임', '애니메이션', '방송'],
        label: {
            zh: '娱乐达人',
            en: 'Entertainment Guru'
        },
        color: '#FF3B30',
        threshold: 0.005
    }
};

// 完善书签分类函数
function categorizeBookmark(node, stats) {
    if (!node.url) return null;

    try {
        const url = new URL(node.url);
        const domain = url.hostname.toLowerCase();
        const title = (node.title || '').toLowerCase();
        const categories = {};

        // 遍历所有标签配置
        Object.entries(TAG_CONFIGS).forEach(([tag, config]) => {
            let score = 0;

            // 检查域名匹配
            if (config.domains.some(d => domain.includes(d))) {
                score += 0.6;
            }

            // 检查关键词匹配
            if (config.keywords.some(k => title.includes(k))) {
                score += 0.4;
            }

            // 如果分数超过阈值，添加到分类中
            if (score >= config.threshold) {
                categories[tag] = score;
            }
        });

        return Object.keys(categories).length > 0 ? categories : null;
    } catch (e) {
        console.warn('Error categorizing bookmark:', e);
        return null;
    }
}

// 完善域名分类函数
function categorizeDomains(stats) {
    const categoryStats = {
        tech: 0,
        learning: 0,
        tools: 0,
        social: 0
    };

    // 遍历所有域名
    stats.domains.forEach((count, domain) => {
        domain = domain.toLowerCase();
        
        // 检查每个分类的域名匹配
        Object.entries(TAG_CONFIGS).forEach(([tag, config]) => {
            if (config.domains.some(d => domain.includes(d))) {
                categoryStats[config.id] += count;
            }
        });
    });

    return categoryStats;
}

// 添加显示分类标签的函数
function updateCategoryTags(profileEl, stats) {
    console.log('Updating category tags with stats:', stats);
    
    if (!stats.domains || !(stats.domains instanceof Map)) {
        console.error('Invalid domains data:', stats.domains);
        return;
    }

    const categoryStats = categorizeDomains(stats);
    console.log('Categorized stats:', categoryStats);
    
    const totalBookmarks = stats.totalBookmarks;
    console.log('Total bookmarks:', totalBookmarks);

    // 创建标签容器
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'category-tags';
    
    // 添加标签
    Object.entries(TAG_CONFIGS).forEach(([tag, config]) => {
        const count = categoryStats[config.id];
        console.log(`Processing tag ${config.id}: count = ${count}`);
        
        if (count > 0) {
            const percentage = ((count / totalBookmarks) * 100).toFixed(1);
            console.log(`${config.id} percentage: ${percentage}%`);
            
            // 只要有相关书签就显示标签
            const tagEl = document.createElement('div');
            tagEl.className = 'category-tag';
            tagEl.style.backgroundColor = `${config.color}15`;
            tagEl.style.color = config.color;
        
            
            const currentLang = chrome.i18n.getUILanguage().startsWith('zh') ? 'zh' : 'en';
            tagEl.innerHTML = `
                <span class="tag-label">${config.label[currentLang]}</span>
                <span class="tag-percentage">${percentage}%</span>
            `;
            
            tagsContainer.appendChild(tagEl);
            console.log(`Added tag: ${config.label[currentLang]}`);
        }
    });

    // 添加到页面
    const targetContainer = profileEl.querySelector('.profile-overview');
    if (targetContainer) {
        // 移除现有的标签容器
        const existingTags = targetContainer.querySelector('.category-tags');
        if (existingTags) {
            existingTags.remove();
        }
        // 添加新的标签容器
        const trendChart = targetContainer.querySelector('.trend-chart');
        if (trendChart) {
            targetContainer.insertBefore(tagsContainer, trendChart);
            console.log('Tags container inserted into DOM');
        } else {
            targetContainer.appendChild(tagsContainer);
            console.log('Tags container appended to target container');
        }
    }
}

// 计算收藏者等级
function calculateCollectorLevel(stats) {
    const scores = calculateDetailedScores(stats);
    const totalScore = scores.totalScore;
    
    // 直接根据分数判断等级
    if (totalScore >= 527) return 10;
    if (totalScore >= 271) return 9;
    if (totalScore >= 143) return 8;
    if (totalScore >= 79) return 7;
    if (totalScore >= 47) return 6;
    if (totalScore >= 31) return 5;
    if (totalScore >= 23) return 4;
    if (totalScore >= 19) return 3;
    if (totalScore >= 17) return 2;
    if (totalScore >= 16) return 1;
    return 1;
}

// 添加收藏者称号常量
const COLLECTOR_TITLES = {
    1: { zh: '初级收藏家', en: 'Novice Collector' },      // 16分
    2: { zh: '业余收藏家', en: 'Amateur Collector' },      // 17分
    3: { zh: '进阶收藏家', en: 'Advanced Collector' },     // 19分
    4: { zh: '专业收藏家', en: 'Professional Collector' }, // 23分
    5: { zh: '精英收藏家', en: 'Elite Collector' },        // 31分
    6: { zh: '大师收藏家', en: 'Master Collector' },       // 47分
    7: { zh: '专家收藏家', en: 'Expert Collector' },       // 79分
    8: { zh: '传奇收藏家', en: 'Legendary Collector' },    // 143分
    9: { zh: '终极收藏家', en: 'Ultimate Collector' },     // 271分
    10: { zh: '神级收藏家', en: 'Divine Collector' }       // 527分
};

// 修改收藏者称号计算提示的部分
function getTooltipContent(currentLevel) {
    return {
        zh: `
            <div class="tooltip-title">收藏者称号计算：</div>
            <div class="title-list">
                ${Object.entries(COLLECTOR_TITLES).map(([lvl, titles]) => {
            const requiredScore = Math.pow(2, lvl - 1) + 15;
            return `
                        <div class="title-item ${lvl == currentLevel ? 'current' : ''}">
                            <span class="title-level">Lv.${lvl}</span>
                            <span class="title-name">${titles.zh}</span>
                            <span class="title-score">${requiredScore}分</span>
                        </div>
                    `;
        }).join('')}
            </div>
            <div class="calculation-formula">
                <div>称号等级计算公式：</div>
                <div>所需分数 = 2^(等级-1) + 15</div>
                <div>例如：Lv.6需要 2^5 + 15 = 47分</div>
            </div>
        `,
        en: `
            <div class="tooltip-title">Collector Title Calculation:</div>
            <div class="title-list">
                ${Object.entries(COLLECTOR_TITLES).map(([lvl, titles]) => {
            const requiredScore = Math.pow(2, lvl - 1) + 15;
            return `
                        <div class="title-item ${lvl == currentLevel ? 'current' : ''}">
                            <span class="title-level">Lv.${lvl}</span>
                            <span class="title-name">${titles.en}</span>
                            <span class="title-score">${requiredScore} pts</span>
                        </div>
                    `;
        }).join('')}
            </div>
            <div class="calculation-formula">
                <div>Title Level Calculation Formula:</div>
                <div>Required Score = 2^(level-1) + 15</div>
                <div>Example: Lv.6 requires 2^5 + 15 = 47 pts</div>
            </div>
        `
    };
}
// 在需要使用 tooltipContent 的地方，传入当前等级
function updateTooltip(currentLevel) {
    const tooltipContent = getTooltipContent(currentLevel);
    // 使用 tooltipContent...
}
// 在文件末尾添加分享相关函数
async function initShareFeature() {
    console.log('Initializing share feature...');
    
    const shareButton = document.querySelector('.share-button');
    if (!shareButton) return;
    
    console.log('Share button found:', shareButton);
    
    // 移除所有现有的点击事件监听器
    shareButton.replaceWith(shareButton.cloneNode(true));
    
    // 重新获取新的按钮元素
    const newShareButton = document.querySelector('.share-button');
    
    // 添加单个事件监听器
    newShareButton?.addEventListener('click', async () => {
        console.log('Share button clicked');
        try {
            // 禁用按钮防止重复点击
            newShareButton.disabled = true;
            
            const nickname = await getNickname();
            if (!nickname) {
                alert(getMessage('nicknameNotFound'));
                newShareButton.disabled = false;
                return;
            }

            // 保存并修改分享按钮
            const originalShareButtonHtml = newShareButton.innerHTML;
            const originalShareButtonStyle = newShareButton.getAttribute('style');

            // 将分享按钮改为品牌样式
            newShareButton.innerHTML = `
                <div class="brand" style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 12px;
                    background: white;
                    border-radius: 20px;
                    border: 1px solid rgba(0, 0, 0, 0.05);
                ">
                    <img src="images/logo.jpg" alt="懒猫书签清理" style="
                        width: 20px;
                        height: 20px;
                        border-radius: 4px;
                    ">
                    <span style="
                        color: #10b981;
                        font-size: 14px;
                        font-weight: 500;
                    ">懒猫书签清理</span>
                </div>
            `;
            newShareButton.style.background = 'none';
            newShareButton.style.border = 'none';
            newShareButton.style.padding = '0';

            // 等待DOM更新和图片加载
            await new Promise(resolve => setTimeout(resolve, 300));

            // 生成图片
            const profileElement = document.querySelector('.bookmark-profile');
            const canvas = await html2canvas(profileElement, {
                scale: 2,
                backgroundColor: getComputedStyle(document.body).backgroundColor,
                logging: true,
                useCORS: true,
                allowTaint: true,
                onclone: (clonedDoc) => {
                    // 为克隆的文档中的统计卡片添加内联样式
                    const statItems = clonedDoc.querySelectorAll('.overview-stats .stat-item');
                    statItems.forEach(item => {
                        item.style.backgroundColor = 'white';
                        item.style.borderRadius = '16px';
                        item.style.padding = '24px';
                        item.style.boxShadow = '0 2px 0 rgba(0,0,0,0.015), 0 4px 0 rgba(0,0,0,0.015), 0 6px 0 rgba(0,0,0,0.015), 0 8px 0 rgba(0,0,0,0.015)';
                        item.style.border = '1px solid rgba(0,0,0,0.05)';
                    });
                },
                removeContainer: false,
                backgroundColor: '#F5F5F7'
            });

            // 转换为图片并下载
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `bookmark-profile-${nickname}.png`;
            link.href = imgData;
            link.click();

            // 恢复按钮状态
            newShareButton.disabled = false;
            newShareButton.innerHTML = originalShareButtonHtml;
            if (originalShareButtonStyle) {
                newShareButton.setAttribute('style', originalShareButtonStyle);
            } else {
                newShareButton.removeAttribute('style');
            }

        } catch (error) {
            console.error('Error generating image:', error);
            alert(getMessage('shareError'));
            newShareButton.disabled = false;
        }
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded');
    try {
        await initShareFeature();
        console.log('Share feature initialized');
    } catch (error) {
        console.error('Error initializing share feature:', error);
    }
    // 获取清单文件中的版本号
    const manifest = chrome.runtime.getManifest();
    const version = manifest.version;

    // 创建版本号元素
    const versionTag = document.createElement('span');
    versionTag.className = 'version-tag';
    versionTag.textContent = `v${version}`;

    // 将版本号添加到 brand div 中
    const brandDiv = document.querySelector('.brand');
    if (brandDiv) {
        brandDiv.appendChild(versionTag);
    }
});

// 导出需要的函数
export {
    initBookmarkProfile,
    generateBookmarkProfile,
    calculateBookmarkStats,
    categorizeBookmark,
    categorizeDomains,
    TAG_CONFIGS,
    initShareFeature

    // ... 其他需要导出的内容 ...
}; 