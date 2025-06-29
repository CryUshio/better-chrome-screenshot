// Better Chrome Screenshot - 弹窗组件
// 功能：提供截图操作界面
// 新增：区域截图功能支持
// 重构：使用@heroicons/react图标库和现代化组件结构
// 优化：修复布局和样式问题

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { 
  RocketLaunchIcon,
  DocumentTextIcon,
  ScissorsIcon,
  EyeIcon,
  PaintBrushIcon,
  CheckIcon,
  XMarkIcon
} from "@heroicons/react/16/solid";
import "./styles/popup.css";

const Popup = () => {
  const [currentURL, setCurrentURL] = useState<string>();
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState<string>();

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      setCurrentURL(tabs[0].url);
    });
  }, []);

  // 截取全页面截图 - 使用CDP方法
  const captureFullPage = async () => {
    setIsCapturing(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        console.error('无法获取当前标签页');
        return;
      }

      chrome.runtime.sendMessage({ action: 'captureFullPage' }, (response) => {
        if (response && response.success) {
          setLastCaptureTime(new Date().toLocaleTimeString());
          console.log(`截图成功 - 使用方法: ${response.method || 'unknown'}`);
        } else {
          console.error('截图失败:', response?.error);
        }
      });

    } catch (error) {
      console.error('截图操作失败:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  // 截取全页面截图 - 使用滚动拼接方法
  const captureFullPageScroll = async () => {
    setIsCapturing(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        console.error('无法获取当前标签页');
        return;
      }

      chrome.runtime.sendMessage({ action: 'captureFullPageScroll' }, (response) => {
        if (response && response.success) {
          setLastCaptureTime(new Date().toLocaleTimeString());
          console.log('滚动截图成功');
        } else {
          console.error('滚动截图失败:', response?.error);
        }
      });

    } catch (error) {
      console.error('滚动截图操作失败:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  // 截取可见区域
  const captureVisible = async () => {
    setIsCapturing(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.windowId) {
        console.error('无法获取当前标签页');
        return;
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      
      // 下载图片
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `visible-screenshot_${timestamp}.png`;
      
      await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: false
      });

      setLastCaptureTime(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('可见区域截图失败:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  // 新增：区域截图功能
  const captureRegion = async () => {
    setIsCapturing(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        console.error('无法获取当前标签页');
        return;
      }

      // 向 content script 发送开始区域截图的消息
      chrome.tabs.sendMessage(tab.id, { action: 'startRegionCapture' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('发送区域截图消息失败:', chrome.runtime.lastError.message);
          setIsCapturing(false);
          return;
        }

        if (response && response.success) {
          setLastCaptureTime(new Date().toLocaleTimeString());
          console.log('区域截图已启动');
          // 关闭popup，让用户在页面上进行操作
          window.close();
        } else {
          console.error('启动区域截图失败:', response?.error);
          setIsCapturing(false);
        }
      });

    } catch (error) {
      console.error('区域截图操作失败:', error);
      setIsCapturing(false);
    }
  };

  // 创建按钮组件
  const CaptureButton = ({ 
    onClick, 
    icon: Icon, 
    children, 
    variant = 'primary',
    disabled = false 
  }: {
    onClick: () => void;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'warning' | 'success';
    disabled?: boolean;
  }) => {
    const baseClasses = `
      w-full flex items-center justify-center gap-3 px-4 py-3.5 font-medium text-sm
      rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
      border border-transparent shadow-sm
    `;

    const variantClasses = {
      primary: disabled 
        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
        : 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500 active:bg-blue-700',
      secondary: disabled 
        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
        : 'bg-purple-500 text-white hover:bg-purple-600 focus:ring-purple-500 active:bg-purple-700',
      warning: disabled 
        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
        : 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500 active:bg-amber-700',
      success: disabled 
        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
        : 'bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500 active:bg-emerald-700'
    };

    const hoverEffect = !disabled ? 'transform hover:scale-105 active:scale-95' : '';

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${baseClasses} ${variantClasses[variant]} ${hoverEffect}`}
        style={{
          minHeight: '48px',
          fontSize: '14px',
          fontWeight: '500',
          color: disabled ? '#9ca3af' : '#ffffff'
        }}
      >
        <div className="icon-container">
          <Icon className="icon-16" />
        </div>
        <span className="text-center leading-tight" style={{ color: 'inherit' }}>{children}</span>
      </button>
    );
  };

  return (
    <div 
      className="w-full bg-white font-sans"
      style={{
        margin: 0,
        padding: 0,
        minWidth: '340px',
        width: '340px',
        minHeight: '420px',
        maxHeight: '600px'
      }}
    >
      {/* 顶部容器 */}
      <div className="p-5">
        {/* 标题 */}
        <div className="text-lg font-semibold text-gray-900 mb-4 text-center border-b border-gray-100 pb-3">
          <div className="flex items-center justify-center gap-2">
            <span>Better Chrome Screenshot</span>
          </div>
        </div>

        {/* 截图按钮组 */}
        <div className="space-y-4 mb-4">
          <CaptureButton
            onClick={captureFullPage}
            icon={RocketLaunchIcon}
            variant="primary"
            disabled={isCapturing}
          >
            {isCapturing ? "截图中..." : "智能完整页面截图"}
          </CaptureButton>

          <CaptureButton
            onClick={captureFullPageScroll}
            icon={DocumentTextIcon}
            variant="secondary"
            disabled={isCapturing}
          >
            {isCapturing ? "截图中..." : "传统滚动截图"}
          </CaptureButton>

          <CaptureButton
            onClick={captureRegion}
            icon={ScissorsIcon}
            variant="warning"
            disabled={isCapturing}
          >
            {isCapturing ? "启动中..." : "区域截图与编辑"}
          </CaptureButton>

          <CaptureButton
            onClick={captureVisible}
            icon={EyeIcon}
            variant="success"
            disabled={isCapturing}
          >
            {isCapturing ? "截图中..." : "截取可见区域"}
          </CaptureButton>
        </div>

        {/* 方法说明 */}
        <div 
          className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600 mb-3"
          style={{ fontSize: '11px', lineHeight: '1.4' }}
        >
          <div className="font-medium mb-2 text-gray-700 flex items-center gap-1">
            <span className="text-blue-500">📌</span>
            <span>截图方法说明</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-start gap-1">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>智能截图: 使用Chrome内核API，速度快，质量高</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>区域截图: 选择任意区域，支持编辑功能</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>传统截图: 滚动拼接方式，兼容性好</span>
            </div>
          </div>
        </div>

        {/* 快捷键提示 */}
        <div 
          className="text-xs text-gray-400 text-center py-2 border-t border-gray-100"
          style={{ fontSize: '11px' }}
        >
          <div className="flex items-center justify-center gap-1">
            <span>⌘</span>
            <span>快捷键: Ctrl+Shift+S (Mac: Cmd+Shift+S)</span>
          </div>
        </div>

        {/* 最后截图时间 */}
        {lastCaptureTime && (
          <div 
            className="mt-2 text-xs text-green-600 text-center bg-green-50 rounded px-2 py-1"
            style={{ fontSize: '11px' }}
          >
            <div className="flex items-center justify-center gap-1">
              <div className="icon-container-small">
                <CheckIcon className="icon-12" />
              </div>
              <span>最后截图: {lastCaptureTime}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 为Chrome扩展添加样式重置
const PopupWithStyles = () => {
  useEffect(() => {
    // 确保body样式正确
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    document.body.style.fontSize = '14px';
    document.body.style.lineHeight = '1.5';
    document.body.style.backgroundColor = '#ffffff';
    document.body.style.color = '#111827';
    
    // 设置根元素样式
    const root = document.getElementById('root');
    if (root) {
      root.style.margin = '0';
      root.style.padding = '0';
      root.style.width = '340px';
      root.style.minHeight = '420px';
    }
  }, []);

  return <Popup />;
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <PopupWithStyles />
  </React.StrictMode>
);
