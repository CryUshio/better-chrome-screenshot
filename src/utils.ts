/**
 * Better Chrome Screenshot - 工具模块
 * 功能：提供通用的工具函数和常量定义
 * 作者：用户需求 - 重新组织background.ts，拆分为合理的细粒度文件以便维护
 * 设计原则：单一职责原则，提供纯函数式的工具方法
 */

import type { ChromeTab, ContentScriptMessage, ContentScriptResponse } from './types';

// 常量定义
export const CONSTANTS = {
  SCROLL_OVERLAP: 100, // 滚动重叠像素
  CAPTURE_DELAY: 800, // 截图间延迟毫秒
  STABILIZATION_DELAY: 300, // 页面稳定化延迟
  INITIAL_DELAY: 500, // 初始延迟
  CDP_VERSION: "1.3", // Chrome DevTools Protocol 版本
} as const;

/**
 * 获取当前活动标签页
 */
export async function getCurrentTab(): Promise<ChromeTab> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    Logger.debug('获取标签页结果:', tab);
    
    if (!tab) {
      throw new Error('当前窗口中没有活动标签页，请确保有打开的网页');
    }
    
    if (!tab.id) {
      throw new Error(`标签页ID无效，标签页信息: ${JSON.stringify({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        status: tab.status
      })}`);
    }
    
    Logger.info(`成功获取标签页 ID: ${tab.id}, 标题: ${tab.title}`);
    return tab;
  } catch (error) {
    Logger.error('获取当前标签页失败:', error);
    
    // 提供更详细的错误信息
    if (error instanceof Error) {
      throw new Error(`获取标签页失败: ${error.message}`);
    } else {
      throw new Error('获取标签页失败: 未知错误');
    }
  }
}

/**
 * 检查页面是否支持content script
 */
function isPageSupported(url: string | undefined): boolean {
  if (!url) return false;
  
  // 不支持的页面类型
  const unsupportedProtocols = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'edge://',
    'about:',
    'file://',
    'data:',
    'javascript:'
  ];
  
  return !unsupportedProtocols.some(protocol => url.startsWith(protocol));
}

/**
 * 检查content script是否准备就绪
 */
async function checkContentScriptReady(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'pageReady' }, (response) => {
      if (chrome.runtime.lastError) {
        Logger.debug('Content script not ready:', chrome.runtime.lastError.message);
        resolve(false);
      } else {
        resolve(response && response.success);
      }
    });
  });
}

/**
 * 发送消息到content_script的辅助函数
 */
export async function sendMessageToContentScript<T>(
  tabId: number, 
  message: ContentScriptMessage
): Promise<T> {
  // 首先获取标签页信息检查页面类型
  try {
    const tab = await chrome.tabs.get(tabId);
    
    if (!isPageSupported(tab.url)) {
      throw new Error(`不支持的页面类型: ${tab.url}。此扩展不能在系统页面上运行。`);
    }
    
    Logger.debug(`向标签页 ${tabId} (${tab.url}) 发送消息:`, message);
  } catch (error) {
    Logger.error('获取标签页信息失败:', error);
    throw new Error(`无法获取标签页信息: ${error instanceof Error ? error.message : '未知错误'}`);
  }
  
  // 检查content script是否准备就绪（仅对非pageReady消息进行检查）
  if (message.action !== 'pageReady') {
    const isReady = await checkContentScriptReady(tabId);
    if (!isReady) {
      throw new Error('Content script未准备就绪。请确保页面已完全加载，并且扩展在此页面上有权限运行。');
    }
  }
  
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response: ContentScriptResponse) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || '未知错误';
        Logger.error('消息发送失败:', errorMsg);
        
        // 提供更具体的错误信息
        if (errorMsg.includes('Could not establish connection')) {
          reject(new Error('无法连接到页面脚本。可能原因：\n1. 页面还未完全加载\n2. 扩展在此页面上没有权限\n3. 页面类型不支持（如系统页面）\n4. Content script加载失败'));
        } else if (errorMsg.includes('Receiving end does not exist')) {
          reject(new Error('页面脚本不存在。请刷新页面后重试。'));
        } else {
          reject(new Error(`通信错误: ${errorMsg}`));
        }
        return;
      }
      
      if (!response) {
        reject(new Error('页面脚本无响应'));
        return;
      }
      
      if (!response.success) {
        reject(new Error(response.error || '页面脚本操作失败'));
        return;
      }
      
      Logger.debug('收到content script响应:', response);
      resolve(response.data as T);
    });
  });
}

/**
 * 清理文件名，移除特殊字符
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.-]/g, '_');
}

/**
 * 生成带时间戳的文件名
 */
export function generateTimestampedFilename(basename: string, extension: string = 'png'): string {
  const cleanBasename = sanitizeFilename(basename);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${cleanBasename}_${timestamp}.${extension}`;
}

/**
 * 创建延迟 Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 日志工具
 */
export const Logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[Better Screenshot] ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[Better Screenshot] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[Better Screenshot] ${message}`, ...args);
  },
  
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Better Screenshot] ${message}`, ...args);
    }
  }
} as const; 
