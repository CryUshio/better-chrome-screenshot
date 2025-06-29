/**
 * Better Chrome Screenshot - 区域调整器
 * 功能：实现区域的拖拽移动和8个调整句柄功能
 */

import type { 
  IRegionAdjuster, 
  SelectionBoxConfig, 
  EventHandlers, 
  MousePosition, 
  ResizeHandle, 
  ResizeHandleConfig 
} from '../types/internal';
import type { RegionCaptureConfig } from '../../../types';

/**
 * 区域调整器
 * 负责处理选中区域的拖拽移动和大小调整
 */
export class RegionAdjuster implements IRegionAdjuster {
  private isAdjusting = false;
  private isDragging = false;
  private isResizing = false;
  private dragStart: MousePosition = { x: 0, y: 0 };
  private resizeHandle: ResizeHandle | '' = '';
  private currentRegion: RegionCaptureConfig | null = null;
  private adjustmentBox: HTMLDivElement | null = null;
  private resizeHandles: HTMLDivElement[] = [];
  private eventHandlers: EventHandlers = {};
  
  // 默认配置
  private readonly defaultConfig: SelectionBoxConfig = {
    borderColor: '#0066cc',
    borderWidth: 2,
    backgroundColor: 'rgba(0, 102, 204, 0.1)',
    minSize: 50
  };

  // 调整句柄配置
  private readonly handleConfigs: ResizeHandleConfig[] = [
    { position: 'nw', cursor: 'nw-resize', style: { top: '-4px', left: '-4px' } },
    { position: 'ne', cursor: 'ne-resize', style: { top: '-4px', right: '-4px' } },
    { position: 'sw', cursor: 'sw-resize', style: { bottom: '-4px', left: '-4px' } },
    { position: 'se', cursor: 'se-resize', style: { bottom: '-4px', right: '-4px' } },
    { position: 'n', cursor: 'n-resize', style: { top: '-4px', left: '50%', transform: 'translateX(-50%)' } },
    { position: 's', cursor: 's-resize', style: { bottom: '-4px', left: '50%', transform: 'translateX(-50%)' } },
    { position: 'w', cursor: 'w-resize', style: { left: '-4px', top: '50%', transform: 'translateY(-50%)' } },
    { position: 'e', cursor: 'e-resize', style: { right: '-4px', top: '50%', transform: 'translateY(-50%)' } }
  ];

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
    this.disableAdjustment();
  }

  /**
   * 检查是否处于活动状态
   */
  isActive(): boolean {
    return this.isAdjusting;
  }

  /**
   * 启用区域调整
   */
  enableAdjustment(region: RegionCaptureConfig, config?: SelectionBoxConfig): void {
    this.currentRegion = { ...region };
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // 创建可调整的选择框
    this.createAdjustmentBox(finalConfig);
    
    // 添加事件监听器
    this.addEventListeners();
    
    this.isAdjusting = true;
    this.config = finalConfig;
    
    console.log('区域调整器已启用');
  }

  /**
   * 禁用区域调整
   */
  disableAdjustment(): void {
    this.removeEventListeners();
    this.removeAdjustmentBox();
    
    this.isAdjusting = false;
    this.isDragging = false;
    this.isResizing = false;
    this.currentRegion = null;
    
    console.log('区域调整器已禁用');
  }

  /**
   * 获取当前区域
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
   * 创建调整框
   */
  private createAdjustmentBox(config: SelectionBoxConfig): void {
    if (!this.currentRegion) return;
    
    const region = this.currentRegion;
    
    // 创建主容器
    this.adjustmentBox = document.createElement('div');
    this.adjustmentBox.id = 'screenshot-adjustment-box';
    this.adjustmentBox.style.cssText = `
      position: fixed;
      left: ${region.x}px;
      top: ${region.y}px;
      width: ${region.width}px;
      height: ${region.height}px;
      border: ${config.borderWidth}px solid ${config.borderColor};
      background: ${config.backgroundColor};
      z-index: 1000000;
      cursor: move;
      box-sizing: border-box;
    `;

    // 创建调整句柄
    this.createResizeHandles();
    
    // 添加区域信息显示
    this.addRegionInfo();
    
    document.body.appendChild(this.adjustmentBox);
  }

  /**
   * 创建调整句柄
   */
  private createResizeHandles(): void {
    if (!this.adjustmentBox) return;
    
    this.resizeHandles = [];
    
    this.handleConfigs.forEach(handleConfig => {
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      handle.dataset.position = handleConfig.position;
      
      // 设置句柄样式
      let styleText = `
        position: absolute;
        width: 8px;
        height: 8px;
        background: ${this.config.borderColor};
        cursor: ${handleConfig.cursor};
        z-index: 1000001;
        border: 1px solid white;
        box-sizing: border-box;
      `;
      
      // 添加位置样式
      Object.entries(handleConfig.style).forEach(([key, value]) => {
        styleText += `${key}: ${value};`;
      });
      
      handle.style.cssText = styleText;
      
      // 添加句柄事件监听
      handle.addEventListener('mousedown', this.handleResizeStart);
      
      this.adjustmentBox!.appendChild(handle);
      this.resizeHandles.push(handle);
    });
  }

  /**
   * 添加区域信息显示
   */
  private addRegionInfo(): void {
    if (!this.adjustmentBox || !this.currentRegion) return;
    
    const info = document.createElement('div');
    info.className = 'region-info';
    info.style.cssText = `
      position: absolute;
      top: -30px;
      left: 0;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      white-space: nowrap;
      pointer-events: none;
    `;
    
    this.updateRegionInfo();
    this.adjustmentBox.appendChild(info);
  }

  /**
   * 更新区域信息
   */
  private updateRegionInfo(): void {
    if (!this.adjustmentBox || !this.currentRegion) return;
    
    const info = this.adjustmentBox.querySelector('.region-info') as HTMLDivElement;
    if (info) {
      const { width, height } = this.currentRegion;
      info.textContent = `${Math.round(width)} × ${Math.round(height)}`;
      
      // 调整位置避免超出视口
      if (this.currentRegion.y < 35) {
        info.style.top = '100%';
        info.style.bottom = 'auto';
      } else {
        info.style.top = '-30px';
        info.style.bottom = 'auto';
      }
    }
  }

  /**
   * 移除调整框
   */
  private removeAdjustmentBox(): void {
    if (this.adjustmentBox) {
      this.adjustmentBox.remove();
      this.adjustmentBox = null;
      this.resizeHandles = [];
    }
  }

  /**
   * 添加事件监听器
   */
  private addEventListeners(): void {
    if (this.adjustmentBox) {
      this.adjustmentBox.addEventListener('mousedown', this.handleDragStart);
    }
    
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  /**
   * 移除事件监听器
   */
  private removeEventListeners(): void {
    if (this.adjustmentBox) {
      this.adjustmentBox.removeEventListener('mousedown', this.handleDragStart);
    }
    
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
    // 移除句柄事件监听器
    this.resizeHandles.forEach(handle => {
      handle.removeEventListener('mousedown', this.handleResizeStart);
    });
  }

  /**
   * 处理拖拽开始
   */
  private handleDragStart = (e: MouseEvent): void => {
    // 如果点击的是调整句柄，不处理拖拽
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
    
    this.isDragging = true;
    this.dragStart = { x: e.clientX, y: e.clientY };
    
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * 处理调整开始
   */
  private handleResizeStart = (e: MouseEvent): void => {
    this.isResizing = true;
    this.resizeHandle = (e.target as HTMLElement).dataset.position as ResizeHandle || '';
    this.dragStart = { x: e.clientX, y: e.clientY };
    
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * 处理鼠标移动
   */
  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.currentRegion || !this.adjustmentBox) return;
    
    if (this.isDragging) {
      this.handleDrag(e);
    } else if (this.isResizing) {
      this.handleResize(e);
    }
  };

  /**
   * 处理拖拽
   */
  private handleDrag(e: MouseEvent): void {
    if (!this.currentRegion || !this.adjustmentBox) return;
    
    const deltaX = e.clientX - this.dragStart.x;
    const deltaY = e.clientY - this.dragStart.y;
    
    // 计算新位置，确保不超出视口
    const newX = Math.max(0, Math.min(
      window.innerWidth - this.currentRegion.width,
      this.currentRegion.x + deltaX
    ));
    const newY = Math.max(0, Math.min(
      window.innerHeight - this.currentRegion.height,
      this.currentRegion.y + deltaY
    ));
    
    // 更新区域位置
    this.currentRegion.x = newX;
    this.currentRegion.y = newY;
    
    // 更新调整框位置
    this.adjustmentBox.style.left = newX + 'px';
    this.adjustmentBox.style.top = newY + 'px';
    
    // 更新拖拽起点
    this.dragStart = { x: e.clientX, y: e.clientY };
    
    // 更新信息显示
    this.updateRegionInfo();
    
    // 调用事件处理器
    this.eventHandlers.onRegionMove?.(this.currentRegion);
  }

  /**
   * 处理调整大小
   */
  private handleResize(e: MouseEvent): void {
    if (!this.currentRegion || !this.adjustmentBox) return;
    
    const deltaX = e.clientX - this.dragStart.x;
    const deltaY = e.clientY - this.dragStart.y;
    
    let newX = this.currentRegion.x;
    let newY = this.currentRegion.y;
    let newWidth = this.currentRegion.width;
    let newHeight = this.currentRegion.height;
    
    // 根据调整句柄位置计算新的区域
    switch (this.resizeHandle) {
      case 'nw':
        newX = this.currentRegion.x + deltaX;
        newY = this.currentRegion.y + deltaY;
        newWidth = this.currentRegion.width - deltaX;
        newHeight = this.currentRegion.height - deltaY;
        break;
      case 'ne':
        newY = this.currentRegion.y + deltaY;
        newWidth = this.currentRegion.width + deltaX;
        newHeight = this.currentRegion.height - deltaY;
        break;
      case 'sw':
        newX = this.currentRegion.x + deltaX;
        newWidth = this.currentRegion.width - deltaX;
        newHeight = this.currentRegion.height + deltaY;
        break;
      case 'se':
        newWidth = this.currentRegion.width + deltaX;
        newHeight = this.currentRegion.height + deltaY;
        break;
      case 'n':
        newY = this.currentRegion.y + deltaY;
        newHeight = this.currentRegion.height - deltaY;
        break;
      case 's':
        newHeight = this.currentRegion.height + deltaY;
        break;
      case 'w':
        newX = this.currentRegion.x + deltaX;
        newWidth = this.currentRegion.width - deltaX;
        break;
      case 'e':
        newWidth = this.currentRegion.width + deltaX;
        break;
    }
    
    // 限制最小尺寸
    newWidth = Math.max(this.config.minSize, newWidth);
    newHeight = Math.max(this.config.minSize, newHeight);
    
    // 限制边界
    newX = Math.max(0, Math.min(window.innerWidth - newWidth, newX));
    newY = Math.max(0, Math.min(window.innerHeight - newHeight, newY));
    
    // 更新区域
    this.currentRegion.x = newX;
    this.currentRegion.y = newY;
    this.currentRegion.width = newWidth;
    this.currentRegion.height = newHeight;
    
    // 更新调整框
    this.adjustmentBox.style.left = newX + 'px';
    this.adjustmentBox.style.top = newY + 'px';
    this.adjustmentBox.style.width = newWidth + 'px';
    this.adjustmentBox.style.height = newHeight + 'px';
    
    // 更新拖拽起点
    this.dragStart = { x: e.clientX, y: e.clientY };
    
    // 更新信息显示
    this.updateRegionInfo();
    
    // 调用事件处理器
    this.eventHandlers.onRegionResize?.(this.currentRegion);
  }

  /**
   * 处理鼠标释放
   */
  private handleMouseUp = (): void => {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = '';
  };

  /**
   * 获取调整框元素
   */
  getAdjustmentBox(): HTMLDivElement | null {
    return this.adjustmentBox;
  }
} 
