import { createConfetti } from './confetti.js';

class DuplicateBookmarkManager {
    constructor() {
        this.duplicateUrls = [];
        this.initElements();
        this.initEventListeners();
        this.initCheckboxListeners();
        // 页面加载完成后自动扫描
        this.scanDuplicates();
        this.initScrollListener();
    }

    initElements() {
        // 获取DOM元素
        this.duplicateUrlCount = document.getElementById('duplicate-urls');
        this.duplicateBookmarkCount = document.getElementById('duplicate-bookmarks');
        this.duplicateOptions = document.querySelector('.duplicate-options');
        this.duplicateGroupsContainer = document.querySelector('.duplicate-groups');
        this.noDuplicatesMessage = document.querySelector('.no-duplicates');
        
        // 获取模板
        this.groupTemplate = document.getElementById('duplicate-group-template');
        this.bookmarkTemplate = document.getElementById('bookmark-item-template');

        this.deleteSelectedButton = document.querySelector('button[data-action="deleteSelected"]');
        this.cancelSelectionButton = document.querySelector('button[data-action="cancelSelection"]');
        this.cancelSelectionButton.querySelector('span').setAttribute('data-i18n', 'cancelSelection');
        this.keepNewestButton = document.querySelector('button[data-action="keepNewest"]');
        this.keepOldestButton = document.querySelector('button[data-action="keepOldest"]');
    }

    initEventListeners() {
        // 批量操作按钮事件
        document.querySelectorAll('.duplicate-options button').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.closest('button').dataset.action;
                if (action === 'keepNewest') {
                    this.keepNewestBookmarks();
                } else if (action === 'keepOldest') {
                    this.keepOldestBookmarks();
                } else if (action === 'deleteSelected') {
                    this.deleteSelectedBookmarks();
                } else if (action === 'cancelSelection') {
                    this.cancelSelection();
                }
            });
        });
    }

    initCheckboxListeners() {
        // 监听所有复选框的变化事件（包括组级别和单个书签的复选框）
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('keep-checkbox') || e.target.classList.contains('group-checkbox')) {
                this.updateDeleteButtonVisibility();
            }
        });
    }

    updateDeleteButtonVisibility() {
        const hasCheckedBoxes = document.querySelector('.keep-checkbox:checked') !== null;
        this.deleteSelectedButton.style.display = hasCheckedBoxes ? 'inline-flex' : 'none';
        this.cancelSelectionButton.style.display = hasCheckedBoxes ? 'inline-flex' : 'none';
    }

    async scanDuplicates() {
        try {
            const bookmarks = await this.getAllBookmarks();
            this.duplicateUrls = this.findDuplicates(bookmarks);
            this.updateStats();
            this.renderResults();
            
            // 如果没有重复书签，显示成功状态并触发撒花
            if (this.duplicateUrls.length === 0) {
                this.showSuccessState();
            }
        } catch (error) {
            console.error('Error scanning duplicates:', error);
        }
    }

    showSuccessState() {
        // 显示成功状态
        this.noDuplicatesMessage.style.display = 'block';
        this.duplicateOptions.style.display = 'none';
        this.duplicateGroupsContainer.innerHTML = '';
        
        // 触发撒花效果
        createConfetti();
    }

    async getAllBookmarks() {
        try {
            // 直接使用await替代Promise构造器
            const bookmarkTree = await browser.bookmarks.getTree();
            const bookmarks = [];
            
            this.traverseBookmarks(bookmarkTree[0], bookmarks);
            
            return bookmarks;
        } catch (error) {
            console.error("获取书签失败:", error);
            // 保持与原始Promise reject行为一致
            throw error; 
        }
    }

    traverseBookmarks(node, bookmarks, path = []) {
        if (node.url) {
            bookmarks.push({
                id: node.id,
                title: node.title,
                url: node.url,
                dateAdded: node.dateAdded,
                path: [...path]
            });
        }
        if (node.children) {
            const newPath = node.title ? [...path, node.title] : path;
            node.children.forEach(child => this.traverseBookmarks(child, bookmarks, newPath));
        }
    }

    findDuplicates(bookmarks) {
        const urlMap = new Map();
        
        // 按完整URL分组
        bookmarks.forEach(bookmark => {
            const url = bookmark.url.trim(); // 只做简单的空格处理
            if (!urlMap.has(url)) {
                urlMap.set(url, []);
            }
            urlMap.get(url).push(bookmark);
        });

        // 过滤出重复的组
        return Array.from(urlMap.values())
            .filter(group => group.length > 1)
            .sort((a, b) => b.length - a.length);
    }

    updateStats() {
        // 重复URL数量
        this.duplicateUrlCount.textContent = this.duplicateUrls.length;
        
        // 重复书签数量
        const totalDuplicateBookmarks = this.duplicateUrls.reduce(
            (sum, group) => sum + group.length, 
            0
        );
        this.duplicateBookmarkCount.textContent = totalDuplicateBookmarks;
        
        // 显示/隐藏操作按钮和成功状态
        this.duplicateOptions.style.display = this.duplicateUrls.length > 0 ? 'flex' : 'none';
        this.noDuplicatesMessage.style.display = this.duplicateUrls.length === 0 ? 'block' : 'none';
    }

    renderResults() {
        this.duplicateGroupsContainer.innerHTML = '';
        
        this.duplicateUrls.forEach(group => {
            const groupElement = this.renderDuplicateGroup(group);
            this.duplicateGroupsContainer.appendChild(groupElement);
        });
    }

    renderDuplicateGroup(group) {
        const container = this.groupTemplate.content.cloneNode(true).querySelector('.duplicate-group');
        
        // 设置组标题
        const favicon = container.querySelector('.favicon');
        const urlLink = container.querySelector('.url');
        const duplicateItemsSpan = container.querySelector('[data-i18n="duplicateItems"]');
        
        // 本地化 duplicateItems 文本
        if (duplicateItemsSpan) {
            duplicateItemsSpan.textContent = chrome.i18n.getMessage('duplicateItems');
        }

        try {
            const url = new URL(group[0].url);
            favicon.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url.href)}`;
            urlLink.href = url.href;
            urlLink.textContent = url.href;
            urlLink.className = 'url bookmark-url';
            
            // 添加组级别的复选框
            const groupCheckbox = document.createElement('input');
            groupCheckbox.type = 'checkbox';
            groupCheckbox.className = 'group-checkbox';
            
            // 添加复选框的事件监听
            groupCheckbox.addEventListener('change', (e) => {
                const checkboxes = container.querySelectorAll('.keep-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            });

            // 将复选框插入到 favicon 之前
            container.querySelector('.group-title').insertBefore(groupCheckbox, favicon);

        } catch {
            favicon.style.display = 'none';
            urlLink.textContent = group[0].url;
        }

        // 设置计数
        container.querySelector('.count').textContent = group.length;
        
        // 添加书签项
        const itemsContainer = container.querySelector('.group-items');
        group.forEach(bookmark => {
            const bookmarkElement = this.renderBookmarkItem(bookmark);
            itemsContainer.appendChild(bookmarkElement);
        });

        // 添加子项复选框变化的事件监听，用于更新组复选框状态
        itemsContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('keep-checkbox')) {
                const groupCheckbox = container.querySelector('.group-checkbox');
                const checkboxes = container.querySelectorAll('.keep-checkbox');
                const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
                
                groupCheckbox.checked = checkedCount === checkboxes.length;
                groupCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
            }
        });

        return container;
    }

    renderBookmarkItem(bookmark) {
        const itemElement = this.bookmarkTemplate.content.cloneNode(true);
        const container = itemElement.querySelector('.bookmark-item');
        
        container.querySelector('.item-title').textContent = bookmark.title;
        container.querySelector('.location-path').textContent = bookmark.path.join(' > ');
        container.querySelector('.add-time').textContent = new Date(bookmark.dateAdded).toLocaleString();
        
        // 本地化"所在位置"和"添加时间"文本
        const locationLabel = container.querySelector('[data-i18n="duplicateLocation"]');
        const addTimeLabel = container.querySelector('[data-i18n="duplicateAddTime"]');
        
        if (locationLabel) {
            locationLabel.textContent = chrome.i18n.getMessage('duplicateLocation');
        }
        if (addTimeLabel) {
            addTimeLabel.textContent = chrome.i18n.getMessage('duplicateAddTime');
        }
        
        const checkbox = container.querySelector('.keep-checkbox');
        checkbox.dataset.bookmarkId = bookmark.id;

        return container;
    }

    async keepNewestBookmarks() {
        // First, automatically check the non-newest bookmarks
        for (const group of this.duplicateUrls) {
            const sorted = [...group].sort((a, b) => b.dateAdded - a.dateAdded);
            const [newest, ...others] = sorted;
            
            // 获取所有要选中的书签ID
            const bookmarkIdsToCheck = others.map(b => b.id);
            
            // 查找所有该组的复选框并设置状态
            const checkboxes = document.querySelectorAll('.keep-checkbox');
            checkboxes.forEach(checkbox => {
                const bookmarkId = checkbox.dataset.bookmarkId;
                if (bookmarkIdsToCheck.includes(bookmarkId)) {
                    checkbox.checked = true;
                } else if (bookmarkId === newest.id) {
                    checkbox.checked = false;
                }
                checkbox.disabled = false;
            });
        }

        // 显示取消选择和删除按钮，隐藏保留最早按钮
        this.cancelSelectionButton.style.display = 'inline-flex';
        this.deleteSelectedButton.style.display = 'inline-flex';
        this.keepOldestButton.style.display = 'none';

        // 更新删除按钮显示状态
        this.updateDeleteButtonVisibility();
    }

    async deleteSelectedBookmarks() {
        // 获取选中的书签数量
        const checkedCount = document.querySelectorAll('.keep-checkbox:checked').length;
        
        // 显示确认对话框
        if (!confirm(chrome.i18n.getMessage('confirmDeleteDuplicates', [checkedCount]))) {
            return;
        }

        // 获取所有选中的书签ID
        const checkedBookmarkIds = Array.from(document.querySelectorAll('.keep-checkbox:checked'))
            .map(checkbox => checkbox.dataset.bookmarkId);

        // 删除选中的书签
        await this.removeBookmarks(checkedBookmarkIds);

        // 隐藏删除所选按钮
        this.deleteSelectedButton.style.display = 'none';

        // 重新扫描并更新显示
        await this.scanDuplicates();
    }

    async keepOldestBookmarks() {
        // First, automatically check the non-oldest bookmarks
        for (const group of this.duplicateUrls) {
            const sorted = [...group].sort((a, b) => a.dateAdded - b.dateAdded);
            const [oldest, ...others] = sorted;
            
            // 获取所有要选中的书签ID
            const bookmarkIdsToCheck = others.map(b => b.id);
            
            // 查找所有该组的复选框并设置状态
            const checkboxes = document.querySelectorAll('.keep-checkbox');
            checkboxes.forEach(checkbox => {
                const bookmarkId = checkbox.dataset.bookmarkId;
                if (bookmarkIdsToCheck.includes(bookmarkId)) {
                    checkbox.checked = true;
                } else if (bookmarkId === oldest.id) {
                    checkbox.checked = false;
                }
                checkbox.disabled = false;
            });
        }

        // 显示取消选择和删除按钮，隐藏保留最新按钮
        this.cancelSelectionButton.style.display = 'inline-flex';
        this.deleteSelectedButton.style.display = 'inline-flex';
        this.keepNewestButton.style.display = 'none';

        // 更新删除按钮显示状态
        this.updateDeleteButtonVisibility();
    }

    async removeBookmarks(bookmarkIds) {
        return Promise.all(bookmarkIds.map(id => {
            return new Promise((resolve) => {
                chrome.bookmarks.remove(id, resolve);
            });
        }));
    }

    // 添加取消选择方法
    cancelSelection() {
        // 取消所有复选框的选中状态
        document.querySelectorAll('.keep-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // 更新组复选框状态
        document.querySelectorAll('.group-checkbox').forEach(checkbox => {
            checkbox.checked = false;
            checkbox.indeterminate = false;
        });

        // 重置按钮显示状态
        this.cancelSelectionButton.style.display = 'none';
        this.deleteSelectedButton.style.display = 'none';
        this.keepNewestButton.style.display = 'inline-flex';
        this.keepOldestButton.style.display = 'inline-flex';

        // 更新删除按钮显示状态
        this.updateDeleteButtonVisibility();
    }

    initScrollListener() {
        const optionsBar = document.querySelector('.duplicate-options');
        const observer = new IntersectionObserver(
            ([e]) => {
                if (e.boundingClientRect.top <= 0) { // 根据顶部导航栏高度调整
                    optionsBar.classList.add('scrolled');
                } else {
                    optionsBar.classList.remove('scrolled');
                }
            },
            { threshold: [1] }
        );

        // 创建一个观察点
        const sentinel = document.createElement('div');
        optionsBar.parentNode.insertBefore(sentinel, optionsBar);
        observer.observe(sentinel);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new DuplicateBookmarkManager();
    
}); 