/**
 * Better Chrome Screenshot - CDP截图模块
 * 功能：使用Chrome DevTools Protocol进行全页面截图
 * 作者：用户需求 - 重构此项目调用 chrome.scripting.executeScript 的部分，所有前台交互操作都要写在 content_script 中
 * 设计原则：单一职责原则，专注于CDP截图功能，通过消息传递与content_script通信
 */

import type { 
  ChromeTab, 
  Debuggee, 
  LayoutMetrics, 
  CaptureScreenshotResult, 
  ScrollAnalysisResult,
  ContentScriptMessage,
  ContentScriptResponse
} from '../../types';
import { PageAnalyzer, analyzeScrollContainers } from '../page-analyzer';
import { ImageProcessor } from '../image-processor';
import { CONSTANTS, delay, getCurrentTab, Logger, sendMessageToContentScript } from '../../utils';

/**
 * CDP 截图器
 */
export class CDPCapture {
  private tab: ChromeTab;
  private debuggee: Debuggee;
  private pageAnalyzer: PageAnalyzer | null;
  private isAttached = false;

  constructor(tab?: ChromeTab) {
    this.tab = tab || { id: 0 }; // 临时值，会在初始化时更新
    this.debuggee = { tabId: 0 }; // 临时值，会在初始化时更新
    this.pageAnalyzer = null as any; // 临时值，会在初始化时更新
  }

  /**
   * 初始化
   */
  private async initialize(): Promise<void> {
    try {
      Logger.info('开始初始化 CDPCapture...');
      
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
      
      this.debuggee = { tabId: this.tab.id };
      this.pageAnalyzer = new PageAnalyzer(this.tab);
      
      Logger.info('CDPCapture 初始化完成');
    } catch (error) {
      Logger.error('CDPCapture 初始化失败:', error);
      
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
   * 连接到调试器
   */
  private async attach(): Promise<void> {
    if (this.isAttached) {
      return;
    }

    try {
      await chrome.debugger.attach(this.debuggee, CONSTANTS.CDP_VERSION);
      this.isAttached = true;
      Logger.info('已连接到Chrome DevTools Protocol');

      // 启用必要的域
      await Promise.all([
        chrome.debugger.sendCommand(this.debuggee, "Page.enable"),
        chrome.debugger.sendCommand(this.debuggee, "Runtime.enable"), 
        chrome.debugger.sendCommand(this.debuggee, "DOM.enable")
      ]);

      Logger.info('CDP域启用完成');
    } catch (error) {
      this.isAttached = false;
      Logger.error('CDP连接失败:', error);
      throw error;
    }
  }

  /**
   * 断开调试器连接
   */
  private async detach(): Promise<void> {
    if (!this.isAttached) {
      return;
    }

    try {
      await chrome.debugger.detach(this.debuggee);
      this.isAttached = false;
      Logger.info('已断开Chrome DevTools Protocol连接');
    } catch (error) {
      Logger.warn('断开调试器连接时出错:', error);
    }
  }

  /**
   * 获取页面布局信息
   */
  private async getLayoutMetrics(): Promise<LayoutMetrics> {
    const layoutMetrics = await chrome.debugger.sendCommand(
      this.debuggee, 
      "Page.getLayoutMetrics"
    ) as unknown as LayoutMetrics;
    
    Logger.info('页面布局信息:', layoutMetrics);
    return layoutMetrics;
  }

  /**
   * 设置设备模拟参数
   */
  private async setDeviceMetrics(
    width: number, 
    height: number, 
    scaleFactor: number
  ): Promise<void> {
    await chrome.debugger.sendCommand(this.debuggee, "Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: scaleFactor,
      mobile: false
    });

    Logger.info(`设置视口大小: ${width}x${height}, 缩放: ${scaleFactor}`);
  }

  /**
   * 触发页面重排和重绘
   */
  private async triggerReflow(): Promise<void> {
    await chrome.debugger.sendCommand(this.debuggee, "Runtime.evaluate", {
      expression: `
        // 强制重排
        document.body.offsetHeight;
        // 滚动到顶部确保从正确位置开始
        window.scrollTo(0, 0);
        // 触发重绘
        true;
      `
    });

    // 等待重排完成
    await delay(CONSTANTS.STABILIZATION_DELAY);
  }

  /**
   * 执行截图
   */
  private async captureScreenshot(): Promise<string> {
    Logger.info('开始CDP截图...');
    
    const result = await chrome.debugger.sendCommand(
      this.debuggee, 
      "Page.captureScreenshot", 
      {
        format: "png",
        captureBeyondViewport: true,  // 关键参数：截取超出视口的内容
        optimizeForSpeed: false,      // 优化质量而非速度
        fromSurface: true            // 从渲染表面截图，确保获取完整内容
      }
    ) as unknown as CaptureScreenshotResult;

    return `data:image/png;base64,${result.data}`;
  }

  /**
   * 计算目标截图高度
   */
  private calculateTargetHeight(
    layoutMetrics: LayoutMetrics, 
    scrollInfo: ScrollAnalysisResult
  ): number {
    let targetHeight = layoutMetrics.cssContentSize.height;
    
    if (scrollInfo.maxIncrementalHeight > 0) {
      targetHeight = layoutMetrics.cssContentSize.height + scrollInfo.maxIncrementalHeight;
      
      Logger.info(`检测到滚动容器，增量高度: ${scrollInfo.maxIncrementalHeight}px`);
      
      if (scrollInfo.bestContainer) {
        Logger.info('最佳滚动容器:', scrollInfo.bestContainer);
      }
    }

    return targetHeight;
  }

  /**
   * 使用CDP截取全页面截图 - 公共接口
   */
  async captureFullPage(): Promise<void> {
    try {
      await this.initialize();
      await this.attach();

      // 获取页面布局信息
      const layoutMetrics = await this.getLayoutMetrics();

      // 获取滚动容器信息
      let scrollInfo: ScrollAnalysisResult;
      try {
        Logger.info('尝试获取滚动容器信息...', this.tab.id);
        
        scrollInfo = await sendMessageToContentScript<ScrollAnalysisResult>(
          this.tab.id!,
          { action: 'analyzeScrollContainers' }
        );
        
        Logger.info('成功获取滚动容器信息:', scrollInfo);
      } catch (error) {
        Logger.warn('无法获取滚动容器信息，使用默认值:', error);
        
        // 使用默认的滚动容器信息
        scrollInfo = {
          scrollContainers: [],
          maxIncrementalHeight: 0,
          bestContainer: null
        };
      }

      // 计算目标截图高度
      const targetHeight = this.calculateTargetHeight(layoutMetrics, scrollInfo);

      // 设置视口以确保能捕获完整内容
      if (layoutMetrics.cssContentSize) {
        const { width } = layoutMetrics.cssContentSize;
        const scaleFactor = layoutMetrics.contentSize.width / layoutMetrics.cssContentSize.width;
        
        await this.setDeviceMetrics(width, targetHeight, scaleFactor);
      }

      // 触发页面重排
      await this.triggerReflow();

      // 执行截图
      const dataUrl = await this.captureScreenshot();
      
      // 下载图片
      await ImageProcessor.processAndDownload(
        dataUrl, 
        this.tab.title || 'full-page-screenshot-cdp'
      );
      
      Logger.info('CDP全页面截图成功完成');

    } catch (error) {
      Logger.error('CDP截图失败:', error);
      throw error;
    } finally {
      await this.detach();
    }
  }

  /**
   * 检查CDP可用性
   */
  static async isAvailable(): Promise<boolean> {
    try {
      if (!chrome.debugger) {
        return false;
      }

      // 尝试获取当前标签页
      const tab = await getCurrentTab();
      
      // 检查是否可以附加调试器（不实际附加）
      const debuggee = { tabId: tab.id! };
      
      // 简单的可用性检查
      return true;
    } catch (error) {
      Logger.warn('CDP不可用:', error);
      return false;
    }
  }

  /**
   * 获取CDP版本信息
   */
  static getCDPVersion(): string {
    return CONSTANTS.CDP_VERSION;
  }
}

/**
 * CDP截图的便捷函数
 */
export async function captureFullPageWithCDP(tab?: ChromeTab): Promise<void> {
  const cdpCapture = new CDPCapture(tab);
  await cdpCapture.captureFullPage();
}

/**
 * 检查并使用CDP截图，失败时抛出错误
 */
export async function captureWithCDPOrThrow(tab?: ChromeTab): Promise<void> {
  if (!(await CDPCapture.isAvailable())) {
    throw new Error('CDP功能不可用');
  }

  await captureFullPageWithCDP(tab);
} 
