/**
 * Better Chrome Screenshot - 滚动截图模块
 * 功能：传统的滚动截图功能，逐步滚动页面并截图合并
 * 作者：用户需求 - 重构此项目调用 chrome.scripting.executeScript 的部分，所有前台交互操作都要写在 content_script 中
 * 设计原则：单一职责原则，专注于滚动截图功能，通过消息传递与content_script通信
 * 
 * 宽度问题修复说明：
 * 问题原因：chrome.tabs.captureVisibleTab 截取的图片实际尺寸是 viewportWidth * devicePixelRatio，
 * 但在图像合并时只使用了逻辑像素宽度（viewportWidth），导致图片被裁切。
 * 
 * 解决方案：
 * 1. 在页面分析时获取 devicePixelRatio（设备像素比）
 * 2. 在图像合并时使用实际物理像素尺寸（逻辑尺寸 * devicePixelRatio）
 * 3. 使用截图的原始尺寸进行绘制，而非强制使用逻辑尺寸
 * 
 * 典型场景：
 * - 2x Retina 显示器：devicePixelRatio = 2，截图宽度 = viewportWidth * 2
 * - 1.5x 高DPI显示器：devicePixelRatio = 1.5，截图宽度 = viewportWidth * 1.5
 */

import type { 
  ChromeTab, 
  PageDimensions, 
  ScrollAnalysisResult,
  ContentScriptMessage,
  ContentScriptResponse
} from '../../types';
import { PageAnalyzer } from '../page-analyzer';
import { ImageProcessor } from '../image-processor';
import { CONSTANTS, delay, getCurrentTab, Logger, sendMessageToContentScript } from '../../utils';

/**
 * 滚动控制器 - 处理页面滚动逻辑
 */
export class ScrollController {
  private tabId: number;

  constructor(tabId: number) {
    this.tabId = tabId;
  }

  /**
   * 滚动到页面顶部
   */
  async scrollToTop(scrollInfo?: ScrollAnalysisResult): Promise<void> {
    await sendMessageToContentScript(this.tabId, {
      action: 'scrollToTop',
      data: { scrollInfo }
    });

    // 等待滚动完成
    await delay(CONSTANTS.INITIAL_DELAY);
  }

  /**
   * 滚动到指定位置
   */
  async scrollTo(targetY: number, scrollInfo?: ScrollAnalysisResult): Promise<void> {
    await sendMessageToContentScript(this.tabId, {
      action: 'scrollTo',
      data: { targetY, scrollInfo }
    });

    // 等待滚动和页面稳定
    await delay(CONSTANTS.CAPTURE_DELAY);
  }
}

/**
 * 截图采集器 - 处理截图采集逻辑
 */
export class ScreenshotCollector {
  private tabId: number;

  constructor(tabId: number) {
    this.tabId = tabId;
  }

  /**
   * 单次截图
   */
  async captureScreenshot(): Promise<string> {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
    
    // 添加调试：检查截图的实际尺寸
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);
      
      Logger.info(`截图实际尺寸: ${imageBitmap.width}x${imageBitmap.height}`);
      
      // 释放 ImageBitmap 资源
      imageBitmap.close();
    } catch (error) {
      Logger.warn('无法获取截图尺寸信息:', error);
    }
    
    return dataUrl;
  }

  /**
   * 检查是否为单屏截图
   */
  canUseSingleScreenshot(actualHeight: number, viewportHeight: number): boolean {
    return actualHeight <= viewportHeight;
  }

  /**
   * 执行单屏截图
   */
  async captureSingleScreenshot(tab: ChromeTab): Promise<void> {
    if (!tab.windowId) {
      throw new Error('无法获取窗口ID');
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    await ImageProcessor.processAndDownload(dataUrl, tab.title || 'screenshot');
  }
}

/**
 * 滚动截图类
 */
export class ScrollCapture {
  private tab: ChromeTab;
  private pageAnalyzer: PageAnalyzer | null;
  private scrollController: ScrollController | null;
  private screenshotCollector: ScreenshotCollector | null;

  constructor(tab?: ChromeTab) {
    this.tab = tab || { id: 0 }; // 临时值，会在初始化时更新
    this.pageAnalyzer = null;
    this.scrollController = null;
    this.screenshotCollector = null;
  }

  /**
   * 初始化
   */
  private async initialize(): Promise<void> {
    try {
      Logger.info('开始初始化 ScrollCapture...');
      
      this.tab = await getCurrentTab();
      
      Logger.info(`成功获取标签页，ID: ${this.tab.id}, 标题: ${this.tab.title}`);
      
      // 验证标签页是否仍然有效
      if (!this.tab.id) {
        throw new Error('获取到的标签页ID无效');
      }
      
      // 检查标签页状态
      const tabInfo = await chrome.tabs.get(this.tab.id);
      if (!tabInfo) {
        throw new Error('标签页不存在或已关闭');
      }
      
      Logger.debug('标签页状态检查通过:', tabInfo);
      
      this.pageAnalyzer = new PageAnalyzer(this.tab);
      this.scrollController = new ScrollController(this.tab.id);
      this.screenshotCollector = new ScreenshotCollector(this.tab.id);
      
      Logger.info('ScrollCapture 初始化完成');
    } catch (error) {
      Logger.error('ScrollCapture 初始化失败:', error);
      
      // 提供更有用的错误信息
      if (error instanceof Error) {
        if (error.message.includes('无效的标签页ID')) {
          throw new Error('无法获取有效的标签页，请确保：\n1. 当前窗口有打开的网页\n2. 网页已完全加载\n3. 浏览器扩展有足够权限');
        } else if (error.message.includes('标签页不存在')) {
          throw new Error('标签页可能已关闭或切换，请重新尝试');
        }
        throw error;
      } else {
        throw new Error('初始化失败: 未知错误');
      }
    }
  }

  /**
   * 计算滚动参数
   */
  private calculateScrollParams(viewportHeight: number): {
    scrollStep: number;
    captureDelay: number;
  } {
    return {
      scrollStep: viewportHeight - CONSTANTS.SCROLL_OVERLAP,
      captureDelay: CONSTANTS.CAPTURE_DELAY
    };
  }

  /**
   * 执行滚动截图序列
   */
  private async captureScrollingSequence(
    totalHeight: number,
    viewportHeight: number,
    scrollInfo?: ScrollAnalysisResult
  ): Promise<string[]> {
    const screenshots: string[] = [];
    const { scrollStep } = this.calculateScrollParams(viewportHeight);
    
    if (scrollInfo?.bestContainer) {
      Logger.info(`使用滚动容器进行截图: ${scrollInfo.bestContainer.tagName}`, scrollInfo.bestContainer);
    }
    
    // 滚动到顶部
    await this.scrollController!.scrollToTop(scrollInfo);

    let currentY = 0;
    let screenshotIndex = 0;
    
    while (currentY < totalHeight) {
      Logger.info(`正在截取第 ${screenshotIndex + 1} 张图片，位置: ${currentY}px`);
      
      // 截取当前视口
      const dataUrl = await this.screenshotCollector!.captureScreenshot();
      screenshots.push(dataUrl);
      
      Logger.info(`成功截取第 ${screenshotIndex + 1} 张图片`);
      screenshotIndex++;
      
      // 计算下一个滚动位置
      currentY += scrollStep;
      
      if (currentY < totalHeight) {
        // 滚动到下一个位置
        const nextScrollY = Math.min(currentY, totalHeight - viewportHeight);
        await this.scrollController!.scrollTo(nextScrollY, scrollInfo);
      }
    }

    Logger.info(`共截取了 ${screenshots.length} 张图片`);
    return screenshots;
  }

  /**
   * 执行全页面滚动截图
   */
  async captureFullPage(): Promise<void> {
    try {
      await this.initialize();

      // 获取页面分析结果
      const { dimensions, scrollInfo } = await this.pageAnalyzer!.getPageAnalysis();
      const actualHeight = this.pageAnalyzer!.calculateCaptureHeight(dimensions, scrollInfo);

      // 添加调试信息
      Logger.info('页面维度分析:', {
        totalWidth: dimensions.totalWidth,
        totalHeight: dimensions.totalHeight,
        viewportWidth: dimensions.viewportWidth,
        viewportHeight: dimensions.viewportHeight,
        calculatedHeight: actualHeight
      });

      // 检查是否可以使用单屏截图
      if (this.screenshotCollector!.canUseSingleScreenshot(actualHeight, dimensions.viewportHeight)) {
        await this.screenshotCollector!.captureSingleScreenshot(this.tab);
        return;
      }

      // 执行滚动截图序列
      const screenshots = await this.captureScrollingSequence(
        actualHeight,
        dimensions.viewportHeight,
        scrollInfo
      );

      // 合并并下载图片
      await ImageProcessor.mergeAndDownload(
        screenshots,
        dimensions.viewportWidth,
        actualHeight,
        dimensions.viewportHeight,
        this.calculateScrollParams(dimensions.viewportHeight).scrollStep,
        this.tab.title || 'full-page-screenshot',
        dimensions.devicePixelRatio
      );

      Logger.info('滚动截图完成');

    } catch (error) {
      Logger.error('滚动截图失败:', error);
      throw error;
    }
  }

  /**
   * 获取预计截图数量
   */
  async getEstimatedScreenshotCount(): Promise<number> {
    try {
      // 确保已初始化
      await this.initialize();
      
      const { dimensions, scrollInfo } = await this.pageAnalyzer!.getPageAnalysis();
      const actualHeight = this.pageAnalyzer!.calculateCaptureHeight(dimensions, scrollInfo);
      
      if (actualHeight <= dimensions.viewportHeight) {
        return 1;
      }

      const { scrollStep } = this.calculateScrollParams(dimensions.viewportHeight);
      return Math.ceil(actualHeight / scrollStep);
    } catch (error) {
      Logger.warn('无法估算截图数量:', error);
      return 0;
    }
  }
}

/**
 * 滚动截图的便捷函数
 */
export async function captureFullPageScreenshot(tab?: ChromeTab): Promise<void> {
  const scrollCapture = new ScrollCapture(tab);
  await scrollCapture.captureFullPage();
}

/**
 * 获取截图预估信息
 */
export async function getScreenshotEstimate(tab?: ChromeTab): Promise<{
  screenshotCount: number;
  dimensions?: PageDimensions;
  scrollInfo?: ScrollAnalysisResult;
}> {
  try {
    const scrollCapture = new ScrollCapture(tab);
    const count = await scrollCapture.getEstimatedScreenshotCount();
    return { screenshotCount: count };
  } catch (error) {
    Logger.warn('获取截图预估失败:', error);
    return { screenshotCount: 0 };
  }
} 
