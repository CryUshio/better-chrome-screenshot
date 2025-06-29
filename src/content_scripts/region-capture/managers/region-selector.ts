/**
 * Better Chrome Screenshot - 区域选择器
 * 功能：处理鼠标拖拽选择截图区域的逻辑
 */

import type { 
  IRegionSelector, 
  SelectionBoxConfig, 
  EventHandlers, 
  MousePosition, 
  SelectionBounds 
} from '../types/internal';
import type { RegionCaptureConfig } from '../../../types';

/**
 * 区域选择器
 * 负责处理鼠标拖拽选择区域的交互逻辑
 */
export class RegionSelector implements IRegionSelector {
  private isSelecting = false;
  private startPosition: MousePosition = { x: 0, y: 0 };
  private currentRegion: RegionCaptureConfig | null = null;
  private selectionBox: HTMLDivElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private eventHandlers: EventHandlers = {};
  
  // 默认配置
  private readonly defaultConfig: SelectionBoxConfig = {
    borderColor: '#0066cc',
    borderWidth: 2,
    backgroundColor: 'rgba(0, 102, 204, 0.1)',
    minSize: 50
  };

  /**
   * 初始化组件
   */
  async initialize(): Promise<void> {
    // 初始化完成
  }

  /**
   * 销毁组件
   */
  destroy(): void {
    this.stopSelection();
  }

  /**
   * 检查是否处于活动状态
   */
  isActive(): boolean {
    return this.isSelecting;
  }

  /**
   * 开始选择
   */
  startSelection(overlay: HTMLDivElement, config?: SelectionBoxConfig): void {
    this.overlay = overlay;
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // 添加事件监听器
    this.overlay.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    
    // 设置配置
    this.config = finalConfig;
    
    console.log('区域选择器已启动');
  }

  /**
   * 停止选择
   */
  stopSelection(): void {
    if (this.overlay) {
      this.overlay.removeEventListener('mousedown', this.handleMouseDown);
    }
    
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
    this.removeSelectionBox();
    this.isSelecting = false;
    this.overlay = null;
    
    console.log('区域选择器已停止');
  }

  /**
   * 获取当前选择的区域
   */
  getCurrentRegion(): RegionCaptureConfig | null {
    return this.currentRegion;
  }

  /**
   * 设置事件处理器
   */
  setEventHandlers(handlers: EventHandlers): void {
    this.eventHandlers = handlers;
  }

  /**
   * 配置存储
   */
  private config: SelectionBoxConfig = this.defaultConfig;

  /**
   * 处理鼠标按下事件
   */
  private handleMouseDown = (e: MouseEvent): void => {
    // 只处理在覆盖层上的点击
    if (e.target !== this.overlay) return;
    
    this.isSelecting = true;
    this.startPosition = { x: e.clientX, y: e.clientY };
    
    // 移除现有的选择框
    this.removeSelectionBox();
    
    // 创建新的选择框
    this.createSelectionBox(this.startPosition.x, this.startPosition.y, 0, 0);
    
    // 调用事件处理器
    this.eventHandlers.onSelectionStart?.(this.startPosition);
    
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * 处理鼠标移动事件
   */
  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isSelecting || !this.selectionBox) return;
    
    const currentPosition = { x: e.clientX, y: e.clientY };
    
    // 计算选择框的边界
    const bounds = this.calculateBounds(this.startPosition, currentPosition);
    
    // 更新选择框
    this.updateSelectionBox(bounds);
    
    // 调用事件处理器
    this.eventHandlers.onSelectionMove?.(bounds);
    
    e.preventDefault();
  };

  /**
   * 处理鼠标释放事件
   */
  private handleMouseUp = (e: MouseEvent): void => {
    if (!this.isSelecting) return;
    
    this.isSelecting = false;
    
    if (this.selectionBox) {
      const rect = this.selectionBox.getBoundingClientRect();
      
      // 检查选择区域是否达到最小尺寸要求
      if (rect.width >= this.config.minSize && rect.height >= this.config.minSize) {
        this.currentRegion = {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        };
        
        // 调用事件处理器
        this.eventHandlers.onSelectionEnd?.(this.currentRegion);
        
        console.log('选择区域完成:', this.currentRegion);
      } else {
        // 选择区域太小，移除选择框
        this.removeSelectionBox();
        this.currentRegion = null;
        
        console.log('选择区域太小，已取消');
      }
    }
    
    e.preventDefault();
  };

  /**
   * 计算选择框边界
   */
  private calculateBounds(start: MousePosition, current: MousePosition): SelectionBounds {
    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    
    return { left, top, width, height };
  }

  /**
   * 创建选择框
   */
  private createSelectionBox(x: number, y: number, width: number, height: number): void {
    this.selectionBox = document.createElement('div');
    this.selectionBox.id = 'screenshot-selection-box';
    this.selectionBox.style.cssText = `
      position: fixed;
      border: ${this.config.borderWidth}px solid ${this.config.borderColor};
      background: ${this.config.backgroundColor};
      pointer-events: none;
      z-index: 1000000;
      left: ${x}px;
      top: ${y}px;
      width: ${width}px;
      height: ${height}px;
      box-sizing: border-box;
    `;
    
    // 添加尺寸提示
    this.addSizeIndicator();
    
    document.body.appendChild(this.selectionBox);
  }

  /**
   * 更新选择框
   */
  private updateSelectionBox(bounds: SelectionBounds): void {
    if (!this.selectionBox) return;
    
    this.selectionBox.style.left = bounds.left + 'px';
    this.selectionBox.style.top = bounds.top + 'px';
    this.selectionBox.style.width = bounds.width + 'px';
    this.selectionBox.style.height = bounds.height + 'px';
    
    // 更新尺寸提示
    this.updateSizeIndicator(bounds.width, bounds.height);
  }

  /**
   * 移除选择框
   */
  private removeSelectionBox(): void {
    if (this.selectionBox) {
      this.selectionBox.remove();
      this.selectionBox = null;
    }
  }

  /**
   * 添加尺寸指示器
   */
  private addSizeIndicator(): void {
    if (!this.selectionBox) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'size-indicator';
    indicator.style.cssText = `
      position: absolute;
      top: -25px;
      left: 0;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
      font-family: monospace;
      white-space: nowrap;
      pointer-events: none;
    `;
    
    this.selectionBox.appendChild(indicator);
  }

  /**
   * 更新尺寸指示器
   */
  private updateSizeIndicator(width: number, height: number): void {
    if (!this.selectionBox) return;
    
    const indicator = this.selectionBox.querySelector('.size-indicator') as HTMLDivElement;
    if (indicator) {
      indicator.textContent = `${Math.round(width)} × ${Math.round(height)}`;
      
      // 调整指示器位置，避免超出视口
      const rect = this.selectionBox.getBoundingClientRect();
      if (rect.top < 30) {
        indicator.style.top = '100%';
        indicator.style.bottom = 'auto';
      } else {
        indicator.style.top = '-25px';
        indicator.style.bottom = 'auto';
      }
    }
  }

  /**
   * 验证选择区域
   */
  private isValidSelection(width: number, height: number): boolean {
    return width >= this.config.minSize && height >= this.config.minSize;
  }

  /**
   * 获取选择框元素
   */
  getSelectionBox(): HTMLDivElement | null {
    return this.selectionBox;
  }
} 
