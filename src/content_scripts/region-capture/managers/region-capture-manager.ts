/**
 * Better Chrome Screenshot - 区域截图主管理器（优化版本）
 * 功能：协调所有区域截图相关组件，提供统一的接口
 * 设计：遵循单一职责原则，每个组件专注于特定功能
 * 优化：集成镂空蒙层、智能工具栏定位和scale factor处理
 */

import type { 
  ManagerState, 
  EventHandlers, 
  EditToolConfig,
  IScreenshotOverlay,
  IRegionSelector,
  IRegionAdjuster,
  IRegionEditor,
  IToolbarManager
} from '../types/internal';
import type { RegionCaptureConfig, RegionCaptureState } from '../../../types';

import { ScreenshotOverlay } from './screenshot-overlay';
import { RegionSelector } from './region-selector';
import { RegionAdjuster } from './region-adjuster';
import { RegionEditor } from './region-editor';
import { ToolbarManager } from './toolbar-manager';

/**
 * 区域截图主管理器
 * 作为协调器管理所有子组件
 */
export class RegionCaptureManager {
  private state: ManagerState;
  private screenshotData: string | null = null;

  // 组件实例
  private overlay: IScreenshotOverlay;
  private selector: IRegionSelector;
  private adjuster: IRegionAdjuster;
  private editor: IRegionEditor;
  private toolbar: IToolbarManager;

  constructor() {
    this.state = {
      isActive: false,
      currentPhase: 'selecting',
      currentColor: '#ff0000',
      strokeWidth: 3
    };

    // 初始化组件
    this.overlay = new ScreenshotOverlay();
    this.selector = new RegionSelector();
    this.adjuster = new RegionAdjuster();
    this.editor = new RegionEditor();
    this.toolbar = new ToolbarManager();

    // 设置事件处理器
    this.setupEventHandlers();
  }

  /**
   * 开始区域截图
   */
  async startCapture(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('开始区域截图流程（优化版本）');

      // 1. 初始化所有组件
      await this.initializeComponents();

      // 2. 截取当前可见区域
      this.screenshotData = await this.captureVisibleArea();

      // 3. 创建覆盖层
      this.overlay.create(this.screenshotData);

      // 4. 开始选择阶段
      this.startSelectionPhase();

      this.state.isActive = true;
      this.state.currentPhase = 'selecting';

      return { success: true };
    } catch (error) {
      console.error('开始区域截图失败:', error);
      this.cleanup();
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  }

  /**
   * 获取当前状态
   */
  getState(): RegionCaptureState {
    return {
      isActive: this.state.isActive,
      isSelecting: this.state.currentPhase === 'selecting',
      isEditing: this.state.currentPhase === 'editing',
      currentRegion: this.state.currentRegion,
      screenshot: this.screenshotData || undefined
    };
  }

  /**
   * 取消截图
   */
  cancelCapture(): void {
    console.log('取消区域截图');
    this.cleanup();
  }

  /**
   * 初始化所有组件
   */
  private async initializeComponents(): Promise<void> {
    await Promise.all([
      this.overlay.initialize(),
      this.selector.initialize(),
      this.adjuster.initialize(),
      this.editor.initialize(),
      this.toolbar.initialize()
    ]);
  }

  /**
   * 截取当前可见区域
   */
  private async captureVisibleArea(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'captureVisibleTab' }, 
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response.success) {
            resolve(response.dataUrl);
          } else {
            reject(new Error(response.error || '截图失败'));
          }
        }
      );
    });
  }

  /**
   * 开始选择阶段
   */
  private startSelectionPhase(): void {
    const overlayElement = this.overlay.getElement();
    if (!overlayElement) {
      throw new Error('覆盖层未创建');
    }

    // 开始区域选择
    this.selector.startSelection(overlayElement);

    console.log('进入选择阶段');
  }

  /**
   * 开始调整阶段
   */
  private startAdjustmentPhase(region: RegionCaptureConfig): void {
    this.state.currentPhase = 'adjusting';
    this.state.currentRegion = region;

    // 显示镂空蒙层
    this.overlay.updateCutout(region);

    // 停止选择器
    this.selector.stopSelection();

    // 启用调整器
    this.adjuster.enableAdjustment(region);

    // 更新工具栏区域信息
    this.toolbar.updateRegion(region);

    // 创建选择工具栏
    const adjustmentBox = this.adjuster.getAdjustmentBox();
    if (adjustmentBox) {
      this.toolbar.createSelectionToolbar(adjustmentBox);
    }

    console.log('进入调整阶段');
  }

  /**
   * 开始编辑阶段
   */
  private async startEditingPhase(): Promise<void> {
    if (!this.state.currentRegion || !this.screenshotData) {
      throw new Error('缺少必要的截图数据');
    }

    this.state.currentPhase = 'editing';

    // 禁用调整器
    this.adjuster.disableAdjustment();

    // 移除选择工具栏
    this.toolbar.removeToolbar();

    // 获取区域图像数据
    const regionImageData = await this.overlay.getRegionImageData(this.state.currentRegion);

    // 开始编辑
    await this.editor.startEditing(this.state.currentRegion, regionImageData);

    // 更新工具栏区域信息
    this.toolbar.updateRegion(this.state.currentRegion);

    // 创建编辑工具栏
    const overlayElement = this.overlay.getElement();
    if (overlayElement) {
      this.toolbar.createEditingToolbar(overlayElement);
    }

    console.log('进入编辑阶段');
  }

  /**
   * 完成截图
   */
  private async finishCapture(): Promise<void> {
    try {
      let finalImage: string | null = null;

      if (this.state.currentPhase === 'editing') {
        // 从编辑器获取最终图像
        finalImage = this.editor.getEditedImage();
      } else if (this.state.currentRegion) {
        // 从覆盖层获取区域图像
        finalImage = await this.overlay.getRegionImageData(this.state.currentRegion);
      }

      if (finalImage) {
        // 下载图片
        await this.downloadImage(finalImage);
        console.log('区域截图完成');
      } else {
        throw new Error('无法生成最终图像');
      }

    } catch (error) {
      console.error('完成截图失败:', error);
      alert('保存截图失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      this.cleanup();
    }
  }

  /**
   * 下载图片
   */
  private async downloadImage(dataUrl: string): Promise<void> {
    const link = document.createElement('a');
    link.download = `screenshot-region-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    const handlers: EventHandlers = {
      // 选择事件
      onSelectionEnd: (region) => {
        this.startAdjustmentPhase(region);
      },

      // 区域调整事件
      onRegionMove: (region) => {
        this.state.currentRegion = region;
        // 实时更新镂空蒙层
        this.overlay.updateCutout(region);
        // 更新工具栏位置
        this.toolbar.updateRegion(region);
      },

      onRegionResize: (region) => {
        this.state.currentRegion = region;
        // 实时更新镂空蒙层
        this.overlay.updateCutout(region);
        // 更新工具栏位置
        this.toolbar.updateRegion(region);
      },

      // 工具栏事件
      onConfirm: () => {
        if (this.state.currentPhase === 'adjusting') {
          this.startEditingPhase();
        } else if (this.state.currentPhase === 'editing') {
          this.finishCapture();
        } else {
          this.finishCapture();
        }
      },

      onCancel: () => {
        this.cancelCapture();
      },

      // 编辑工具事件
      onToolChange: (tool) => {
        this.state.currentTool = tool;
        this.editor.setTool(tool);
        this.toolbar.updateToolState(tool);
      },

      onColorChange: (color) => {
        this.state.currentColor = color;
        this.editor.setColor(color);
        this.toolbar.updateColorState(color);
      }
    };

    // 设置到各个组件
    this.selector.setEventHandlers(handlers);
    this.adjuster.setEventHandlers(handlers);
    this.toolbar.setEventHandlers(handlers);

    // 监听全局取消事件
    document.addEventListener('regionCaptureCancel', () => {
      this.cancelCapture();
    });
  }

  /**
   * 清理所有资源
   */
  private cleanup(): void {
    // 销毁所有组件
    this.overlay.destroy();
    this.selector.destroy();
    this.adjuster.destroy();
    this.editor.destroy();
    this.toolbar.destroy();

    // 重置状态
    this.state = {
      isActive: false,
      currentPhase: 'selecting',
      currentColor: '#ff0000',
      strokeWidth: 3
    };

    this.screenshotData = null;

    console.log('区域截图管理器已清理');
  }

  /**
   * 检查是否处于活动状态
   */
  isActive(): boolean {
    return this.state.isActive;
  }

  /**
   * 获取当前阶段
   */
  getCurrentPhase(): string {
    return this.state.currentPhase;
  }

  /**
   * 获取当前区域
   */
  getCurrentRegion(): RegionCaptureConfig | undefined {
    return this.state.currentRegion;
  }

  /**
   * 获取scale factor
   */
  getScaleFactor(): number {
    return this.overlay.getScaleFactor();
  }
} 
