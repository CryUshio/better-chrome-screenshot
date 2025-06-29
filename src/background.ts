/**
 * ⚠️ 此文件已被重构，不再使用！
 * 
 * 这是旧版本的背景脚本，已经被重构为模块化结构。
 * 新的背景脚本入口：src/background/index.ts
 * 
 * 重构原因：
 * - 移除所有 chrome.scripting.executeScript 调用
 * - 将前台交互操作迁移到 content_script 中
 * - 采用更好的模块化架构
 * 
 * 此文件保留仅作参考，webpack 不再使用此文件。
 * 实际使用的入口文件：src/background/index.ts
 */

// Better Chrome Screenshot - 背景脚本
// 功能：处理截图命令、全页面截图、文件下载
// 新增：使用Chrome DevTools Protocol (CDP) 直接截取全页面
// 工具函数：获取垂直滚动容器的高度，处理复杂滚动场景
// 修复：增加截图API速率限制，避免触发MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND配额错误

// 监听扩展命令
chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-full-screenshot") {
    // 优先使用CDP方法，如果失败则fallback到滚动方法
    captureFullPageWithCDP().catch(() => {
      console.log('CDP截图失败，回退到滚动截图方法');
      captureFullPageScreenshot();
    });
  }
});

// 监听来自弹窗的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureFullPage') {
    // 优先使用CDP方法
    captureFullPageWithCDP()
      .then(() => {
        sendResponse({ success: true, method: 'CDP' });
      })
      .catch((error) => {
        console.log('CDP截图失败，回退到滚动截图方法:', error.message);
        // 回退到原有的滚动截图方法
        return captureFullPageScreenshot();
      })
      .then(() => {
        sendResponse({ success: true, method: 'scroll' });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开放以支持异步响应
  }

  if (request.action === 'captureFullPageScroll') {
    // 直接使用传统滚动截图方法
    captureFullPageScreenshot()
      .then(() => {
        sendResponse({ success: true, method: 'scroll' });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开放以支持异步响应
  }
});

// 新增：获取页面中所有垂直滚动容器的信息
function getScrollContainersInfo() {
  interface ScrollContainer {
    element: Element;
    scrollHeight: number;
    clientHeight: number;
    scrollable: boolean;
  }
  
  const scrollContainers: ScrollContainer[] = [];

  // 高性能查找滚动容器
  function findScrollContainers(element: Element) {
    const computedStyle = window.getComputedStyle(element);
    const overflowY = computedStyle.overflowY;
    const overflowX = computedStyle.overflowX;
    
    // 检查是否为垂直滚动容器
    const isVerticalScrollable = 
      (overflowY === 'scroll' || overflowY === 'auto' || overflowY === 'overlay') &&
      element.scrollHeight > element.clientHeight;

    if (isVerticalScrollable) {
      scrollContainers.push({
        element,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollable: true
      });
    }

    // 递归遍历子元素（只遍历块级元素）
    const children = Array.from(element.children).filter((c) => ['html', 'body', 'div', 'p', 'textarea', 'form', 'table', 'tbody', 'thead', 'tfoot', 'ul', 'ol', 'li', 'section', 'main', 'header', 'article'].includes(c.tagName.toLowerCase()));
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childStyle = window.getComputedStyle(child);
      
      // 跳过隐藏元素以提高性能
      if (childStyle.display === 'none' || 
          childStyle.visibility === 'hidden') {
        continue;
      }
      
      findScrollContainers(child);
    }
  }

  // 从document.documentElement开始查找
  findScrollContainers(document.documentElement);

  // 同时包含body作为备选
  if (document.body && document.body.scrollHeight > document.body.clientHeight) {
    scrollContainers.push({
      element: document.body,
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.body.clientHeight,
      scrollable: true
    });
  }

  // 包含documentElement作为备选
  if (document.documentElement.scrollHeight > document.documentElement.clientHeight) {
    scrollContainers.push({
      element: document.documentElement,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollable: true
    });
  }

  // 计算每个滚动容器的增量高度
  let maxIncrementalHeight = 0;
  let bestContainer: ScrollContainer | undefined;

  scrollContainers.forEach((container: ScrollContainer) => {
    const incrementalHeight = container.scrollHeight - container.clientHeight;
    if (incrementalHeight > maxIncrementalHeight) {
      maxIncrementalHeight = incrementalHeight;
      bestContainer = container;
    }
  });

  return {
    scrollContainers,
    maxIncrementalHeight,
    bestContainer: bestContainer ? {
      tagName: bestContainer.element.tagName,
      className: bestContainer.element.className,
      scrollHeight: bestContainer.scrollHeight,
      clientHeight: bestContainer.clientHeight
    } : null
  };
}

// 新增：使用Chrome DevTools Protocol截取全页面截图
async function captureFullPageWithCDP() {
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      throw new Error('无法获取当前标签页');
    }

    // 检查调试权限
    if (!chrome.debugger) {
      throw new Error('未授权debugger权限');
    }

    const debuggee = { tabId: tab.id };
    const version = "1.3";

    try {
      // 连接到调试器
      await chrome.debugger.attach(debuggee, version);
      console.log('已连接到Chrome DevTools Protocol');

      // 启用必要的域
      await chrome.debugger.sendCommand(debuggee, "Page.enable");
      await chrome.debugger.sendCommand(debuggee, "Runtime.enable");
      await chrome.debugger.sendCommand(debuggee, "DOM.enable");

      // 获取页面布局信息
      const layoutMetrics = await chrome.debugger.sendCommand(debuggee, "Page.getLayoutMetrics") as unknown as {
        layoutViewport: { clientWidth: number; clientHeight: number };
        contentSize: { width: number; height: number };
        cssContentSize: { width: number; height: number };
      };
      
      console.log('页面布局信息:', layoutMetrics);

      // 注入脚本获取滚动容器信息
      const scrollInfoResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getScrollContainersInfo,
      });

      const scrollInfo = scrollInfoResults[0]?.result;
      console.log('滚动容器信息:', scrollInfo);

      // 计算实际需要的视口高度
      let targetHeight = layoutMetrics.cssContentSize.height;
      
      if (scrollInfo && scrollInfo.maxIncrementalHeight > 0) {
        // 使用滚动容器的增量高度
        targetHeight = layoutMetrics.cssContentSize.height + scrollInfo.maxIncrementalHeight;
        console.log(`检测到滚动容器，增量高度: ${scrollInfo.maxIncrementalHeight}px`);
        console.log(`最佳滚动容器:`, scrollInfo.bestContainer);
      }

      // 设置视口以确保能捕获完整内容
      if (layoutMetrics.cssContentSize) {
        const { width } = layoutMetrics.cssContentSize;
        console.log(`设置视口大小: ${width}x${targetHeight}`);
        const scaleFactor = layoutMetrics.contentSize.width / layoutMetrics.cssContentSize.width;
        
        await chrome.debugger.sendCommand(debuggee, "Emulation.setDeviceMetricsOverride", {
          width: width,
          height: targetHeight, // 使用我们计算的目标高度
          deviceScaleFactor: scaleFactor,
          mobile: false
        });
      }

      // 强制触发页面重排和重绘
      await chrome.debugger.sendCommand(debuggee, "Runtime.evaluate", {
        expression: `
          // 强制重排
          document.body.offsetHeight;
          // 滚动到顶部确保从正确位置开始
          window.scrollTo(0, 0);
          // 触发重绘
          true;
        `
      });

      // 再次等待确保重排完成
      await new Promise(resolve => setTimeout(resolve, 300));

      // 使用CDP直接截取完整页面
      console.log('开始CDP截图...');
      const result = await chrome.debugger.sendCommand(debuggee, "Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,  // 关键参数：截取超出视口的内容
        optimizeForSpeed: false,      // 优化质量而非速度
        fromSurface: true            // 从渲染表面截图，确保获取完整内容
      }) as unknown as { data: string };

      // 构造完整的data URL
      const dataUrl = `data:image/png;base64,${result.data}`;
      
      // 下载图片
      await downloadImage(dataUrl, tab.title || 'full-page-screenshot-cdp');
      
      console.log('CDP全页面截图成功完成');

    } finally {
      // 确保断开调试器连接
      try {
        await chrome.debugger.detach(debuggee);
        console.log('已断开Chrome DevTools Protocol连接');
      } catch (detachError) {
        console.warn('断开调试器连接时出错:', detachError);
      }
    }

  } catch (error) {
    console.error('CDP截图失败:', error);
    throw error;
  }
}

// 截取全页面截图的主要函数
async function captureFullPageScreenshot() {
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      console.error('无法获取当前标签页');
      return;
    }

    // 注入脚本获取滚动容器信息
    const scrollInfoResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getScrollContainersInfo,
    });

    // 注入脚本获取页面完整尺寸
    const dimensionsResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getPageDimensions,
    });

    if (!dimensionsResults || !dimensionsResults[0] || !dimensionsResults[0].result) {
      console.error('无法获取页面尺寸');
      return;
    }

    const scrollInfo = scrollInfoResults[0]?.result;
    const { totalWidth, totalHeight, viewportWidth, viewportHeight } = dimensionsResults[0].result;

    console.log('滚动容器信息:', scrollInfo);
    console.log('页面尺寸信息:', { totalWidth, totalHeight, viewportWidth, viewportHeight });

    // 计算实际需要截图的高度
    let actualHeight = totalHeight;
    
    if (scrollInfo && scrollInfo.maxIncrementalHeight > 0) {
      // 如果有滚动容器，使用滚动容器的实际内容高度
      actualHeight = Math.max(totalHeight, viewportHeight + scrollInfo.maxIncrementalHeight);
      console.log(`检测到滚动容器，调整截图高度: ${actualHeight}px (增量: ${scrollInfo.maxIncrementalHeight}px)`);
      console.log(`最佳滚动容器:`, scrollInfo.bestContainer);
    }

    // 如果页面高度小于等于视口高度，直接截图
    if (actualHeight <= viewportHeight) {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      await downloadImage(dataUrl, tab.title || 'screenshot');
      return;
    }

    // 需要滚动截图的情况，使用调整后的高度
    await captureScrollingScreenshot(tab.id, totalWidth, actualHeight, viewportWidth, viewportHeight, scrollInfo);

  } catch (error) {
    console.error('截图失败:', error);
  }
}

// 获取页面尺寸的函数（在页面中执行）
function getPageDimensions() {
  const devicePixelRatio = window.devicePixelRatio || 1;
  
  return {
    totalWidth: Math.max(
      document.body.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
      document.documentElement.offsetWidth
    ),
    totalHeight: Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    ),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    devicePixelRatio: devicePixelRatio // 添加设备像素比
  };
}

// 滚动截图功能
async function captureScrollingScreenshot(tabId: number, totalWidth: number, totalHeight: number, viewportWidth: number, viewportHeight: number, scrollInfo?: any) {
  const screenshots: string[] = [];
  const scrollStep = viewportHeight - 100; // 留一些重叠以确保连续性
  const CAPTURE_DELAY = 800; // 每次截图之间的延迟（毫秒），避免触发配额限制
  
  // 如果有滚动容器信息，输出调试信息
  if (scrollInfo && scrollInfo.bestContainer) {
    console.log(`使用滚动容器进行截图: ${scrollInfo.bestContainer.tagName}`, scrollInfo.bestContainer);
  }
  
  // 先滚动到顶部，同时处理滚动容器
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (scrollInfo) => {
      // 滚动主窗口到顶部
      window.scrollTo(0, 0);
      
      // 如果有滚动容器，也将其滚动到顶部
      if (scrollInfo && scrollInfo.bestContainer) {
        const containers = document.querySelectorAll(scrollInfo.bestContainer.tagName);
        for (const container of containers) {
          if (container.className === scrollInfo.bestContainer.className) {
            container.scrollTop = 0;
            break;
          }
        }
      }
    },
    args: [scrollInfo]
  });

  // 等待页面稳定
  await new Promise(resolve => setTimeout(resolve, 500));

  let currentY = 0;
  let screenshotIndex = 0;
  
  while (currentY < totalHeight) {
    try {
      console.log(`正在截取第 ${screenshotIndex + 1} 张图片，位置: ${currentY}px`);
      
      // 截取当前视口
      const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
      screenshots.push(dataUrl);
      
      console.log(`成功截取第 ${screenshotIndex + 1} 张图片`);
    } catch (error: any) {
      console.error(`截图失败:`, error.message);
      throw error;
    }

    screenshotIndex++;
    currentY += scrollStep;
    
    // 滚动到下一个位置
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (y, scrollInfo) => {
        // 滚动主窗口
        window.scrollTo(0, y);
        
        // 如果有滚动容器，也滚动它
        if (scrollInfo && scrollInfo.bestContainer) {
          const containers = document.querySelectorAll(scrollInfo.bestContainer.tagName);
          for (const container of containers) {
            if (container.className === scrollInfo.bestContainer.className) {
              container.scrollTop = y;
              break;
            }
          }
        }
      },
      args: [currentY, scrollInfo]
    });

    // 等待页面稳定
    await new Promise(resolve => setTimeout(resolve, CAPTURE_DELAY));
  }

  // 合并所有截图
  return screenshots;
}

// 合并多个截图为一张完整图片
async function mergeScreenshots(screenshots: string[], width: number, totalHeight: number, viewportHeight: number, scrollStep: number): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = width;
    canvas.height = totalHeight;

    let loadedCount = 0;
    const images: HTMLImageElement[] = [];

    screenshots.forEach((dataUrl, index) => {
      const img = new Image();
      img.onload = () => {
        images[index] = img;
        loadedCount++;
        
        if (loadedCount === screenshots.length) {
          // 所有图片加载完成，开始合并
          images.forEach((img, i) => {
            const y = i * scrollStep;
            const drawHeight = Math.min(viewportHeight, totalHeight - y);
            
            ctx.drawImage(
              img,
              0, 0, width, drawHeight,  // 源图片裁剪
              0, y, width, drawHeight   // 目标位置
            );
          });
          
          resolve(canvas.toDataURL('image/png'));
        }
      };
      img.src = dataUrl;
    });
  });
}

// 下载图片
async function downloadImage(dataUrl: string, filename: string) {
  const cleanFilename = filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalFilename = `${cleanFilename}_${timestamp}.png`;

  await chrome.downloads.download({
    url: dataUrl,
    filename: finalFilename,
    saveAs: false
  });
}

// 保持原有的轮询功能（如果需要的话）
function polling() {
  // console.log("polling");
  setTimeout(polling, 1000 * 30);
}

polling();
