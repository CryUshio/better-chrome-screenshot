/**
 * Better Chrome Screenshot - 区域截图模块入口（重构版本）
 * 功能：导出重构后的区域截图管理器和相关类型
 * 架构：模块化设计，每个组件专注于特定功能
 */

// 导出主管理器
export { RegionCaptureManager } from './managers/region-capture-manager';

// 导出各个子组件（可选，用于测试或定制）
export { ScreenshotOverlay } from './managers/screenshot-overlay';
export { RegionSelector } from './managers/region-selector';
export { RegionAdjuster } from './managers/region-adjuster';
export { RegionEditor } from './managers/region-editor';
export { ToolbarManager } from './managers/toolbar-manager';

// 导出内部类型定义
export type {
  // 基础接口
  IScreenshotOverlay,
  IRegionSelector,
  IRegionAdjuster,
  IRegionEditor,
  IToolbarManager,
  
  // 配置类型
  OverlayConfig,
  SelectionBoxConfig,
  ToolbarConfig,
  EditToolConfig,
  ColorConfig,
  
  // 状态和事件类型
  ManagerState,
  EventHandlers,
  MousePosition,
  SelectionBounds,
  ResizeHandle,
  ResizeHandleConfig,
  
  // Fabric.js 相关类型
  FabricCanvasOptions,
  DrawingObject
} from './types/internal';

// 创建并导出单例实例（保持向后兼容）
import { RegionCaptureManager } from './managers/region-capture-manager';
export const regionCaptureManager = new RegionCaptureManager();

// 导出版本信息
export const VERSION = '2.0.0';
export const ARCHITECTURE = 'modular';

/**
 * 架构说明：
 * 
 * 1. RegionCaptureManager - 主协调器
 *    - 管理所有组件的生命周期
 *    - 协调组件间的交互
 *    - 提供统一的对外接口
 * 
 * 2. ScreenshotOverlay - 覆盖层管理器
 *    - 管理半透明蒙层
 *    - 处理键盘事件
 *    - 禁用/恢复页面滚动
 * 
 * 3. RegionSelector - 区域选择器
 *    - 处理鼠标拖拽选择
 *    - 实时显示选择框
 *    - 尺寸验证和指示
 * 
 * 4. RegionAdjuster - 区域调整器
 *    - 提供8个调整句柄
 *    - 支持拖拽移动
 *    - 实时边界检查
 * 
 * 5. RegionEditor - 区域编辑器
 *    - 基于Fabric.js的编辑功能
 *    - 多种绘制工具
 *    - 撤销/重做支持
 * 
 * 6. ToolbarManager - 工具栏管理器
 *    - 创建选择和编辑工具栏
 *    - 工具状态管理
 *    - 事件分发
 * 
 * 优势：
 * - 职责单一，易于维护
 * - 松耦合，便于测试
 * - 可扩展，支持插件化
 * - 类型安全，完整的TypeScript支持
 */ 
