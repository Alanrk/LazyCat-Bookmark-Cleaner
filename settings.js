// 配置常量
const TIMEOUT_CONFIG = {
    MIN: 5,      // 最小超时时间（秒）
    MAX: 30,     // 最大超时时间（秒）
    DEFAULT: 15  // 默认超时时间（秒）
};

const URL_MATCH_MODE = {
    FULL: 'full',      // 完整URL匹配
    DOMAIN: 'domain'   // 仅域名匹配
};

// 提取域名的函数
function extractDomain(url) {
    try {
        // 直接提取http://或https://后面到第一个斜杠之前的部分
        const match = url.match(/^https?:\/\/([^/]+)/);
        if (match) {
            return match[0] + '/';
        }
        return null;
    } catch (error) {
        console.error('Error extracting domain:', error);
        return null;
    }
}

// 初始化设置
async function initSettings() {
    // 初始化超时设置对话框
    initTimeoutDialog();
    // 从存储中加载设置
    await loadSettings();
    // 初始化白名单输入框
    initWhitelistInput();
}

// 初始化白名单输入框
function initWhitelistInput() {
    const whitelistInput = document.getElementById('whitelist-urls');
    if (!whitelistInput) return;

    // 从存储中加载白名单并显示
    chrome.storage.local.get(['whitelist'], (result) => {
        if (result.whitelist) {
            whitelistInput.value = result.whitelist.join(', ');
        }
    });
}

// 初始化超时设置对话框
function initTimeoutDialog() {
    const timeoutDialog = document.getElementById('setting-dialog');
    const timeoutValue = document.getElementById('timeout-value');
    const timeoutDisplay = document.getElementById('timeout-display');
    const confirmButton = document.getElementById('confirm-timeout');
    const cancelButton = document.getElementById('cancel-timeout');

    if (!timeoutDialog || !timeoutValue || !timeoutDisplay) {
        console.error('Timeout dialog elements not found');
        return;
    }

    // 更新显示值
    timeoutValue.addEventListener('input', () => {
        timeoutDisplay.textContent = timeoutValue.value;
    });

    // 确认按钮处理
    confirmButton.addEventListener('click', async () => {
        const timeout = parseInt(timeoutValue.value);
        const selectedUrlMatchMode = document.querySelector('input[name="urlMatchMode"]:checked').value;
        await saveSettings({ timeout, urlMatchMode: selectedUrlMatchMode });
        timeoutDialog.style.display = 'none';
        // 重置扫描按钮状态
        const scanButton = document.getElementById('scan-button');
        const buttonText = scanButton.querySelector('.button-text');
        if (scanButton && buttonText) {
            scanButton.classList.remove('disabled');
            buttonText.textContent = chrome.i18n.getMessage('scanBookmarks');
        }
    });

    // 取消按钮处理
    cancelButton.addEventListener('click', () => {
        timeoutDialog.style.display = 'none';
        // 重置为保存的值
        loadSettings();
    });
}

// 保存设置到 storage
async function saveSettings(settings) {
    try {
        const currentSettings = await chrome.storage.local.get(['timeout', 'urlMatchMode', 'whitelist']);
        const whitelistInput = document.getElementById('whitelist-urls');
        let whitelist = currentSettings.whitelist || [];

        // 如果有新的白名单输入，处理并保存
        if (whitelistInput && whitelistInput.value.trim()) {
            const urls = whitelistInput.value.split(',');
            whitelist = [...new Set(urls)]; // 去重
        }

        await chrome.storage.local.set({
            timeout: settings.timeout !== undefined ? settings.timeout * 1000 : currentSettings.timeout, // 转换为毫秒存储
            urlMatchMode: settings.urlMatchMode !== undefined ? settings.urlMatchMode : (currentSettings.urlMatchMode || URL_MATCH_MODE.FULL),
            whitelist: whitelist,
            hasScanned: true // 标记已完成设置
        });
        console.log('Settings saved:', settings);
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// 从 storage 加载设置
async function loadSettings() {
    try {
        const timeoutValue = document.getElementById('timeout-value');
        const timeoutDisplay = document.getElementById('timeout-display');
        const urlMatchModeRadios = document.querySelectorAll('input[name="urlMatchMode"]');

        const result = await chrome.storage.local.get(['timeout', 'urlMatchMode', 'hasScanned']);
        const timeoutSeconds = result.timeout
            ? Math.floor(result.timeout / 1000)
            : TIMEOUT_CONFIG.DEFAULT;
        const urlMatchMode = result.urlMatchMode || URL_MATCH_MODE.FULL;
        const hasScanned = result.hasScanned || false;

        if (timeoutValue && timeoutDisplay) {
            timeoutValue.value = timeoutSeconds;
            timeoutDisplay.textContent = timeoutSeconds;
        }

        // 设置URL匹配模式的单选按钮状态
        urlMatchModeRadios.forEach(radio => {
            if (radio.value === urlMatchMode) {
                radio.checked = true;
            }
        });

        return {
            timeout: timeoutSeconds * 1000, // 返回毫秒值
            urlMatchMode: urlMatchMode
        };
    } catch (error) {
        console.error('Error loading settings:', error);
        return {
            timeout: TIMEOUT_CONFIG.DEFAULT * 1000
        };
    }
}

// 显示超时设置对话框
function showTimeoutDialog() {
    const dialog = document.getElementById('setting-dialog');
    if (dialog) {
        dialog.style.display = 'flex';
    }
}

// 获取当前超时设置（毫秒）
async function getCurrentTimeout() {
    try {
        const result = await chrome.storage.local.get(['timeout']);
        return result.timeout || TIMEOUT_CONFIG.DEFAULT * 1000;
    } catch (error) {
        console.error('Error getting timeout setting:', error);
        return TIMEOUT_CONFIG.DEFAULT * 1000;
    }
}

// 添加一个检查是否首次扫描的函数
async function isFirstScan() {
    try {
        const result = await chrome.storage.local.get(['hasScanned']);
        return !result.hasScanned;
    } catch (error) {
        console.error('Error checking first scan:', error);
        return false;
    }
}

// 标记已经扫描过
async function markScanned() {
    try {
        await chrome.storage.local.set({ hasScanned: true });
    } catch (error) {
        console.error('Error marking scanned:', error);
    }
}

// 检查URL是否在白名单中
async function isUrlWhitelisted(url) {
    try {
        const result = await chrome.storage.local.get(['whitelist', 'urlMatchMode']);
        const whitelist = result.whitelist || [];

        if (!whitelist.length) return false;

        // 调试日志
        console.log('Checking URL against whitelist:', url);
        console.log('Whitelist patterns:', whitelist);

        for (const pattern of whitelist) {
            // 通配符
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            if (regex.test(url)) {
                console.log('Whitelist match found for URL:', url);
                return true;
            }
        }

        // 如果所有模式都检查完毕但没有匹配
        console.log('No whitelist match found for URL:', url);
        return false;
    } catch (error) {
        console.error('Error checking whitelist:', error);
        return false;
    }
}

// 导出需要的函数和常量
export {
    TIMEOUT_CONFIG,
    URL_MATCH_MODE,
    initSettings,
    showTimeoutDialog,
    getCurrentTimeout,
    isFirstScan,
    markScanned,
    saveSettings,
    isUrlWhitelisted,
    extractDomain
};