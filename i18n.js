/**
 * 国际化工具函数
 * 用于在JavaScript中获取本地化文本
 */

// 获取本地化文本
function i18n(key, substitutions = []) {
    try {
        return chrome.i18n.getMessage(key, substitutions) || key;
    } catch (error) {
        console.warn('i18n error:', error);
        return key;
    }
}

// 批量获取本地化文本
function i18nBatch(keys) {
    const result = {};
    keys.forEach(key => {
        result[key] = i18n(key);
    });
    return result;
}

// 替换HTML元素中的文本
function localizeHTML() {
    // 查找所有带有 data-i18n 属性的元素
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        const text = i18n(key);
        
        // 根据元素类型设置文本
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.type === 'button' || element.type === 'submit') {
                element.value = text;
            } else {
                element.placeholder = text;
            }
        } else {
            element.textContent = text;
        }
    });
    
    // 查找所有带有 data-i18n-title 属性的元素
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = i18n(key);
    });
    
    // 查找所有带有 data-i18n-placeholder 属性的元素
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = i18n(key);
    });
}

// 获取当前语言
function getCurrentLanguage() {
    return chrome.i18n.getUILanguage();
}

// 检查是否为中文环境
function isChinese() {
    const lang = getCurrentLanguage();
    return lang.startsWith('zh');
}

// 检查是否为英文环境
function isEnglish() {
    const lang = getCurrentLanguage();
    return lang.startsWith('en');
}

// 检查是否为日文环境
function isJapanese() {
    const lang = getCurrentLanguage();
    return lang.startsWith('ja');
}

// 检查是否为韩文环境
function isKorean() {
    const lang = getCurrentLanguage();
    return lang.startsWith('ko');
}

// 格式化数字（根据语言环境）
function formatNumber(number) {
    const lang = getCurrentLanguage();
    try {
        return new Intl.NumberFormat(lang).format(number);
    } catch (error) {
        return number.toString();
    }
}

// 格式化日期（根据语言环境）
function formatDate(date) {
    const lang = getCurrentLanguage();
    try {
        return new Intl.DateTimeFormat(lang).format(date);
    } catch (error) {
        return date.toLocaleDateString();
    }
}

// 在DOM加载完成后自动本地化
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', localizeHTML);
    } else {
        localizeHTML();
    }
}

// 导出函数（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        i18n,
        i18nBatch,
        localizeHTML,
        getCurrentLanguage,
        isChinese,
        isEnglish,
        isJapanese,
        isKorean,
        formatNumber,
        formatDate
    };
} 