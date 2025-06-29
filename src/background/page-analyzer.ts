/**
 * Better Chrome Screenshot - 页面分析模块  
 * 功能：页面尺寸获取和滚动容器分析
 * 作者：用户需求 - 重构此项目调用 chrome.scripting.executeScript 的部分，所有前台交互操作都要写在 content_script 中
 * 设计原则：单一职责原则，专注于页面分析相关功能，通过消息传递与content_script通信
 * @warning 此文件已移除直接DOM操作函数，改为通过消息传递与content_script通信
 */

import type { 
  ScrollAnalysisResult, 
  PageDimensions, 
  ChromeTab,
  ContentScriptMessage,
  ContentScriptResponse
} from '../types';
import { Logger, sendMessageToContentScript } from '../utils';


/**
 * 页面分析器类
 * 提供对外的统一接口，通过消息传递与content_script通信
 */
export class PageAnalyzer {
  private tabId: number;

  constructor(tab: ChromeTab) {
    Logger.debug('PageAnalyzer 构造函数接收到的标签页:', tab);
    
    if (!tab) {
      throw new Error('标签页对象为空或未定义');
    }
    
    if (!tab.id) {
      throw new Error(`无效的标签页ID，标签页信息: ${JSON.stringify({
        id: tab.id,
        title: tab.title,
        windowId: tab.windowId
      })}`);
    }
    
    this.tabId = tab.id;
    Logger.info(`PageAnalyzer 初始化成功，标签页ID: ${this.tabId}`);
  }

  /**
   * 获取页面尺寸信息
   */
  async getPageDimensions(): Promise<PageDimensions> {
    try {
      const dimensions = await sendMessageToContentScript<PageDimensions>(
        this.tabId,
        { action: 'getPageDimensions' }
      );

      Logger.info('页面尺寸信息:', dimensions);
      return dimensions;
    } catch (error) {
      Logger.error('获取页面尺寸失败:', error);
      throw error;
    }
  }

  /**
   * 分析滚动容器
   */
  async analyzeScrollContainers(): Promise<ScrollAnalysisResult> {
    try {
      const scrollInfo = await sendMessageToContentScript<ScrollAnalysisResult>(
        this.tabId,
        { action: 'analyzeScrollContainers' }
      );

      Logger.info('滚动容器分析结果:', scrollInfo);
      return scrollInfo;
    } catch (error) {
      Logger.error('滚动容器分析失败:', error);
      throw error;
    }
  }

  /**
   * 获取综合页面分析结果
   */
  async getPageAnalysis(): Promise<{
    dimensions: PageDimensions;
    scrollInfo: ScrollAnalysisResult;
  }> {
    try {
      const result = await sendMessageToContentScript<{
        dimensions: PageDimensions;
        scrollInfo: ScrollAnalysisResult;
      }>(
        this.tabId,
        { action: 'getPageAnalysis' }
      );

      return result;
    } catch (error) {
      // 如果综合分析失败，尝试分别获取
      Logger.warn('综合页面分析失败，尝试分别获取:', error);
      
      const [dimensions, scrollInfo] = await Promise.all([
        this.getPageDimensions(),
        this.analyzeScrollContainers()
      ]);

      return { dimensions, scrollInfo };
    }
  }

  /**
   * 计算最终截图高度
   */
  calculateCaptureHeight(dimensions: PageDimensions, scrollInfo: ScrollAnalysisResult): number {
    let actualHeight = dimensions.totalHeight;
    
    if (scrollInfo.maxIncrementalHeight > 0) {
      actualHeight = Math.max(
        dimensions.totalHeight, 
        dimensions.viewportHeight + scrollInfo.maxIncrementalHeight
      );
      
      Logger.info(
        `检测到滚动容器，调整截图高度: ${actualHeight}px (增量: ${scrollInfo.maxIncrementalHeight}px)`
      );
      
      if (scrollInfo.bestContainer) {
        Logger.info('最佳滚动容器:', scrollInfo.bestContainer);
      }
    }

    return actualHeight;
  }
}

/**
 * 兼容性函数 - 为CDP模块提供独立的滚动容器分析函数
 * 这些函数通过消息传递调用content_script中的实现
 */
export async function analyzeScrollContainers(tabId: number): Promise<ScrollAnalysisResult> {
  return await sendMessageToContentScript<ScrollAnalysisResult>(
    tabId,
    { action: 'analyzeScrollContainers' }
  );
}

export async function getPageDimensions(tabId: number): Promise<PageDimensions> {
  return await sendMessageToContentScript<PageDimensions>(
    tabId,
    { action: 'getPageDimensions' }
  );
} 
