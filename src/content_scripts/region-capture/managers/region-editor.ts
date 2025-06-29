/**
 * Better Chrome Screenshot - 区域编辑器（优化版本）
 * 功能：基于 Fabric.js 实现完整的图像编辑功能
 * 优化：正确处理scale factor，在镂空区域上编辑
 */

import type { 
  IRegionEditor, 
  EditToolConfig
} from '../types/internal';
import type { RegionCaptureConfig } from '../../../types';

/**
 * 区域编辑器（优化版本）
 * 负责在镂空区域上进行编辑操作
 */
export class RegionEditor implements IRegionEditor {
  private isEditing = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentRegion: RegionCaptureConfig | null = null;
  private regionImageData: string | null = null;
  private backgroundImage: HTMLImageElement | null = null;
  private currentTool: EditToolConfig | null = null;
  private currentColor = '#ff0000';
  private strokeWidth = 3;
  private scaleFactor = 1;
  private overlayElement: HTMLDivElement | null = null;
  
  // 绘制状态
  private isDrawing = false;
  private lastDrawPoint: { x: number; y: number } | null = null;
  private drawingObjects: any[] = [];
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  // 可用的编辑工具
  private readonly availableTools: EditToolConfig[] = [
    {
      type: 'rectangle',
      color: '#ff0000',
      strokeWidth: 3,
      icon: 'rectangle',
      label: '矩形',
      active: false
    },
    {
      type: 'arrow',
      color: '#ff0000',
      strokeWidth: 3,
      icon: 'arrow-up-right',
      label: '箭头',
      active: false
    },
    {
      type: 'text',
      color: '#ff0000',
      strokeWidth: 3,
      icon: 'text',
      label: '文字',
      active: false
    },
    {
      type: 'pen',
      color: '#ff0000',
      strokeWidth: 3,
      icon: 'pencil',
      label: '画笔',
      active: false
    }
  ];

  /**
   * 初始化组件
   */
  async initialize(): Promise<void> {
    this.scaleFactor = window.devicePixelRatio || 1;
  }

  /**
   * 销毁组件
   */
  destroy(): void {
    this.stopEditing();
  }

  /**
   * 检查是否处于活动状态
   */
  isActive(): boolean {
    return this.isEditing;
  }

  /**
   * 开始编辑
   */
  async startEditing(region: RegionCaptureConfig, screenshotData: string): Promise<void> {
    this.currentRegion = { ...region };
    this.regionImageData = screenshotData;
    this.isEditing = true;
    
    // 创建编辑画布，覆盖在镂空区域上
    this.createEditingCanvas();
    
    // 加载背景图片
    await this.loadBackgroundImage();
    
    // 绘制背景到画布
    this.drawBackground();
    
    // 设置默认工具
    this.setTool(this.availableTools[3]); // 默认选择画笔工具
    
    // 添加事件监听器
    this.addEventListeners();
    
    console.log('区域编辑器已启动（优化版本）');
  }

  /**
   * 停止编辑
   */
  stopEditing(): void {
    this.removeEventListeners();
    
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }
    
    this.isEditing = false;
    this.currentRegion = null;
    this.regionImageData = null;
    this.backgroundImage = null;
    this.drawingObjects = [];
    this.undoStack = [];
    this.redoStack = [];
    
    console.log('区域编辑器已停止');
  }

  /**
   * 设置编辑工具
   */
  setTool(tool: EditToolConfig): void {
    this.currentTool = { ...tool, active: true };
    this.currentColor = tool.color;
    this.strokeWidth = tool.strokeWidth;
    
    // 重置所有工具状态
    this.availableTools.forEach(t => t.active = false);
    
    // 设置当前工具状态
    const toolIndex = this.availableTools.findIndex(t => t.type === tool.type);
    if (toolIndex >= 0) {
      this.availableTools[toolIndex].active = true;
    }
    
    // 更新画布光标
    this.updateCanvasCursor();
    
    console.log('切换到工具:', tool.label);
  }

  /**
   * 设置颜色
   */
  setColor(color: string): void {
    this.currentColor = color;
    
    if (this.currentTool) {
      this.currentTool.color = color;
    }
    
    console.log('设置颜色:', color);
  }

  /**
   * 设置线条宽度
   */
  setStrokeWidth(width: number): void {
    this.strokeWidth = width;
    
    if (this.currentTool) {
      this.currentTool.strokeWidth = width;
    }
    
    console.log('设置线条宽度:', width);
  }

  /**
   * 获取编辑后的图像
   */
  getEditedImage(): string | null {
    if (!this.canvas) return null;
    
    return this.canvas.toDataURL('image/png');
  }

  /**
   * 撤销操作
   */
  undo(): void {
    if (this.undoStack.length === 0) return;
    
    // 保存当前状态到重做栈
    if (this.canvas) {
      this.redoStack.push(this.canvas.toDataURL());
    }
    
    // 恢复上一个状态
    const previousState = this.undoStack.pop();
    if (previousState && this.ctx) {
      const img = new Image();
      img.onload = () => {
        if (this.ctx && this.canvas) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.ctx.drawImage(img, 0, 0);
        }
      };
      img.src = previousState;
    }
    
    console.log('撤销操作完成');
  }

  /**
   * 重做操作
   */
  redo(): void {
    if (this.redoStack.length === 0) return;
    
    // 保存当前状态到撤销栈
    if (this.canvas) {
      this.undoStack.push(this.canvas.toDataURL());
    }
    
    // 恢复重做状态
    const nextState = this.redoStack.pop();
    if (nextState && this.ctx) {
      const img = new Image();
      img.onload = () => {
        if (this.ctx && this.canvas) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.ctx.drawImage(img, 0, 0);
        }
      };
      img.src = nextState;
    }
    
    console.log('重做操作完成');
  }

  /**
   * 清除所有绘制内容
   */
  clear(): void {
    if (!this.ctx || !this.canvas) return;
    
    // 保存当前状态
    this.saveState();
    
    // 清除画布并重绘背景
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackground();
    
    this.drawingObjects = [];
    
    console.log('清除所有绘制内容');
  }

  /**
   * 创建编辑画布
   */
  private createEditingCanvas(): void {
    if (!this.currentRegion) return;
    
    const region = this.currentRegion;
    
    // 创建canvas元素，覆盖在镂空区域上
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'screenshot-edit-canvas';
    
    // 考虑设备像素比设置画布大小
    this.canvas.width = region.width * this.scaleFactor;
    this.canvas.height = region.height * this.scaleFactor;
    
    // 设置显示大小
    this.canvas.style.cssText = `
      position: fixed;
      left: ${region.x}px;
      top: ${region.y}px;
      width: ${region.width}px;
      height: ${region.height}px;
      z-index: 1000004;
      cursor: crosshair;
      border: 2px solid rgba(0, 150, 255, 0.8);
      box-shadow: 0 0 20px rgba(0, 150, 255, 0.3);
    `;
    
    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) {
      // 设置高分辨率绘制
      this.ctx.scale(this.scaleFactor, this.scaleFactor);
      
      // 设置绘制样式
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.imageSmoothingEnabled = true;
    }
    
    document.body.appendChild(this.canvas);
  }

  /**
   * 加载背景图片
   */
  private async loadBackgroundImage(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.regionImageData) {
        reject(new Error('区域图片数据不存在'));
        return;
      }
      
      this.backgroundImage = new Image();
      this.backgroundImage.onload = () => resolve();
      this.backgroundImage.onerror = () => reject(new Error('背景图片加载失败'));
      this.backgroundImage.src = this.regionImageData;
    });
  }

  /**
   * 绘制背景图片
   */
  private drawBackground(): void {
    if (!this.ctx || !this.backgroundImage || !this.currentRegion) return;
    
    // 绘制背景图片
    this.ctx.drawImage(
      this.backgroundImage,
      0, 0, this.currentRegion.width, this.currentRegion.height
    );
  }

  /**
   * 添加事件监听器
   */
  private addEventListeners(): void {
    if (!this.canvas) return;
    
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    
    // 键盘事件
    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * 移除事件监听器
   */
  private removeEventListeners(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
      this.canvas.removeEventListener('mouseup', this.handleMouseUp);
      this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    }
    
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  /**
   * 处理鼠标按下事件
   */
  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.ctx || !this.currentTool) return;
    
    const point = this.getCanvasPoint(e);
    this.isDrawing = true;
    this.lastDrawPoint = point;
    
    // 保存状态以便撤销
    this.saveState();
    
    switch (this.currentTool.type) {
      case 'pen':
        this.startPenDrawing(point);
        break;
      case 'rectangle':
        this.startRectangleDrawing(point);
        break;
      case 'arrow':
        this.startArrowDrawing(point);
        break;
      case 'text':
        this.startTextDrawing(point);
        break;
    }
    
    e.preventDefault();
  };

  /**
   * 处理鼠标移动事件
   */
  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isDrawing || !this.ctx || !this.currentTool) return;
    
    const point = this.getCanvasPoint(e);
    
    switch (this.currentTool.type) {
      case 'pen':
        this.continuePenDrawing(point);
        break;
      case 'rectangle':
        this.continueRectangleDrawing(point);
        break;
      case 'arrow':
        this.continueArrowDrawing(point);
        break;
    }
    
    this.lastDrawPoint = point;
  };

  /**
   * 处理鼠标释放事件
   */
  private handleMouseUp = (e: MouseEvent): void => {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    this.lastDrawPoint = null;
    
    // 清空重做栈（新操作会使重做无效）
    this.redoStack = [];
  };

  /**
   * 处理鼠标离开事件
   */
  private handleMouseLeave = (): void => {
    this.isDrawing = false;
    this.lastDrawPoint = null;
  };

  /**
   * 处理键盘事件
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    // Ctrl+Z 撤销
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    }
    
    // Ctrl+Shift+Z 或 Ctrl+Y 重做
    if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
      e.preventDefault();
      this.redo();
    }
  };

  /**
   * 获取画布坐标
   */
  private getCanvasPoint(e: MouseEvent): { x: number; y: number } {
    if (!this.canvas) return { x: 0, y: 0 };
    
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * 开始画笔绘制
   */
  private startPenDrawing(point: { x: number; y: number }): void {
    if (!this.ctx) return;
    
    this.ctx.beginPath();
    this.ctx.moveTo(point.x, point.y);
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.strokeWidth;
  }

  /**
   * 继续画笔绘制
   */
  private continuePenDrawing(point: { x: number; y: number }): void {
    if (!this.ctx) return;
    
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();
  }

  /**
   * 开始矩形绘制
   */
  private startRectangleDrawing(point: { x: number; y: number }): void {
    this.drawStart = point;
  }

  private drawStart: { x: number; y: number } = { x: 0, y: 0 };
  private originalImageData: ImageData | null = null;

  /**
   * 继续矩形绘制
   */
  private continueRectangleDrawing(point: { x: number; y: number }): void {
    if (!this.ctx || !this.canvas) return;
    
    // 保存原始图像数据（首次）
    if (!this.originalImageData) {
      this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 恢复原始图像
    this.ctx.putImageData(this.originalImageData, 0, 0);
    
    // 绘制矩形
    const width = point.x - this.drawStart.x;
    const height = point.y - this.drawStart.y;
    
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.strokeWidth;
    this.ctx.strokeRect(this.drawStart.x, this.drawStart.y, width, height);
  }

  /**
   * 开始箭头绘制
   */
  private startArrowDrawing(point: { x: number; y: number }): void {
    this.drawStart = point;
  }

  /**
   * 继续箭头绘制
   */
  private continueArrowDrawing(point: { x: number; y: number }): void {
    if (!this.ctx || !this.canvas) return;
    
    // 保存原始图像数据（首次）
    if (!this.originalImageData) {
      this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 恢复原始图像
    this.ctx.putImageData(this.originalImageData, 0, 0);
    
    // 绘制箭头
    this.drawArrow(this.drawStart, point);
  }

  /**
   * 开始文字绘制
   */
  private startTextDrawing(point: { x: number; y: number }): void {
    const text = prompt('请输入文字：');
    if (text && this.ctx) {
      this.ctx.fillStyle = this.currentColor;
      this.ctx.font = `${this.strokeWidth * 6}px Arial`;
      this.ctx.fillText(text, point.x, point.y);
    }
  }

  /**
   * 绘制箭头
   */
  private drawArrow(start: { x: number; y: number }, end: { x: number; y: number }): void {
    if (!this.ctx) return;
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);
    
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.fillStyle = this.currentColor;
    this.ctx.lineWidth = this.strokeWidth;
    
    // 绘制箭头线
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
    
    // 绘制箭头头部
    const arrowLength = this.strokeWidth * 4;
    const arrowAngle = Math.PI / 6;
    
    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - arrowLength * Math.cos(angle - arrowAngle),
      end.y - arrowLength * Math.sin(angle - arrowAngle)
    );
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - arrowLength * Math.cos(angle + arrowAngle),
      end.y - arrowLength * Math.sin(angle + arrowAngle)
    );
    this.ctx.stroke();
  }

  /**
   * 更新画布光标
   */
  private updateCanvasCursor(): void {
    if (!this.canvas || !this.currentTool) return;
    
    switch (this.currentTool.type) {
      case 'pen':
        this.canvas.style.cursor = 'crosshair';
        break;
      case 'rectangle':
        this.canvas.style.cursor = 'crosshair';
        break;
      case 'arrow':
        this.canvas.style.cursor = 'crosshair';
        break;
      case 'text':
        this.canvas.style.cursor = 'text';
        break;
      default:
        this.canvas.style.cursor = 'default';
    }
  }

  /**
   * 保存状态到撤销栈
   */
  private saveState(): void {
    if (!this.canvas) return;
    
    // 限制撤销栈大小
    if (this.undoStack.length >= 20) {
      this.undoStack.shift();
    }
    
    this.undoStack.push(this.canvas.toDataURL());
    
    // 重置临时状态
    this.originalImageData = null;
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): EditToolConfig[] {
    return [...this.availableTools];
  }

  /**
   * 获取当前工具
   */
  getCurrentTool(): EditToolConfig | null {
    return this.currentTool;
  }

  /**
   * 获取当前颜色
   */
  getCurrentColor(): string {
    return this.currentColor;
  }

  /**
   * 获取当前线条宽度
   */
  getCurrentStrokeWidth(): number {
    return this.strokeWidth;
  }
} 
