/**
 * Better Chrome Screenshot - 区域截图内部类型定义
 * 功能：定义区域截图模块内部使用的类型和接口
 */

import type { RegionCaptureConfig, RegionCaptureState, EditTool } from '../../../types';

// 鼠标事件相关类型
export interface MousePosition {
  x: number;
  y: number;
}

export interface SelectionBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

// 调整句柄类型
export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e';

export interface ResizeHandleConfig {
  position: ResizeHandle;
  cursor: string;
  style: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
    transform?: string;
  };
}

// 覆盖层配置
export interface OverlayConfig {
  zIndex: number;
  backgroundColor: string;
  screenshotOpacity: number;
}

// 选择框配置
export interface SelectionBoxConfig {
  borderColor: string;
  borderWidth: number;
  backgroundColor: string;
  minSize: number;
}

// 工具栏配置
export interface ToolbarConfig {
  position: 'bottom' | 'top' | 'left' | 'right';
  offset: number;
  backgroundColor: string;
  borderColor: string;
  borderRadius: number;
  padding: number;
  gap: number;
  zIndex: number;
}

// 编辑工具配置
export interface EditToolConfig extends EditTool {
  icon: string;
  label: string;
  active: boolean;
}

// 颜色配置
export interface ColorConfig {
  colors: string[];
  defaultColor: string;
}

// 事件处理器类型
export interface EventHandlers {
  onSelectionStart?: (position: MousePosition) => void;
  onSelectionMove?: (bounds: SelectionBounds) => void;
  onSelectionEnd?: (region: RegionCaptureConfig) => void;
  onRegionMove?: (region: RegionCaptureConfig) => void;
  onRegionResize?: (region: RegionCaptureConfig) => void;
  onToolChange?: (tool: EditToolConfig) => void;
  onColorChange?: (color: string) => void;
  onStrokeWidthChange?: (width: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// 管理器状态接口
export interface ManagerState {
  isActive: boolean;
  currentPhase: 'selecting' | 'adjusting' | 'editing' | 'finished';
  currentRegion?: RegionCaptureConfig;
  currentTool?: EditToolConfig;
  currentColor: string;
  strokeWidth: number;
}

// Fabric.js 相关类型
export interface FabricCanvasOptions {
  width: number;
  height: number;
  backgroundColor?: string;
  selection: boolean;
  preserveObjectStacking: boolean;
}

// 绘制对象类型
export interface DrawingObject {
  id: string;
  type: 'rectangle' | 'arrow' | 'text' | 'path';
  data: any;
  createdAt: number;
}

// 组件接口
export interface RegionCaptureComponent {
  initialize(): Promise<void>;
  destroy(): void;
  isActive(): boolean;
}

// 覆盖层管理器接口
export interface IScreenshotOverlay extends RegionCaptureComponent {
  create(screenshotData: string, config?: OverlayConfig): void;
  remove(): void;
  getElement(): HTMLDivElement | null;
  getCutoutElement(): HTMLDivElement | null;
  setOpacity(opacity: number): void;
  updateCutout(region: RegionCaptureConfig): void;
  hideCutout(): void;
  getRegionImageData(region: RegionCaptureConfig): Promise<string>;
  getScaleFactor(): number;
}

// 区域选择器接口
export interface IRegionSelector extends RegionCaptureComponent {
  startSelection(overlay: HTMLDivElement, config?: SelectionBoxConfig): void;
  stopSelection(): void;
  getCurrentRegion(): RegionCaptureConfig | null;
  setEventHandlers(handlers: EventHandlers): void;
}

// 区域调整器接口
export interface IRegionAdjuster extends RegionCaptureComponent {
  enableAdjustment(region: RegionCaptureConfig, config?: SelectionBoxConfig): void;
  disableAdjustment(): void;
  getCurrentRegion(): RegionCaptureConfig | null;
  setEventHandlers(handlers: EventHandlers): void;
  getAdjustmentBox(): HTMLDivElement | null;
}

// 编辑器接口
export interface IRegionEditor extends RegionCaptureComponent {
  startEditing(region: RegionCaptureConfig, screenshotData: string): Promise<void>;
  stopEditing(): void;
  setTool(tool: EditToolConfig): void;
  setColor(color: string): void;
  setStrokeWidth(width: number): void;
  getEditedImage(): string | null;
  undo(): void;
  redo(): void;
  clear(): void;
}

// 工具栏管理器接口
export interface IToolbarManager extends RegionCaptureComponent {
  createSelectionToolbar(container: HTMLElement, config?: ToolbarConfig): void;
  createEditingToolbar(container: HTMLElement, config?: ToolbarConfig): void;
  removeToolbar(): void;
  setEventHandlers(handlers: EventHandlers): void;
  updateToolState(tool: EditToolConfig): void;
  updateColorState(color: string): void;
  updateRegion(region: RegionCaptureConfig): void;
} 
