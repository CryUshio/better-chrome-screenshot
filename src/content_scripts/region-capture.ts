/**
 * Better Chrome Screenshot - 区域截图模块（兼容性入口）
 * 功能：保持向后兼容，同时使用新的模块化架构
 * 重构：将原始的单体文件重构为模块化架构
 * 
 * 变更说明：
 * - 原始的 RegionCaptureManager 类已被重构为多个专门的组件
 * - 新架构提供更好的可维护性和扩展性
 * - 此文件作为兼容性入口，保持原有的 API 不变
 * - 实际功能由新的模块化组件提供
 */

// 导入新的模块化架构
export { 
  regionCaptureManager,
  RegionCaptureManager,
  VERSION,
  ARCHITECTURE
} from './region-capture/index';

// 为了向后兼容，也导出所有内部类型
export type {
  IScreenshotOverlay,
  IRegionSelector,
  IRegionAdjuster,
  IRegionEditor,
  IToolbarManager,
  OverlayConfig,
  SelectionBoxConfig,
  ToolbarConfig,
  EditToolConfig,
  ColorConfig,
  ManagerState,
  EventHandlers,
  MousePosition,
  SelectionBounds,
  ResizeHandle,
  ResizeHandleConfig,
  FabricCanvasOptions,
  DrawingObject
} from './region-capture/index';

/**
 * 重构总结：
 * 
 * 原始文件问题：
 * ✗ 单一文件496行，违反单一职责原则
 * ✗ RegionCaptureManager 承担过多职责
 * ✗ 难以测试和维护
 * ✗ Fabric.js 功能未完全实现
 * ✗ 缺少区域调整功能
 * 
 * 重构后的改进：
 * ✓ 拆分为6个专门的组件，职责单一
 * ✓ 完整实现了所有功能：
 *   - 区域选择（带尺寸提示）
 *   - 区域调整（8个调整句柄 + 拖拽移动）
 *   - 图像编辑（完整的Fabric.js集成）
 *   - 工具栏管理（选择工具栏 + 编辑工具栏）
 *   - 覆盖层管理（键盘快捷键 + 滚动控制）
 * ✓ 完整的TypeScript类型支持
 * ✓ 事件驱动架构，松耦合设计
 * ✓ 易于测试和扩展
 * 
 * 新增功能：
 * 1. 完整的区域调整功能
 *    - 8个方向的调整句柄
 *    - 拖拽移动整个区域
 *    - 实时尺寸显示
 *    - 边界检查和最小尺寸限制
 * 
 * 2. 完整的编辑功能
 *    - 矩形、箭头、文字、画笔工具
 *    - 颜色选择器
 *    - 线条宽度调整
 *    - 撤销/重做功能
 *    - 清除和删除功能
 * 
 * 3. 增强的用户体验
 *    - 键盘快捷键（ESC取消、Ctrl+Z撤销等）
 *    - 尺寸实时显示
 *    - 工具状态可视化
 *    - 平滑的阶段转换
 * 
 * 架构优势：
 * - 单一职责：每个类专注于特定功能
 * - 开闭原则：易于扩展新功能
 * - 依赖倒置：基于接口而非具体实现
 * - 接口隔离：清晰的组件边界
 * - 类型安全：完整的TypeScript支持
 */ 
