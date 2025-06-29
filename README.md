# Better Chrome Screenshot

一个功能强大的 Chrome 扩展，用于截取网页截图。支持完整页面截图和可见区域截图。

## 功能特性

- 📄 **完整页面截图**：自动滚动并拼接整个网页内容
- 👁️ **可见区域截图**：快速截取当前可见的页面区域
- ⌨️ **快捷键支持**：Ctrl+Shift+S (Mac: Cmd+Shift+S)
- 🎯 **一键操作**：点击扩展图标即可使用
- 💾 **自动下载**：截图自动保存到下载文件夹
- 🌐 **支持所有网站**：适用于任何网页

## 安装和使用

### 开发环境设置

1. 克隆项目
```bash
git clone https://github.com/CryUshio/better-chrome-screenshot.git
cd better-chrome-screenshot
```

2. 安装依赖
```bash
npm install
# 或者使用 pnpm
pnpm install
```

3. 构建项目
```bash
npm run build
```

4. 在 Chrome 中加载扩展
   - 打开 Chrome 浏览器
   - 访问 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目的 `dist` 文件夹

### 使用方法

1. **完整页面截图**
   - 点击扩展图标，选择"截取完整页面"
   - 或使用快捷键 Ctrl+Shift+S (Mac: Cmd+Shift+S)
   - 扩展会自动滚动页面并拼接成完整截图

2. **可见区域截图**
   - 点击扩展图标，选择"截取可见区域"
   - 快速截取当前屏幕显示的内容

## 技术实现

### 核心 API 使用

- `chrome.tabs.captureVisibleTab()` - 截取可见标签页内容
- `chrome.scripting.executeScript()` - 注入脚本获取页面信息
- `chrome.downloads.download()` - 自动下载截图文件
- `chrome.commands.onCommand` - 处理快捷键命令

### 完整页面截图原理

1. 获取页面完整尺寸（包括滚动区域）
2. 计算需要的截图次数和滚动距离
3. 逐步滚动页面并截取每个视口
4. 使用 Canvas API 将多张截图拼接成完整图片
5. 自动下载最终的完整截图

### 项目结构

```
src/
├── background.ts      # 背景脚本 - 处理截图逻辑
├── popup.tsx         # 弹窗界面 - 用户交互界面
├── content_script.tsx # 内容脚本 - 页面支持功能
└── options.tsx       # 选项页面 - 扩展设置
```

## 开发命令

```bash
# 开发模式（监听文件变化）
npm run watch

# 生产构建
npm run build

# 清理构建文件
npm run clean

# 运行测试
npm run test

# 代码格式化
npm run style
```

## 技术栈

- **TypeScript** - 类型安全的 JavaScript
- **React** - 用户界面库
- **Webpack** - 模块打包工具
- **Chrome Extensions API** - 浏览器扩展接口

## 实验结论

### 传统滚动截图方法
1. **滚动截图优化**：在截图间隔中添加适当延迟可以确保页面内容完全加载
2. **图片拼接算法**：使用重叠区域可以避免内容丢失，提高拼接质量
3. **文件命名策略**：使用时间戳和页面标题组合，避免文件名冲突
4. **内存管理**：对于超长页面，分批处理截图可以避免内存溢出

### Chrome DevTools Protocol (CDP) 全页面截图
5. **CDP智能截图**：使用 `Page.captureScreenshot` 配合 `captureBeyondViewport: true` 可以直接截取完整页面
6. **性能优势**：CDP方法无需滚动和拼接，速度更快，避免了页面抖动和拼接错误
7. **权限要求**：需要添加 `debugger` 权限，用户可能对此有安全疑虑
8. **兼容性策略**：实现CDP优先 + 滚动截图fallback的策略，确保在各种情况下都能正常工作
9. **API稳定性**：CDP API更接近Chrome原生能力，但需要正确处理调试器连接的生命周期

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！
