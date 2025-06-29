/**
 * Better Chrome Screenshot - 工具栏管理器（优化版本）
 * 功能：负责创建和管理选择工具栏和编辑工具栏
 * 优化：智能定位工具栏到框选区域下方，自动处理边界情况
 * 重构：使用SVG图标替换emoji，优化UI组件
 */

import type { 
  IToolbarManager, 
  ToolbarConfig, 
  EventHandlers, 
  EditToolConfig, 
  ColorConfig 
} from '../types/internal';
import type { RegionCaptureConfig } from '../../../types';

/**
 * SVG图标映射
 */
const SVG_ICONS = {
  // 工具图标
  rectangle: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`,
  arrow: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m7 17 10-10M17 7H7v10"></path></svg>`,
  text: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7V4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3M4 7h16M4 7l2 10h12l2-10"></path></svg>`,
  pen: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"></path></svg>`,
  
  // 操作图标
  undo: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"></path></svg>`,
  redo: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3"></path></svg>`,
  trash: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"></path></svg>`,
  check: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4.5 12.75 6 6 9-13.5"></path></svg>`,
  x: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12"></path></svg>`,
  edit: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`
};

/**
 * 工具栏管理器
 * 负责创建和管理各种工具栏界面
 */
export class ToolbarManager implements IToolbarManager {
  private toolbar: HTMLDivElement | null = null;
  private eventHandlers: EventHandlers = {};
  private currentTool: EditToolConfig | null = null;
  private currentColor = '#ff0000';
  private currentRegion: RegionCaptureConfig | null = null;
  
  // 默认配置
  private readonly defaultConfig: ToolbarConfig = {
    position: 'bottom',
    offset: 12,
    backgroundColor: 'white',
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    zIndex: 1000002
  };

  // 颜色配置
  private readonly colorConfig: ColorConfig = {
    colors: [
      '#ff0000', '#00ff00', '#0000ff', '#ffff00', 
      '#ff00ff', '#00ffff', '#000000', '#ffffff',
      '#ff8800', '#8800ff', '#88ff00', '#ff0088'
    ],
    defaultColor: '#ff0000'
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
    this.removeToolbar();
  }

  /**
   * 检查是否处于活动状态
   */
  isActive(): boolean {
    return this.toolbar !== null;
  }

  /**
   * 创建选择工具栏
   */
  createSelectionToolbar(container: HTMLElement, config?: ToolbarConfig): void {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'screenshot-selection-toolbar';
    this.toolbar.style.cssText = this.getToolbarBaseStyle(finalConfig);

    // 编辑按钮
    const editBtn = this.createIconButton(SVG_ICONS.edit, '编辑', '#28a745', () => {
      this.eventHandlers.onConfirm?.();
    });

    // 确认按钮
    const confirmBtn = this.createIconButton(SVG_ICONS.check, '确认', '#007bff', () => {
      this.eventHandlers.onConfirm?.();
    });

    // 取消按钮
    const cancelBtn = this.createIconButton(SVG_ICONS.x, '取消', '#dc3545', () => {
      this.eventHandlers.onCancel?.();
    });

    this.toolbar.appendChild(editBtn);
    this.toolbar.appendChild(confirmBtn);
    this.toolbar.appendChild(cancelBtn);

    // 智能定位工具栏
    this.positionToolbarToRegion(this.currentRegion, finalConfig);

    console.log('选择工具栏已创建');
  }

  /**
   * 创建编辑工具栏
   */
  createEditingToolbar(container: HTMLElement, config?: ToolbarConfig): void {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'screenshot-editing-toolbar';
    this.toolbar.style.cssText = `
      ${this.getToolbarBaseStyle(finalConfig)}
      flex-direction: column;
      min-width: 220px;
      max-width: 260px;
    `;

    // 创建工具选择区域
    const toolSection = this.createToolSection();
    this.toolbar.appendChild(toolSection);

    // 创建颜色选择区域
    const colorSection = this.createColorSection();
    this.toolbar.appendChild(colorSection);

    // 创建线条宽度控制
    const strokeSection = this.createStrokeSection();
    this.toolbar.appendChild(strokeSection);

    // 创建操作按钮区域
    const actionSection = this.createActionSection();
    this.toolbar.appendChild(actionSection);

    // 智能定位工具栏
    this.positionToolbarToRegion(this.currentRegion, finalConfig);

    console.log('编辑工具栏已创建');
  }

  /**
   * 更新当前区域（用于工具栏定位）
   */
  updateRegion(region: RegionCaptureConfig): void {
    this.currentRegion = region;
    
    // 如果工具栏已存在，重新定位
    if (this.toolbar) {
      this.positionToolbarToRegion(region, this.defaultConfig);
    }
  }

  /**
   * 智能定位工具栏到区域附近
   */
  private positionToolbarToRegion(region: RegionCaptureConfig | null, config: ToolbarConfig): void {
    if (!this.toolbar) return;
    
    if (!region) {
      // 如果没有区域信息，使用默认定位
      this.toolbar.style.cssText += `
        position: fixed;
        top: 20px;
        right: 20px;
      `;
      document.body.appendChild(this.toolbar);
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const toolbarRect = this.getEstimatedToolbarSize();
    
    let finalX = region.x;
    let finalY = region.y + region.height + config.offset;
    let placement = 'bottom';

    // 检查下方是否有足够空间
    if (finalY + toolbarRect.height > viewportHeight) {
      // 下方空间不足，尝试上方
      finalY = region.y - toolbarRect.height - config.offset;
      placement = 'top';
      
      // 如果上方也不够，放在区域内部下方
      if (finalY < 0) {
        finalY = region.y + region.height - toolbarRect.height - config.offset;
        placement = 'inside-bottom';
      }
    }

    // 水平居中，但确保不超出视口
    finalX = region.x + (region.width - toolbarRect.width) / 2;
    
    // 限制在视口内
    finalX = Math.max(10, Math.min(finalX, viewportWidth - toolbarRect.width - 10));
    finalY = Math.max(10, Math.min(finalY, viewportHeight - toolbarRect.height - 10));

    // 应用定位
    this.toolbar.style.cssText += `
      position: fixed;
      left: ${finalX}px;
      top: ${finalY}px;
      transform: none;
    `;

    // 添加位置指示器
    this.addPlacementIndicator(placement);

    document.body.appendChild(this.toolbar);
  }

  /**
   * 估算工具栏尺寸
   */
  private getEstimatedToolbarSize(): { width: number; height: number } {
    if (this.toolbar?.id === 'screenshot-selection-toolbar') {
      return { width: 200, height: 50 };
    } else {
      return { width: 260, height: 280 };
    }
  }

  /**
   * 添加位置指示器
   */
  private addPlacementIndicator(placement: string): void {
    if (!this.toolbar) return;

    // 移除已有的指示器
    const existingIndicator = this.toolbar.querySelector('.placement-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    const indicator = document.createElement('div');
    indicator.className = 'placement-indicator';
    
    let indicatorStyle = '';

    switch (placement) {
      case 'top':
        indicatorStyle = `
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid white;
        `;
        break;
      case 'bottom':
        indicatorStyle = `
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 6px solid white;
        `;
        break;
      case 'inside-bottom':
        // 添加半透明背景
        if (this.toolbar) {
          this.toolbar.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
          this.toolbar.style.backdropFilter = 'blur(5px)';
        }
        break;
    }

    if (indicatorStyle && this.toolbar) {
      indicator.style.cssText = indicatorStyle;
      this.toolbar.appendChild(indicator);
    }
  }

  /**
   * 移除工具栏
   */
  removeToolbar(): void {
    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }
  }

  /**
   * 设置事件处理器
   */
  setEventHandlers(handlers: EventHandlers): void {
    this.eventHandlers = handlers;
  }

  /**
   * 更新工具状态
   */
  updateToolState(tool: EditToolConfig): void {
    this.currentTool = tool;
    
    // 更新工具按钮状态
    if (this.toolbar) {
      const toolButtons = this.toolbar.querySelectorAll('.tool-button');
      toolButtons.forEach(button => {
        const btnElement = button as HTMLButtonElement;
        const toolType = btnElement.dataset.tool;
        
        if (toolType === tool.type) {
          btnElement.style.background = '#e3f2fd';
          btnElement.style.borderColor = '#0066cc';
          btnElement.style.transform = 'scale(0.95)';
        } else {
          btnElement.style.background = 'white';
          btnElement.style.borderColor = '#ddd';
          btnElement.style.transform = 'scale(1)';
        }
      });
    }
  }

  /**
   * 更新颜色状态
   */
  updateColorState(color: string): void {
    this.currentColor = color;
    
    // 更新颜色按钮状态
    if (this.toolbar) {
      const colorButtons = this.toolbar.querySelectorAll('.color-button');
      colorButtons.forEach(button => {
        const btnElement = button as HTMLButtonElement;
        const buttonColor = btnElement.dataset.color;
        
        if (buttonColor === color) {
          btnElement.style.border = '3px solid #0066cc';
          btnElement.style.transform = 'scale(1.15)';
          btnElement.style.boxShadow = '0 0 8px rgba(0, 102, 204, 0.4)';
        } else {
          btnElement.style.border = '2px solid #ddd';
          btnElement.style.transform = 'scale(1)';
          btnElement.style.boxShadow = 'none';
        }
      });
    }
  }

  /**
   * 获取工具栏基础样式
   */
  private getToolbarBaseStyle(config: ToolbarConfig): string {
    return `
      background: ${config.backgroundColor};
      border: 1px solid ${config.borderColor};
      border-radius: ${config.borderRadius}px;
      padding: ${config.padding}px;
      display: flex;
      gap: ${config.gap}px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      z-index: ${config.zIndex};
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
  }

  /**
   * 创建按钮（文本版本）
   */
  private createButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      background: ${color};
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      min-width: 70px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `;
    
    // 鼠标悬停效果
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    });
    
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * 创建图标按钮
   */
  private createIconButton(iconSvg: string, text: string, color: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        ${iconSvg}
        <span>${text}</span>
      </div>
    `;
    button.style.cssText = `
      background: ${color};
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      min-width: 70px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `;
    
    // 鼠标悬停效果
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    });
    
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * 创建工具选择区域
   */
  private createToolSection(): HTMLDivElement {
    const section = document.createElement('div');
    section.innerHTML = '<label style="font-weight: 600; margin-bottom: 8px; display: block; color: #333; font-size: 13px;">绘制工具</label>';

    const tools = [
      { type: 'rectangle', label: '矩形', icon: SVG_ICONS.rectangle },
      { type: 'arrow', label: '箭头', icon: SVG_ICONS.arrow },
      { type: 'text', label: '文字', icon: SVG_ICONS.text },
      { type: 'pen', label: '画笔', icon: SVG_ICONS.pen }
    ];

    const toolButtons = document.createElement('div');
    toolButtons.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px;';

    tools.forEach(tool => {
      const button = document.createElement('button');
      button.className = 'tool-button';
      button.dataset.tool = tool.type;
      button.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          ${tool.icon}
          <span style="font-size: 10px;">${tool.label}</span>
        </div>
      `;
      button.title = tool.label;
      button.style.cssText = `
        width: 100%;
        height: 50px;
        border: 2px solid #ddd;
        background: white;
        cursor: pointer;
        border-radius: 6px;
        font-size: 14px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1.2;
      `;

      button.addEventListener('mouseenter', () => {
        button.style.borderColor = '#0066cc';
        button.style.transform = 'scale(1.05)';
      });

      button.addEventListener('mouseleave', () => {
        if (!button.style.background.includes('rgb(227, 242, 253)')) {
          button.style.borderColor = '#ddd';
          button.style.transform = 'scale(1)';
        }
      });

      button.addEventListener('click', () => {
        const editTool: EditToolConfig = {
          type: tool.type as any,
          color: this.currentColor,
          strokeWidth: 3,
          icon: tool.type, // 使用图标名称而不是SVG
          label: tool.label,
          active: true
        };
        
        this.eventHandlers.onToolChange?.(editTool);
        this.updateToolState(editTool);
      });

      toolButtons.appendChild(button);
    });

    section.appendChild(toolButtons);
    return section;
  }

  /**
   * 创建颜色选择区域
   */
  private createColorSection(): HTMLDivElement {
    const section = document.createElement('div');
    section.innerHTML = '<label style="font-weight: 600; margin-bottom: 8px; display: block; color: #333; font-size: 13px;">颜色</label>';

    const colorButtons = document.createElement('div');
    colorButtons.style.cssText = 'display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;';

    this.colorConfig.colors.forEach(color => {
      const button = document.createElement('button');
      button.className = 'color-button';
      button.dataset.color = color;
      button.style.cssText = `
        width: 28px;
        height: 28px;
        border: 2px solid #ddd;
        background: ${color};
        cursor: pointer;
        border-radius: 50%;
        transition: all 0.2s ease;
        position: relative;
      `;

      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
      });

      button.addEventListener('mouseleave', () => {
        if (!button.style.border.includes('rgb(0, 102, 204)')) {
          button.style.transform = 'scale(1)';
        }
      });

      button.addEventListener('click', () => {
        this.eventHandlers.onColorChange?.(color);
        this.updateColorState(color);
      });

      colorButtons.appendChild(button);
    });

    section.appendChild(colorButtons);
    return section;
  }

  /**
   * 创建线条宽度控制区域
   */
  private createStrokeSection(): HTMLDivElement {
    const section = document.createElement('div');
    section.innerHTML = '<label style="font-weight: 600; margin-bottom: 8px; display: block; color: #333; font-size: 13px;">线条宽度</label>';

    const strokeControl = document.createElement('div');
    strokeControl.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    // 滑块
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '10';
    slider.value = '3';
    slider.style.cssText = `
      flex: 1;
      height: 6px;
      background: #ddd;
      outline: none;
      border-radius: 3px;
      cursor: pointer;
    `;

    // 数值显示
    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = '3px';
    valueDisplay.style.cssText = `
      min-width: 30px; 
      font-size: 12px; 
      font-weight: 500;
      color: #666;
    `;

    slider.addEventListener('input', () => {
      const width = parseInt(slider.value);
      valueDisplay.textContent = width + 'px';
      
      // 触发线条宽度变化事件
      this.eventHandlers.onStrokeWidthChange?.(width);
    });

    strokeControl.appendChild(slider);
    strokeControl.appendChild(valueDisplay);
    section.appendChild(strokeControl);

    return section;
  }

  /**
   * 创建操作按钮区域
   */
  private createActionSection(): HTMLDivElement {
    const section = document.createElement('div');
    section.style.cssText = 'display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap;';

    // 撤销按钮
    const undoBtn = this.createSmallIconButton(SVG_ICONS.undo, '撤销', '#6c757d', () => {
      this.eventHandlers.onUndo?.();
    });

    // 重做按钮
    const redoBtn = this.createSmallIconButton(SVG_ICONS.redo, '重做', '#6c757d', () => {
      this.eventHandlers.onRedo?.();
    });

    // 清除按钮
    const clearBtn = this.createSmallIconButton(SVG_ICONS.trash, '清除', '#dc3545', () => {
      if (confirm('确定要清除所有绘制内容吗？')) {
        this.eventHandlers.onClear?.();
      }
    });

    // 完成按钮
    const completeBtn = this.createIconButton(SVG_ICONS.check, '完成', '#28a745', () => {
      this.eventHandlers.onConfirm?.();
    });

    // 取消按钮
    const cancelBtn = this.createIconButton(SVG_ICONS.x, '取消', '#dc3545', () => {
      this.eventHandlers.onCancel?.();
    });

    section.appendChild(undoBtn);
    section.appendChild(redoBtn);
    section.appendChild(clearBtn);
    
    // 完成和取消按钮占一整行
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; gap: 6px; width: 100%; margin-top: 6px;';
    buttonRow.appendChild(completeBtn);
    buttonRow.appendChild(cancelBtn);
    
    section.appendChild(buttonRow);

    return section;
  }

  /**
   * 创建小图标按钮
   */
  private createSmallIconButton(iconSvg: string, title: string, color: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.innerHTML = iconSvg;
    button.title = title;
    button.style.cssText = `
      background: ${color};
      color: white;
      border: none;
      padding: 6px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });
    
    button.addEventListener('click', onClick);
    return button;
  }
} 
