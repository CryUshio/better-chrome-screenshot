/**
 * Better Chrome Screenshot - 类型定义模块
 * 功能：定义项目中使用的所有接口和类型
 * 作者：用户需求 - 重构此项目调用 chrome.scripting.executeScript 的部分，所有前台交互操作都要写在 content_script 中
 * 新增：区域截图功能相关类型定义
 * 设计原则：遵循TypeScript最佳实践，提供清晰的类型定义
 */

// 滚动容器相关类型
export interface ScrollContainer {
  element: Element;
  scrollHeight: number;
  clientHeight: number;
  scrollable: boolean;
}

export interface ScrollContainerInfo {
  tagName: string;
  className: string;
  scrollHeight: number;
  clientHeight: number;
}

export interface ScrollAnalysisResult {
  scrollContainers: ScrollContainer[];
  maxIncrementalHeight: number;
  bestContainer: ScrollContainerInfo | null;
}

// 页面尺寸相关类型
export interface PageDimensions {
  totalWidth: number;
  totalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  devicePixelRatio: number;
}

// CDP 相关类型
export interface LayoutMetrics {
  layoutViewport: { clientWidth: number; clientHeight: number };
  contentSize: { width: number; height: number };
  cssContentSize: { width: number; height: number };
}

export interface CaptureScreenshotResult {
  data: string;
}

// 新增：区域截图相关类型
export interface RegionCaptureConfig {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface RegionCaptureState {
  isActive: boolean;
  isSelecting: boolean;
  isEditing: boolean;
  currentRegion?: RegionCaptureConfig;
  screenshot?: string;
}

// 区域截图消息类型
export interface RegionCaptureMessage {
  action: 'startRegionCapture' | 'finishRegionCapture' | 'cancelRegionCapture' | 'updateRegion' | 'startEdit' | 'finishEdit';
  data?: {
    region?: RegionCaptureConfig;
    screenshot?: string;
    editData?: any;
  };
}

export interface RegionCaptureResponse {
  success: boolean;
  data?: {
    screenshot?: string;
    region?: RegionCaptureConfig;
    editResult?: string;
  };
  error?: string;
}

// 编辑工具类型
export interface EditTool {
  type: 'rectangle' | 'arrow' | 'text' | 'pen';
  color: string;
  strokeWidth: number;
}

export interface EditAction {
  tool: EditTool;
  data: any;
  timestamp: number;
}

// 消息通信类型 - 扩展支持更多前台操作（包含区域截图）
export interface CaptureMessage {
  action: 'captureFullPage' | 'captureFullPageScroll' | 'captureRegion';
  data?: {
    region?: RegionCaptureConfig;
  };
}

export interface CaptureResponse {
  success: boolean;
  method?: 'CDP' | 'scroll';
  error?: string;
}

// 新增：前台操作消息类型（扩展区域截图）
export interface ContentScriptMessage {
  action: 'getPageDimensions' | 'analyzeScrollContainers' | 'scrollToTop' | 'scrollTo' | 'getPageAnalysis' | 'pageReady' | 
          'startRegionCapture' | 'finishRegionCapture' | 'cancelRegionCapture' | 'updateRegionCapture';
  data?: {
    targetY?: number;
    scrollInfo?: ScrollAnalysisResult;
    region?: RegionCaptureConfig;
    screenshot?: string;
  };
}

export interface ContentScriptResponse {
  success: boolean;
  data?: PageDimensions | ScrollAnalysisResult | { dimensions: PageDimensions; scrollInfo: ScrollAnalysisResult } | 
         { status: string } | RegionCaptureState | { screenshot: string };
  error?: string;
}

// 截图配置类型
export interface CaptureConfig {
  scrollStep: number;
  captureDelay: number;
}

// Chrome API 相关类型
export interface ChromeTab {
  id?: number;
  windowId?: number;
  title?: string;
  url?: string;
  status?: string;
}

export interface Debuggee {
  tabId: number;
} 
