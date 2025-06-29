// Better Chrome Screenshot - 选项页面
// 功能：提供扩展设置界面
// 重构：使用@headlessui/react组件库和现代化UI设计
// 优化：修复布局和样式问题

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Switch } from "@headlessui/react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import "./styles/options.css";

const Options = () => {
  const [color, setColor] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [like, setLike] = useState<boolean>(false);

  useEffect(() => {
    // Restores select box and checkbox state using the preferences
    // stored in chrome.storage.
    chrome.storage.sync.get(
      {
        favoriteColor: "red",
        likesColor: true,
      },
      (items) => {
        setColor(items.favoriteColor);
        setLike(items.likesColor);
      }
    );
  }, []);

  const saveOptions = () => {
    // Saves options to chrome.storage.sync.
    chrome.storage.sync.set(
      {
        favoriteColor: color,
        likesColor: like,
      },
      () => {
        // Update status to let user know options were saved.
        setStatus("设置已保存");
        const id = setTimeout(() => {
          setStatus("");
        }, 2000);
        return () => clearTimeout(id);
      }
    );
  };

  const colorOptions = [
    { value: "red", label: "红色", color: "bg-red-500" },
    { value: "green", label: "绿色", color: "bg-green-500" },
    { value: "blue", label: "蓝色", color: "bg-blue-500" },
    { value: "yellow", label: "黄色", color: "bg-yellow-500" },
  ];

  const selectedColorOption = colorOptions.find(option => option.value === color);

  return (
    <div 
      className="min-h-screen bg-gray-50"
      style={{
        margin: 0,
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <div className="max-w-2xl mx-auto options-card">
        {/* 标题区域 */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">S</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Better Chrome Screenshot
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                配置您的截图扩展偏好设置
              </p>
            </div>
          </div>
        </div>

        {/* 设置内容区域 */}
        <div className="p-6">
          {/* 设置项 */}
          <div className="space-y-6">
            {/* 颜色选择 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                偏好颜色
              </label>
              <div className="relative">
                <select
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="
                    appearance-none w-full bg-white border border-gray-300 rounded-lg px-4 py-3 pr-10
                    text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    transition-all duration-200 shadow-sm hover:border-gray-400
                  "
                  style={{
                    minHeight: '44px',
                    fontSize: '14px'
                  }}
                >
                  {colorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
              {selectedColorOption && (
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  <div className={`w-4 h-4 rounded-full ${selectedColorOption.color} shadow-sm`}></div>
                  <span>当前选择: {selectedColorOption.label}</span>
                </div>
              )}
            </div>

            {/* 开关设置 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                界面偏好
              </label>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    启用彩色界面
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    启用此选项以显示彩色界面元素和图标
                  </div>
                </div>
                <Switch
                  checked={like}
                  onChange={setLike}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    ${like ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm
                      ${like ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </Switch>
              </div>
            </div>
          </div>

          {/* 保存按钮区域 */}
          <div className="mt-8 flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              onClick={saveOptions}
              className="
                flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg
                hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm
              "
              style={{
                minHeight: '44px',
                fontSize: '14px'
              }}
            >
              <CheckIcon className="w-5 h-5" />
              <span>保存设置</span>
            </button>

            {/* 状态提示 */}
            {status && (
              <div className="flex items-center gap-2 text-green-600 font-medium bg-green-50 px-3 py-2 rounded-lg border border-green-200 animate-pulse">
                <CheckIcon className="w-5 h-5" />
                <span className="text-sm">{status}</span>
              </div>
            )}
          </div>

          {/* 功能说明 */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-2">功能说明</div>
                <div className="space-y-1 text-xs">
                  <div>• 偏好颜色：影响截图工具的主题配色</div>
                  <div>• 彩色界面：控制是否显示彩色的按钮和图标</div>
                  <div>• 设置更改后将立即生效，无需重启扩展</div>
                </div>
              </div>
            </div>
          </div>

          {/* 版本信息 */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <div className="text-xs text-gray-400">
              Better Chrome Screenshot v1.0.0
            </div>
            <div className="text-xs text-gray-400 mt-1">
              © 2024 - 高质量截图工具
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 为Chrome扩展添加样式重置
const OptionsWithStyles = () => {
  useEffect(() => {
    // 确保body样式正确
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    document.body.style.fontSize = '14px';
    document.body.style.lineHeight = '1.5';
    document.body.style.backgroundColor = '#f9fafb';
    document.body.style.color = '#111827';
    
    // 设置根元素样式
    const root = document.getElementById('root');
    if (root) {
      root.style.margin = '0';
      root.style.padding = '0';
      root.style.minHeight = '100vh';
    }
  }, []);

  return <Options />;
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <OptionsWithStyles />
  </React.StrictMode>
);
