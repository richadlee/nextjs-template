import React, { useRef, useEffect, useState, forwardRef } from 'react';
import styles from './MaskEditor.module.css';

interface MaskEditorRef {
  generateMask: () => string | null;
}

interface MaskEditorProps {
  imageUrl: string;
  onChange: (maskBase64: string) => void;
  onDrawStart?: () => void;
}

const BRUSH_COLORS = [
  { name: 'Red', value: '#FF0000' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Green', value: '#00FF00' },
  { name: 'Purple', value: '#800080' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
];

export const MaskEditor = forwardRef<MaskEditorRef, MaskEditorProps>(
  ({ imageUrl, onChange, onDrawStart }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseLayerRef = useRef<HTMLCanvasElement>(null);    // 底层：原图（固定）
  const colorLayerRef = useRef<HTMLCanvasElement>(null);   // 中间层：半透明颜色
  const topLayerRef = useRef<HTMLCanvasElement>(null);     // 顶层：原图（会被擦除）
  
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastStateRef = useRef<ImageData | null>(null);
  const [brushSize, setBrushSize] = useState(35);  // 默认笔刷大小改为25
  const [opacity, setOpacity] = useState(0.6);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [brushColor, setBrushColor] = useState(BRUSH_COLORS[4].value);

  // Expose generateMask method through ref
  useEffect(() => {
    if (!ref) return;
    
    if (typeof ref === 'function') {
      ref({ generateMask });
    } else {
      ref.current = { generateMask };
    }
  }, [ref]);

  // 初始化图层
  useEffect(() => {
    if (!imageUrl) return;
    
    const image = new Image();
    image.src = imageUrl;
    image.onload = () => {
      if (!containerRef.current) return;

      // 计算适当的画布尺寸
      const maxWidth = 800; // 最大宽度
      const containerWidth = Math.min(maxWidth, window.innerWidth - 32); // 考虑padding
      const scale = containerWidth / image.width;
      const canvasWidth = containerWidth;
      const canvasHeight = image.height * scale;
      
      // 设置所有画布的尺寸
      [baseLayerRef, colorLayerRef, topLayerRef].forEach(ref => {
        if (!ref.current) return;
        ref.current.width = canvasWidth;
        ref.current.height = canvasHeight;
        
        const ctx = ref.current.getContext('2d');
        if (!ctx) return;

        // 设置图像平滑
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (ref === baseLayerRef || ref === topLayerRef) {
          ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
        }
      });

      // 初始化颜色层
      const colorCtx = colorLayerRef.current?.getContext('2d');
      if (colorCtx) {
        colorCtx.fillStyle = brushColor;
        colorCtx.globalAlpha = opacity;
        colorCtx.fillRect(0, 0, canvasWidth, canvasHeight);
      }

      // 设置容器高度
      const canvasContainer = containerRef.current.querySelector(`.${styles.canvasContainer}`);
      if (canvasContainer instanceof HTMLElement) {
        canvasContainer.style.height = `${canvasHeight}px`;
      }
    };
  }, [imageUrl]);

  // 更新颜色层
  useEffect(() => {
    if (!colorLayerRef.current || !topLayerRef.current) return;
    const colorCtx = colorLayerRef.current.getContext('2d');
    const topCtx = topLayerRef.current.getContext('2d');
    if (!colorCtx || !topCtx) return;

    // 保存当前的擦除状态
    const currentState = topCtx.getImageData(0, 0, topCtx.canvas.width, topCtx.canvas.height);

    // 更新颜色层
    colorCtx.clearRect(0, 0, colorCtx.canvas.width, colorCtx.canvas.height);
    colorCtx.fillStyle = brushColor;
    colorCtx.globalAlpha = opacity;
    colorCtx.fillRect(0, 0, colorCtx.canvas.width, colorCtx.canvas.height);

    // 恢复擦除状态
    topCtx.putImageData(currentState, 0, 0);
  }, [brushColor, opacity]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!topLayerRef.current) return null;
    const canvas = topLayerRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: x * scaleX,
      y: y * scaleY
    };
  };

  const generateMask = () => {
    if (!topLayerRef.current) return null;
    const ctx = topLayerRef.current.getContext('2d');
    if (!ctx) return null;

    // 创建临时画布生成黑白蒙版
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = topLayerRef.current.width;
    tempCanvas.height = topLayerRef.current.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;

    // 复制顶层的透明度信息
    tempCtx.drawImage(topLayerRef.current, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    
    // 转换为黑白蒙版：擦除的区域（透明）变为白色，未擦除的区域变为黑色
    for (let i = 0; i < imageData.data.length; i += 4) {
      // 检查像素的 alpha 值
      const alpha = imageData.data[i + 3];
      if (alpha < 128) { // 如果是透明的（擦除区域）
        // 设置为白色
        imageData.data[i] = 255;     // R
        imageData.data[i + 1] = 255; // G
        imageData.data[i + 2] = 255; // B
        imageData.data[i + 3] = 255; // A
      } else { // 如果不是透明的（未擦除的区域）
        // 设置为黑色
        imageData.data[i] = 0;       // R
        imageData.data[i + 1] = 0;   // G
        imageData.data[i + 2] = 0;   // B
        imageData.data[i + 3] = 255; // A
      }
    }
    tempCtx.putImageData(imageData, 0, 0);

    // 生成 base64
    return tempCanvas.toDataURL();
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (showMask) return;
    setIsDrawing(true);
    onDrawStart?.();
    const point = getCoordinates(e);
    if (point) {
      lastPointRef.current = point;
      const ctx = topLayerRef.current?.getContext('2d');
      if (ctx) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // 生成并更新 mask
        const mask = generateMask();
        if (mask) {
          onChange(mask);
        }
      }
    }
  };

  const stopDrawing = () => {
    if (showMask) return; // 在预览模式下禁止绘制
    setIsDrawing(false);
    lastPointRef.current = null;
    if (showMask) {
      updateMaskPreview();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPointRef.current || showMask) return;
    
    const newPoint = getCoordinates(e);
    if (!newPoint || !topLayerRef.current) return;

    const ctx = topLayerRef.current.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(newPoint.x, newPoint.y);
    ctx.stroke();

    lastPointRef.current = newPoint;

    // 生成并更新 mask
    const mask = generateMask();
    if (mask) {
      onChange(mask);
    }
  };

  const updateMaskPreview = () => {
    if (!topLayerRef.current) return;
    const ctx = topLayerRef.current.getContext('2d');
    if (!ctx) return;

    const mask = generateMask();
    if (!mask) return;

    // 显示黑白蒙版
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const tempImage = new Image();
    tempImage.onload = () => {
      ctx.drawImage(tempImage, 0, 0);
    };
    tempImage.src = mask;
  };

  const toggleMaskPreview = () => {
    const newShowMask = !showMask;
    setShowMask(newShowMask);

    if (!topLayerRef.current || !baseLayerRef.current) return;
    const ctx = topLayerRef.current.getContext('2d');
    if (!ctx) return;

    if (newShowMask) {
      // Save current state before showing mask preview
      lastStateRef.current = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      // 切换到蒙版预览模式
      updateMaskPreview();
    } else {
      // 恢复到编辑模式
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(baseLayerRef.current, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      
      // Restore the previous drawing state
      if (lastStateRef.current) {
        ctx.putImageData(lastStateRef.current, 0, 0);
      }
    }
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.canvasContainer}>
        <canvas ref={baseLayerRef} className={styles.canvas} />
        <canvas ref={colorLayerRef} className={styles.canvas} style={{ display: showMask ? 'none' : 'block' }} />
        <canvas
          ref={topLayerRef}
          className={styles.canvas}
          style={{ cursor: showMask ? 'default' : 'crosshair' }}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
        />
      </div>
      <div className={styles.controls}>
        <div>
          <label>Brush Size: {brushSize}</label>
          <input
            type="range"
            min="1"
            max="150"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
        </div>
        <div>
          <label>Opacity: {Math.round(opacity * 100)}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={opacity * 100}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
          />
        </div>
        <div className={styles.colorPicker}>
          {BRUSH_COLORS.map((color) => (
            <button
              key={color.value}
              className={`${styles.colorButton} ${brushColor === color.value ? styles.active : ''}`}
              style={{ backgroundColor: color.value }}
              onClick={() => setBrushColor(color.value)}
              title={color.name}
            />
          ))}
        </div>
        <div className={styles.buttonGroup}>
          <button onClick={toggleMaskPreview}>
            {showMask ? '🎨 Edit Mode' : '👁️ Show Mask'}
          </button>
          <button onClick={() => {
            if (!topLayerRef.current || !baseLayerRef.current) return;
            const ctx = topLayerRef.current.getContext('2d');
            if (!ctx) return;

            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.drawImage(baseLayerRef.current, 0, 0);
            ctx.globalCompositeOperation = 'destination-out';

            lastStateRef.current = null;

            if (showMask) {
              updateMaskPreview();
            }

            // 清空时传入空字符串
            onChange('');
          }}>
            🗑️ Clear
          </button>
        </div>
      </div>
    </div>
  );
});

MaskEditor.displayName = 'MaskEditor';