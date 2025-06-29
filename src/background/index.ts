/**
 * Better Chrome Screenshot - 背景脚本入口
 * 功能：处理截图命令、消息监听、功能整合
 * 作者：用户需求 - 重新组织background.ts，拆分为合理的细粒度文件以便维护
 * 新增：区域截图功能支持
 * 重构：将原始单体文件拆分为合理的模块化结构，遵循软件设计规范
 * 设计原则：
 * - 单一职责原则：每个模块专注于特定功能
 * - 开闭原则：易于扩展新功能
 * - 依赖倒置原则：依赖抽象而非具体实现
 * - 接口隔离原则：提供清晰的模块接口
 */

import type { CaptureMessage, CaptureResponse, RegionCaptureMessage, RegionCaptureResponse } from '../types';
import { captureFullPageWithCDP, CDPCapture } from './captures/cdp-capture';
import { captureFullPageScreenshot, getScreenshotEstimate } from './captures/scroll-capture';
import { getCurrentTab, Logger } from '../utils';

/**
 * 截图策略管理器
 * 负责选择合适的截图方法
 */
class CaptureStrategy {
  /**
   * 尝试使用CDP截图，失败时回退到滚动截图
   */
  static async captureWithFallback(): Promise<{ success: boolean; method: string }> {
    try {
      // 优先使用CDP方法
      await captureFullPageWithCDP();
      Logger.info('CDP截图成功完成');
      return { success: true, method: 'CDP' };
    } catch (error) {
      Logger.info('CDP截图失败，回退到滚动截图方法', error);
      
      try {
        // 回退到滚动截图方法 - 不传递tab参数，让ScrollCapture内部自行获取
        await captureFullPageScreenshot();
        Logger.info('滚动截图成功完成');
        return { success: true, method: 'scroll' };
      } catch (scrollError) {
        Logger.error('滚动截图也失败了:', scrollError);
        throw scrollError;
      }
    }
  }

  /**
   * 直接使用滚动截图方法
   */
  static async captureWithScroll(): Promise<{ success: boolean; method: string }> {
    try {
      await captureFullPageScreenshot();
      Logger.info('滚动截图成功完成');
      return { success: true, method: 'scroll' };
    } catch (error) {
      Logger.error('滚动截图失败:', error);
      throw error;
    }
  }

  /**
   * 新增：区域截图支持
   */
  static async captureRegion(region: any): Promise<{ success: boolean; method: string }> {
    try {
      // 区域截图主要由content script处理
      // 这里主要是提供可见区域截图的API支持
      Logger.info('区域截图请求已接收', region);
      return { success: true, method: 'region' };
    } catch (error) {
      Logger.error('区域截图失败:', error);
      throw error;
    }
  }

  /**
   * 检查CDP可用性
   */
  static async isCDPAvailable(): Promise<boolean> {
    return await CDPCapture.isAvailable();
  }
}

/**
 * 消息处理器
 * 处理来自弹窗和其他组件的消息
 */
class MessageHandler {
  /**
   * 处理截图请求消息
   */
  static async handleCaptureMessage(
    request: CaptureMessage,
    sendResponse: (response: CaptureResponse) => void
  ): Promise<void> {
    try {
      let result: { success: boolean; method: string };

      switch (request.action) {
        case 'captureFullPage':
          // 使用策略模式：优先CDP，失败时回退到滚动截图
          result = await CaptureStrategy.captureWithFallback();
          break;

        case 'captureFullPageScroll':
          // 直接使用滚动截图方法
          result = await CaptureStrategy.captureWithScroll();
          break;

        case 'captureRegion':
          // 新增：区域截图（实际由content script处理，这里只提供截图API支持）
          if (request.data?.region) {
            result = await CaptureStrategy.captureRegion(request.data.region);
          } else {
            throw new Error('缺少区域截图参数');
          }
          break;

        default:
          throw new Error(`未知的截图动作: ${request.action}`);
      }

      sendResponse({
        success: true,
        method: result.method as 'CDP' | 'scroll'
      });

    } catch (error) {
      Logger.error('截图消息处理失败:', error);
      
      let errorMessage = '截图失败';
      
      if (error instanceof Error) {
        // 处理特定类型的错误
        if (error.message.includes('标签页')) {
          errorMessage = '标签页错误: ' + error.message;
        } else if (error.message.includes('权限')) {
          errorMessage = '权限错误: ' + error.message;
        } else if (error.message.includes('网络')) {
          errorMessage = '网络错误: ' + error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      sendResponse({
        success: false,
        error: errorMessage
      });
    }
  }

  /**
   * 处理可见区域截图请求
   */
  static async handleCaptureVisibleTab(
    sendResponse: (response: { success: boolean; dataUrl?: string; error?: string }) => void
  ): Promise<void> {
    try {
      const tab = await getCurrentTab();
      if (!tab || !tab.windowId) {
        throw new Error('无法获取当前标签页');
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      sendResponse({ success: true, dataUrl });
    } catch (error) {
      Logger.error('截取可见区域失败:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : '截图失败' 
      });
    }
  }

  /**
   * 初始化消息监听器
   */
  static initializeMessageListener(): void {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // 检查是否为截图相关消息
      if (request.action === 'captureFullPage' || request.action === 'captureFullPageScroll' || request.action === 'captureRegion') {
        // 异步处理消息
        this.handleCaptureMessage(request as CaptureMessage, sendResponse);
        return true; // 保持消息通道开放以支持异步响应
      }

      // 新增：可见区域截图支持
      if (request.action === 'captureVisibleTab') {
        this.handleCaptureVisibleTab(sendResponse);
        return true; // 异步处理
      }

      // 其他消息类型的处理可以在这里扩展
      return false;
    });

    Logger.info('消息监听器已初始化');
  }
}

/**
 * 命令处理器
 * 处理键盘快捷键命令
 */
class CommandHandler {
  /**
   * 处理截图命令
   */
  static async handleCaptureCommand(): Promise<void> {
    try {
      const result = await CaptureStrategy.captureWithFallback();
      Logger.info(`命令截图完成，使用方法: ${result.method}`);
    } catch (error) {
      Logger.error('命令截图失败:', error);
    }
  }

  /**
   * 初始化命令监听器
   */
  static initializeCommandListener(): void {
    chrome.commands.onCommand.addListener((command) => {
      if (command === "capture-full-screenshot") {
        this.handleCaptureCommand();
      }
    });

    Logger.info('命令监听器已初始化');
  }
}

/**
 * 应用程序初始化器
 */
class AppInitializer {
  /**
   * 初始化所有功能模块
   */
  static initialize(): void {
    try {
      // 初始化消息监听器
      MessageHandler.initializeMessageListener();

      // 初始化命令监听器  
      CommandHandler.initializeCommandListener();

      // 启动轮询（如果需要保持扩展活跃）
      this.startPolling();

      Logger.info('Better Chrome Screenshot 扩展已初始化');
    } catch (error) {
      Logger.error('扩展初始化失败:', error);
    }
  }

  /**
   * 启动轮询功能
   * 保持 service worker 活跃（可选）
   */
  private static startPolling(): void {
    const polling = () => {
      Logger.debug('轮询检查');
      setTimeout(polling, 1000 * 30); // 30秒轮询
    };

    polling();
  }

  /**
   * 获取扩展状态信息
   */
  static async getStatus(): Promise<{
    cdpAvailable: boolean;
    version: string;
    initialized: boolean;
  }> {
    return {
      cdpAvailable: await CaptureStrategy.isCDPAvailable(),
      version: chrome.runtime.getManifest().version,
      initialized: true
    };
  }

  /**
   * 测试截图功能是否正常
   */
  static async testCaptureFunction(): Promise<{
    success: boolean;
    details: {
      cdpAvailable: boolean;
      scrollCaptureReady: boolean;
      currentTab: any;
    };
    error?: string;
  }> {
    try {
      Logger.info('开始测试截图功能...');
      
      // 测试CDP可用性
      const cdpAvailable = await CaptureStrategy.isCDPAvailable();
      Logger.info(`CDP可用性: ${cdpAvailable}`);
      
      // 测试获取当前标签页
      const currentTab = await getCurrentTab();
      Logger.info('当前标签页:', currentTab);
      
      // 测试滚动截图初始化
      let scrollCaptureReady = false;
      try {
        const { screenshotCount } = await getScreenshotEstimate();
        scrollCaptureReady = screenshotCount >= 0;
        Logger.info(`滚动截图预估: ${screenshotCount} 张`);
      } catch (error) {
        Logger.warn('滚动截图测试失败:', error);
      }
      
      const testResult = {
        success: true,
        details: {
          cdpAvailable,
          scrollCaptureReady,
          currentTab: {
            id: currentTab.id,
            title: currentTab.title,
            url: currentTab.url
          }
        }
      };
      
      Logger.info('截图功能测试完成:', testResult);
      return testResult;
      
    } catch (error) {
      Logger.error('截图功能测试失败:', error);
      return {
        success: false,
        details: {
          cdpAvailable: false,
          scrollCaptureReady: false,
          currentTab: null
        },
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }
}

// 导出主要功能以供测试或外部调用
export {
  CaptureStrategy,
  MessageHandler,
  CommandHandler,
  AppInitializer
};

// 扩展启动时初始化
AppInitializer.initialize(); 
