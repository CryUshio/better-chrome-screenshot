/**
 * Better Chrome Screenshot - 内容脚本
 * 功能：在网页中提供必要的支持功能，处理所有前台交互操作
 * 作者：用户需求 - 重构此项目调用 chrome.scripting.executeScript 的部分，所有前台交互操作都要写在 content_script 中
 * 新增：区域截图功能支持
 * 设计原则：单一职责原则，专注于前台页面操作
 */

import type { 
  ContentScriptMessage, 
  ContentScriptResponse, 
  PageDimensions, 
  ScrollAnalysisResult, 
  ScrollContainer, 
  ScrollContainerInfo,
  RegionCaptureState 
} from '../types';
import { regionCaptureManager } from './region-capture';
import '../styles/content_scripts.css';

// DOM 查询相关工具
const DOM_UTILS = {
  BLOCK_ELEMENTS: [
    'html', 'body', 'div', 'p', 'textarea', 'form', 'table', 
    'tbody', 'thead', 'tfoot', 'ul', 'ol', 'li', 'section', 
    'main', 'header', 'article'
  ],
  
  OVERFLOW_TYPES: ['scroll', 'auto', 'overlay'] as const,
} as const;

/**
 * 检查是否为块级元素
 */
function isBlockElement(tagName: string): boolean {
  return DOM_UTILS.BLOCK_ELEMENTS.includes(tagName.toLowerCase() as any);
}

/**
 * 检查元素是否可见
 */
function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/**
 * 获取页面完整尺寸信息
 */
function getPageDimensions(): PageDimensions {
  const devicePixelRatio = window.devicePixelRatio || 1;
  
  return {
    totalWidth: Math.max(
      document.body.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
      document.documentElement.offsetWidth
    ),
    totalHeight: Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    ),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    devicePixelRatio: devicePixelRatio
  };
}

/**
 * 分析页面中的滚动容器
 */
function analyzeScrollContainers(): ScrollAnalysisResult {
  const scrollContainers: ScrollContainer[] = [];

  /**
   * 递归查找滚动容器
   */
  function findScrollContainers(element: Element): void {
    const computedStyle = window.getComputedStyle(element);
    const overflowY = computedStyle.overflowY;
    
    // 检查是否为垂直滚动容器
    const isVerticalScrollable = 
      DOM_UTILS.OVERFLOW_TYPES.includes(overflowY as any) &&
      element.scrollHeight > element.clientHeight;

    if (isVerticalScrollable) {
      scrollContainers.push({
        element,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollable: true
      });
    }

    // 递归遍历子元素（只遍历块级元素）
    const children = Array.from(element.children)
      .filter(child => isBlockElement(child.tagName))
      .filter(child => isElementVisible(child));
    
    children.forEach(child => findScrollContainers(child));
  }

  // 从 document.documentElement 开始查找
  findScrollContainers(document.documentElement);

  // 添加 body 作为备选
  if (document.body && document.body.scrollHeight > document.body.clientHeight) {
    scrollContainers.push({
      element: document.body,
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.body.clientHeight,
      scrollable: true
    });
  }

  // 添加 documentElement 作为备选
  if (document.documentElement.scrollHeight > document.documentElement.clientHeight) {
    scrollContainers.push({
      element: document.documentElement,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollable: true
    });
  }

  // 找到最佳滚动容器（增量高度最大的）
  let maxIncrementalHeight = 0;
  let bestContainer: ScrollContainer | undefined;

  scrollContainers.forEach((container) => {
    const incrementalHeight = container.scrollHeight - container.clientHeight;
    if (incrementalHeight > maxIncrementalHeight) {
      maxIncrementalHeight = incrementalHeight;
      bestContainer = container;
    }
  });

  return {
    scrollContainers,
    maxIncrementalHeight,
    bestContainer: bestContainer ? {
      tagName: bestContainer.element.tagName,
      className: bestContainer.element.className,
      scrollHeight: bestContainer.scrollHeight,
      clientHeight: bestContainer.clientHeight
    } : null
  };
}

/**
 * 滚动到页面顶部
 */
function scrollToTop(scrollInfo?: ScrollAnalysisResult): void {
  // 滚动主窗口到顶部
  window.scrollTo(0, 0);
  
  // 如果有滚动容器，也将其滚动到顶部
  if (scrollInfo && scrollInfo.bestContainer) {
    const containers = document.querySelectorAll(scrollInfo.bestContainer.tagName);
    for (const container of containers) {
      if (container.className === scrollInfo.bestContainer.className) {
        (container as any).scrollTop = 0;
        break;
      }
    }
  }
}

/**
 * 滚动到指定位置
 */
function scrollTo(targetY: number, scrollInfo?: ScrollAnalysisResult): void {
  // 滚动主窗口
  window.scrollTo(0, targetY);
  
  // 如果有滚动容器，也尝试滚动滚动容器
  if (scrollInfo && scrollInfo.bestContainer) {
    const containers = document.querySelectorAll(scrollInfo.bestContainer.tagName);
    for (const container of containers) {
      if (container.className === scrollInfo.bestContainer.className) {
        // 计算滚动容器应该滚动的距离
        const containerScrollRatio = targetY / (scrollInfo.bestContainer.scrollHeight - scrollInfo.bestContainer.clientHeight);
        const containerScrollTop = Math.min(
          containerScrollRatio * ((container as any).scrollHeight - (container as any).clientHeight),
          (container as any).scrollHeight - (container as any).clientHeight
        );
        (container as any).scrollTop = containerScrollTop;
        break;
      }
    }
  }
}

/**
 * 获取综合页面分析结果
 */
function getPageAnalysis(): { dimensions: PageDimensions; scrollInfo: ScrollAnalysisResult } {
  const dimensions = getPageDimensions();
  const scrollInfo = analyzeScrollContainers();
  return { dimensions, scrollInfo };
}

/**
 * 消息处理器
 */
function handleMessage(
  request: ContentScriptMessage, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response: ContentScriptResponse) => void
): boolean {
  try {
    console.log('Content script received message:', request);
    
    switch (request.action) {
      case 'getPageDimensions':
        const dimensions = getPageDimensions();
        sendResponse({ success: true, data: dimensions });
        break;
        
      case 'analyzeScrollContainers':
        const scrollInfo = analyzeScrollContainers();
        sendResponse({ success: true, data: scrollInfo });
        break;
        
      case 'scrollToTop':
        scrollToTop(request.data?.scrollInfo);
        sendResponse({ success: true });
        break;
        
      case 'scrollTo':
        if (request.data?.targetY !== undefined) {
          scrollTo(request.data.targetY, request.data.scrollInfo);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Missing targetY parameter' });
        }
        break;
        
      case 'getPageAnalysis':
        const pageAnalysis = getPageAnalysis();
        sendResponse({ success: true, data: pageAnalysis });
        break;
        
      case 'pageReady':
        // 兼容性处理：响应页面准备状态检查
        sendResponse({ success: true, data: { status: 'ready' } });
        break;

      // 新增：区域截图相关消息处理
      case 'startRegionCapture':
        handleStartRegionCapture(sendResponse);
        return true; // 异步处理
        
      case 'finishRegionCapture':
        handleFinishRegionCapture(sendResponse);
        break;
        
      case 'cancelRegionCapture':
        handleCancelRegionCapture(sendResponse);
        break;
        
      case 'updateRegionCapture':
        handleUpdateRegionCapture(sendResponse);
        break;
        
      default:
        sendResponse({ success: false, error: `Unknown action: ${(request as any).action}` });
    }
  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
  
  return true; // 保持消息通道开放以支持异步响应
}

/**
 * 处理开始区域截图请求
 */
async function handleStartRegionCapture(
  sendResponse: (response: ContentScriptResponse) => void
): Promise<void> {
  try {
    const result = await regionCaptureManager.startCapture();
    
    if (result.success) {
      const state = regionCaptureManager.getState();
      sendResponse({ 
        success: true, 
        data: state 
      });
    } else {
      sendResponse({ 
        success: false, 
        error: result.error || '开始区域截图失败' 
      });
    }
  } catch (error) {
    console.error('开始区域截图时出错:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    });
  }
}

/**
 * 处理完成区域截图请求
 */
function handleFinishRegionCapture(
  sendResponse: (response: ContentScriptResponse) => void
): void {
  try {
    const state = regionCaptureManager.getState();
    
    if (state.isActive) {
      // 如果正在截图状态，则完成截图
      // 这里可以根据需要添加完成逻辑
      sendResponse({ 
        success: true, 
        data: state 
      });
    } else {
      sendResponse({ 
        success: false, 
        error: '没有活动的区域截图会话' 
      });
    }
  } catch (error) {
    console.error('完成区域截图时出错:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    });
  }
}

/**
 * 处理取消区域截图请求
 */
function handleCancelRegionCapture(
  sendResponse: (response: ContentScriptResponse) => void
): void {
  try {
    regionCaptureManager.cancelCapture();
    sendResponse({ success: true });
  } catch (error) {
    console.error('取消区域截图时出错:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    });
  }
}

/**
 * 处理更新区域截图状态请求
 */
function handleUpdateRegionCapture(
  sendResponse: (response: ContentScriptResponse) => void
): void {
  try {
    const state = regionCaptureManager.getState();
    sendResponse({ 
      success: true, 
      data: state 
    });
  } catch (error) {
    console.error('获取区域截图状态时出错:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    });
  }
}

// 监听来自背景脚本的消息
chrome.runtime.onMessage.addListener(handleMessage);

// 兼容处理 - 在主消息处理器中处理pageReady
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === 'pageReady') {
//     sendResponse({ status: 'ready' });
//   }
//   return true;
// });

console.log('Better Chrome Screenshot content script loaded');

// 通知background script content script已准备就绪
try {
  chrome.runtime.sendMessage({ action: 'contentScriptReady' }, (response) => {
    if (chrome.runtime.lastError) {
      // 忽略错误，background script可能还未准备好
      console.debug('Content script ready notification failed:', chrome.runtime.lastError.message);
    } else {
      console.log('Content script ready notification sent successfully');
    }
  });
} catch (error) {
  console.debug('Content script ready notification error:', error);
}
