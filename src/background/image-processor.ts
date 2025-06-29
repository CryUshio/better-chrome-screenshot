/**
 * Better Chrome Screenshot - 图片处理模块
 * 功能：图片合并、下载和相关处理
 * 作者：用户需求 - 重构此项目调用 chrome.scripting.executeScript 的部分，所有前台交互操作都要写在 content_script 中
 * 更新：修复 background script 中不能使用 document 的问题，改用 OffscreenCanvas 和 createImageBitmap
 * 设计原则：单一职责原则，专注于图片处理相关功能
 */

import { generateTimestampedFilename, Logger } from '../utils';

/**
 * 图片合并器 - 使用 OffscreenCanvas 在 background script 中运行
 */
export class ImageMerger {
  /**
   * 合并多个截图为一张完整图片
   */
  static async mergeScreenshots(
    screenshots: string[],
    width: number,
    totalHeight: number,
    viewportHeight: number,
    scrollStep: number,
    devicePixelRatio: number = 1 // 添加设备像素比参数
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      if (screenshots.length === 0) {
        reject(new Error('没有可合并的截图'));
        return;
      }

      Logger.info(`开始合并 ${screenshots.length} 张截图，设备像素比: ${devicePixelRatio}`);

      try {
        // 计算实际的画布尺寸（考虑设备像素比）
        const actualCanvasWidth = Math.round(width * devicePixelRatio);
        const actualCanvasHeight = Math.round(totalHeight * devicePixelRatio);
        
        Logger.info(`画布尺寸: 逻辑${width}x${totalHeight} -> 物理${actualCanvasWidth}x${actualCanvasHeight}`);

        // 使用 OffscreenCanvas 替代 document.createElement('canvas')
        const canvas = new OffscreenCanvas(actualCanvasWidth, actualCanvasHeight);
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('无法创建OffscreenCanvas上下文'));
          return;
        }

        // 将所有 data URL 转换为 ImageBitmap
        const imageBitmaps: ImageBitmap[] = [];
        
        for (let i = 0; i < screenshots.length; i++) {
          try {
            // 将 data URL 转换为 Blob
            const response = await fetch(screenshots[i]);
            const blob = await response.blob();
            
            // 使用 createImageBitmap 替代 new Image()
            const imageBitmap = await createImageBitmap(blob);
            imageBitmaps[i] = imageBitmap;
            
            // 记录每张图片的实际尺寸
            Logger.info(`第${i + 1}张图片尺寸: ${imageBitmap.width}x${imageBitmap.height}`);
          } catch (error) {
            reject(new Error(`加载第 ${i + 1} 张图片失败: ${error instanceof Error ? error.message : '未知错误'}`));
            return;
          }
        }

        // 所有图片加载完成，开始合并
        imageBitmaps.forEach((imageBitmap, i) => {
          const logicalY = i * scrollStep;
          const actualY = Math.round(logicalY * devicePixelRatio);
          const logicalDrawHeight = Math.min(viewportHeight, totalHeight - logicalY);
          const actualDrawHeight = Math.round(logicalDrawHeight * devicePixelRatio);
          
          // 使用图片的实际尺寸进行绘制
          const imageWidth = imageBitmap.width;
          const imageHeight = Math.min(actualDrawHeight, imageBitmap.height);
          
          ctx.drawImage(
            imageBitmap,
            0, 0, imageWidth, imageHeight,  // 源图片裁剪
            0, actualY, imageWidth, imageHeight   // 目标位置（使用图片原始宽度）
          );
          
          Logger.info(`绘制第${i + 1}张图片: 源(${imageWidth}x${imageHeight}) -> 目标(0,${actualY},${imageWidth}x${imageHeight})`);
          
          // 释放 ImageBitmap 资源
          imageBitmap.close();
        });
        
        Logger.info('图片合并完成');
        
        // 将 OffscreenCanvas 转换为 Blob，然后转换为 data URL
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const reader = new FileReader();
        
        reader.onload = () => {
          resolve(reader.result as string);
        };
        
        reader.onerror = () => {
          reject(new Error('转换合并图片为 data URL 失败'));
        };
        
        reader.readAsDataURL(blob);
        
      } catch (error) {
        Logger.error('图片合并失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 创建单色背景画布
   */
  static async createCanvas(width: number, height: number, backgroundColor = '#ffffff'): Promise<string> {
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d')!;
      
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
      
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('创建画布失败'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw new Error(`创建画布失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 调整图片尺寸
   */
  static async resizeImage(
    dataUrl: string, 
    maxWidth: number, 
    maxHeight: number, 
    quality = 0.9
  ): Promise<string> {
    try {
      // 将 data URL 转换为 Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // 创建 ImageBitmap
      const imageBitmap = await createImageBitmap(blob);
      
      // 计算缩放比例
      const scale = Math.min(maxWidth / imageBitmap.width, maxHeight / imageBitmap.height, 1);
      
      const canvas = new OffscreenCanvas(
        imageBitmap.width * scale, 
        imageBitmap.height * scale
      );
      const ctx = canvas.getContext('2d')!;
      
      // 启用图片平滑
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
      
      // 释放 ImageBitmap 资源
      imageBitmap.close();
      
      const resultBlob = await canvas.convertToBlob({ 
        type: 'image/png', 
        quality: quality 
      });
      
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('调整图片尺寸失败'));
        reader.readAsDataURL(resultBlob);
      });
      
    } catch (error) {
      throw new Error(`调整图片尺寸失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}

/**
 * 图片下载器
 */
export class ImageDownloader {
  /**
   * 下载图片
   */
  static async downloadImage(dataUrl: string, filename: string): Promise<void> {
    try {
      const finalFilename = generateTimestampedFilename(filename);

      await chrome.downloads.download({
        url: dataUrl,
        filename: finalFilename,
        saveAs: false
      });

      Logger.info(`图片下载成功: ${finalFilename}`);
    } catch (error) {
      Logger.error('图片下载失败:', error);
      throw new Error(`图片下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量下载图片
   */
  static async downloadImages(images: Array<{ dataUrl: string; filename: string }>): Promise<void> {
    const downloadPromises = images.map(({ dataUrl, filename }) => 
      this.downloadImage(dataUrl, filename)
    );

    try {
      await Promise.all(downloadPromises);
      Logger.info(`批量下载完成，共 ${images.length} 张图片`);
    } catch (error) {
      Logger.error('批量下载失败:', error);
      throw error;
    }
  }

  /**
   * 检查下载权限
   */
  static async checkDownloadPermission(): Promise<boolean> {
    try {
      // 尝试创建一个临时下载来检查权限
      const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const downloadId = await chrome.downloads.download({
        url: testDataUrl,
        filename: 'test_permission.png',
        saveAs: false
      });

      // 立即取消下载
      await chrome.downloads.cancel(downloadId);
      
      return true;
    } catch (error) {
      Logger.warn('下载权限检查失败:', error);
      return false;
    }
  }
}

/**
 * 图片处理器 - 主要对外接口
 */
export class ImageProcessor {
  /**
   * 处理并下载单张图片
   */
  static async processAndDownload(
    dataUrl: string, 
    filename: string,
    options?: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
    }
  ): Promise<void> {
    let processedDataUrl = dataUrl;

    // 如果指定了尺寸限制，先调整图片尺寸
    if (options?.maxWidth || options?.maxHeight) {
      const maxWidth = options.maxWidth || Number.MAX_SAFE_INTEGER;
      const maxHeight = options.maxHeight || Number.MAX_SAFE_INTEGER;
      const quality = options.quality || 0.9;

      processedDataUrl = await ImageMerger.resizeImage(
        dataUrl, 
        maxWidth, 
        maxHeight, 
        quality
      );
    }

    await ImageDownloader.downloadImage(processedDataUrl, filename);
  }

  /**
   * 合并截图并下载
   */
  static async mergeAndDownload(
    screenshots: string[],
    width: number,
    totalHeight: number,
    viewportHeight: number,
    scrollStep: number,
    filename: string,
    devicePixelRatio: number = 1 // 添加设备像素比参数
  ): Promise<void> {
    const mergedImage = await ImageMerger.mergeScreenshots(
      screenshots,
      width,
      totalHeight,
      viewportHeight,
      scrollStep,
      devicePixelRatio // 传递设备像素比
    );

    await ImageDownloader.downloadImage(mergedImage, filename);
  }

  /**
   * 验证图片数据URL格式
   */
  static isValidDataUrl(dataUrl: string): boolean {
    const dataUrlPattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
    return dataUrlPattern.test(dataUrl);
  }

  /**
   * 获取图片信息
   */
  static async getImageInfo(dataUrl: string): Promise<{
    width: number;
    height: number;
    size: number;
  }> {
    try {
      // 将 data URL 转换为 Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // 使用 createImageBitmap 获取图片信息
      const imageBitmap = await createImageBitmap(blob);
      
      // 估算文件大小（base64编码后的大小约为原文件的4/3）
      const base64Data = dataUrl.split(',')[1];
      const estimatedSize = Math.round((base64Data.length * 3) / 4);
      
      const result = {
        width: imageBitmap.width,
        height: imageBitmap.height,
        size: estimatedSize
      };
      
      // 释放 ImageBitmap 资源
      imageBitmap.close();
      
      return result;
    } catch (error) {
      throw new Error(`无法获取图片信息: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
} 
