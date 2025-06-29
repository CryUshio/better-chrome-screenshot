/**
 * Better Chrome Screenshot - 截图覆盖层管理器（优化版本）
 * 功能：专门管理截图的覆盖层，包括蒙层和镂空区域显示
 * 优化：添加镂空功能，实时显示选中区域的真实内容
 */

import type { IScreenshotOverlay, OverlayConfig } from '../types/internal';
import type { RegionCaptureConfig } from '../../../types';

/**
 * 截图覆盖层管理器
 * 负责创建和管理半透明蒙层和镂空区域
 */
export class ScreenshotOverlay implements IScreenshotOverlay {
  private overlay: HTMLDivElement | null = null;
  private screenshotLayer: HTMLDivElement | null = null;
  private cutoutRegion: HTMLDivElement | null = null;
  private originalScrollBehavior = '';
  private screenshotDataUrl: string | null = null;
  private scaleFactor: number = 1;
  
  // 默认配置
  private readonly defaultConfig: OverlayConfig = {
    zIndex: 999999,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    screenshotOpacity: 1.0
  };

  /**
   * 初始化组件
   */
  async initialize(): Promise<void> {
    // 保存原始滚动行为
    this.originalScrollBehavior = document.body.style.overflow;
    
    // 获取设备像素比
    this.scaleFactor = window.devicePixelRatio || 1;
    
    // 禁用页面滚动
    this.disablePageScroll();
  }

  /**
   * 销毁组件
   */
  destroy(): void {
    this.remove();
    this.restorePageScroll();
  }

  /**
   * 检查是否处于活动状态
   */
  isActive(): boolean {
    return this.overlay !== null;
  }

  /**
   * 创建覆盖层
   */
  create(screenshotData: string, config?: OverlayConfig): void {
    const finalConfig = { ...this.defaultConfig, ...config };
    this.screenshotDataUrl = screenshotData;
    
    // 创建主覆盖层容器
    this.overlay = document.createElement('div');
    this.overlay.id = 'screenshot-region-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: ${finalConfig.zIndex};
      cursor: crosshair;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      pointer-events: auto;
    `;

    // 创建蒙层背景（四个区域围绕镂空区域）
    this.createMaskLayers(finalConfig);

    document.body.appendChild(this.overlay);

    // 添加键盘事件监听
    this.addKeyboardListeners();
  }

  /**
   * 创建镂空蒙层
   */
  private createMaskLayers(config: OverlayConfig): void {
    // 创建四个蒙层区域：上、下、左、右
    const maskAreas = ['top', 'bottom', 'left', 'right'];
    
    maskAreas.forEach(area => {
      const maskDiv = document.createElement('div');
      maskDiv.className = `mask-area mask-${area}`;
      maskDiv.style.cssText = `
        position: absolute;
        background: ${config.backgroundColor};
        pointer-events: none;
        z-index: 1;
      `;
      this.overlay!.appendChild(maskDiv);
    });

    // 创建镂空区域（显示真实内容）
    this.cutoutRegion = document.createElement('div');
    this.cutoutRegion.id = 'cutout-region';
    this.cutoutRegion.style.cssText = `
      position: absolute;
      background-image: url(${this.screenshotDataUrl});
      background-repeat: no-repeat;
      background-size: ${window.innerWidth}px ${window.innerHeight}px;
      z-index: 2;
      border: 2px solid rgba(0, 150, 255, 0.8);
      box-shadow: 0 0 20px rgba(0, 150, 255, 0.5);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;
    
    this.overlay!.appendChild(this.cutoutRegion);
  }

  /**
   * 更新镂空区域
   */
  updateCutout(region: RegionCaptureConfig): void {
    if (!this.overlay || !this.cutoutRegion) return;

    // 显示镂空区域
    this.cutoutRegion.style.opacity = '1';
    
    // 更新镂空区域位置和大小
    this.cutoutRegion.style.left = region.x + 'px';
    this.cutoutRegion.style.top = region.y + 'px';
    this.cutoutRegion.style.width = region.width + 'px';
    this.cutoutRegion.style.height = region.height + 'px';
    
    // 更新背景图片位置（实现镂空效果）
    this.cutoutRegion.style.backgroundPosition = `-${region.x}px -${region.y}px`;

    // 更新四个蒙层区域
    this.updateMaskAreas(region);
  }

  /**
   * 更新四个蒙层区域
   */
  private updateMaskAreas(region: RegionCaptureConfig): void {
    if (!this.overlay) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 上方蒙层
    const topMask = this.overlay.querySelector('.mask-top') as HTMLDivElement;
    if (topMask) {
      topMask.style.cssText += `
        top: 0;
        left: 0;
        width: ${viewportWidth}px;
        height: ${region.y}px;
      `;
    }

    // 下方蒙层
    const bottomMask = this.overlay.querySelector('.mask-bottom') as HTMLDivElement;
    if (bottomMask) {
      bottomMask.style.cssText += `
        top: ${region.y + region.height}px;
        left: 0;
        width: ${viewportWidth}px;
        height: ${viewportHeight - region.y - region.height}px;
      `;
    }

    // 左方蒙层
    const leftMask = this.overlay.querySelector('.mask-left') as HTMLDivElement;
    if (leftMask) {
      leftMask.style.cssText += `
        top: ${region.y}px;
        left: 0;
        width: ${region.x}px;
        height: ${region.height}px;
      `;
    }

    // 右方蒙层
    const rightMask = this.overlay.querySelector('.mask-right') as HTMLDivElement;
    if (rightMask) {
      rightMask.style.cssText += `
        top: ${region.y}px;
        left: ${region.x + region.width}px;
        width: ${viewportWidth - region.x - region.width}px;
        height: ${region.height}px;
      `;
    }
  }

  /**
   * 隐藏镂空区域
   */
  hideCutout(): void {
    if (this.cutoutRegion) {
      this.cutoutRegion.style.opacity = '0';
    }
    
    // 恢复全屏蒙层
    if (this.overlay) {
      const maskAreas = this.overlay.querySelectorAll('.mask-area');
      maskAreas.forEach(mask => {
        (mask as HTMLDivElement).style.display = 'none';
      });
    }
  }

  /**
   * 获取区域截图数据
   */
  getRegionImageData(region: RegionCaptureConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.screenshotDataUrl) {
        reject(new Error('截图数据不存在'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('无法创建canvas上下文'));
          return;
        }

        // 考虑设备像素比
        const scaledWidth = region.width * this.scaleFactor;
        const scaledHeight = region.height * this.scaleFactor;
        const scaledX = region.x * this.scaleFactor;
        const scaledY = region.y * this.scaleFactor;

        canvas.width = scaledWidth;
        canvas.height = scaledHeight;

        // 裁剪并绘制区域图片
        ctx.drawImage(
          img,
          scaledX, scaledY, scaledWidth, scaledHeight,
          0, 0, scaledWidth, scaledHeight
        );

        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = this.screenshotDataUrl;
    });
  }

  /**
   * 移除覆盖层
   */
  remove(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.screenshotLayer = null;
      this.cutoutRegion = null;
    }
    
    this.removeKeyboardListeners();
  }

  /**
   * 获取覆盖层元素
   */
  getElement(): HTMLDivElement | null {
    return this.overlay;
  }

  /**
   * 获取镂空区域元素
   */
  getCutoutElement(): HTMLDivElement | null {
    return this.cutoutRegion;
  }

  /**
   * 设置截图透明度
   */
  setOpacity(opacity: number): void {
    if (this.cutoutRegion) {
      this.cutoutRegion.style.opacity = opacity.toString();
    }
  }

  /**
   * 获取scale factor
   */
  getScaleFactor(): number {
    return this.scaleFactor;
  }

  /**
   * 禁用页面滚动
   */
  private disablePageScroll(): void {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // 防止iOS设备上的橡皮筋效果
    document.addEventListener('touchmove', this.preventTouch, { passive: false });
  }

  /**
   * 恢复页面滚动
   */
  private restorePageScroll(): void {
    document.body.style.overflow = this.originalScrollBehavior;
    document.documentElement.style.overflow = '';
    
    document.removeEventListener('touchmove', this.preventTouch);
  }

  /**
   * 阻止触摸事件
   */
  private preventTouch = (e: TouchEvent): void => {
    e.preventDefault();
  };

  /**
   * 添加键盘事件监听
   */
  private addKeyboardListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * 移除键盘事件监听
   */
  private removeKeyboardListeners(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  /**
   * 处理键盘事件
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    // ESC键取消操作
    if (e.key === 'Escape') {
      // 派发取消事件
      const cancelEvent = new CustomEvent('regionCaptureCancel');
      document.dispatchEvent(cancelEvent);
    }
  };

  /**
   * 获取鼠标相对于视口的位置
   */
  getRelativePosition(clientX: number, clientY: number): { x: number; y: number } {
    return {
      x: clientX,
      y: clientY
    };
  }

  /**
   * 检查点是否在覆盖层内
   */
  isPointInOverlay(x: number, y: number): boolean {
    if (!this.overlay) return false;
    
    const rect = this.overlay.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  /**
   * 设置光标样式
   */
  setCursor(cursor: string): void {
    if (this.overlay) {
      this.overlay.style.cursor = cursor;
    }
  }
} 
