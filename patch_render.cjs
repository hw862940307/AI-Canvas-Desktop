const fs = require('fs');
let code = fs.readFileSync('src/components/AIPsEngineNode.tsx', 'utf8');

const regex = /\/\/ Realtime interactive resolution toggle[\s\S]*?\/\/ 3\. Render separate Layer Styles\/Effects/m;

const replacement = `      // 1. Calculate Cache Hash
      const baseCanvasVersion = layerCanvasCache[layer.id] ? (layerCanvasCache[layer.id].getAttribute('data-version') || '0') : '0';
      const hash = JSON.stringify(layer.adjustments) + '_' 
        + layer.width + '_' + layer.height + '_' 
        + layer.type + '_' + layer.imageUrl + '_' 
        + layer.color + '_' + layer.text + '_' + textVal + '_'
        + layer.vectorType + '_' + shapeFillColor + '_' + shapeStrokeColor + '_' + shapeStrokeWidth + '_'
        + baseCanvasVersion + '_'
        + (layer.liquifyMesh ? JSON.stringify(layer.liquifyMesh.points.map(p => p.x+','+p.y)) : 'no_mesh') + '_'
        + layer.hasMask;

      let layerBuffer;

      // 2. Try Cache
      if (adjustedLayerCacheRef.current[layer.id] && adjustedLayerCacheRef.current[layer.id].hash === hash) {
        layerBuffer = adjustedLayerCacheRef.current[layer.id].canvas;
      } else {
        // 3. Rebuild and Cache Layer Raster
        layerBuffer = document.createElement('canvas');
        layerBuffer.width = Math.max(1, layer.width);
        layerBuffer.height = Math.max(1, layer.height);
        const bCtx = layerBuffer.getContext('2d');
        if (!bCtx) return;

        // Draw Base Content
        if (layerCanvasCache[layer.id]) {
          if (layer.liquifyMesh) {
            renderLiquifyMeshWarp(bCtx, layerCanvasCache[layer.id], layer.liquifyMesh, Math.max(1, layer.width), Math.max(1, layer.height));
          } else {
            bCtx.drawImage(layerCanvasCache[layer.id], 0, 0, layer.width, layer.height);
          }
        } else {
          if (layer.type === 'image' && layer.imageUrl) {
            const loadedImg = imageElements[layer.imageUrl];
            if (loadedImg) {
              if (layer.liquifyMesh) {
                renderLiquifyMeshWarp(bCtx, loadedImg, layer.liquifyMesh, layer.width, layer.height);
              } else {
                bCtx.drawImage(loadedImg, 0, 0, layer.width, layer.height);
              }
            } else {
              bCtx.fillStyle = '#18181b';
              bCtx.fillRect(0, 0, layer.width, layer.height);
              bCtx.fillStyle = '#71717a';
              bCtx.font = \`10px monospace\`;
              bCtx.fillText('Loading Asset...', 10, layer.height / 2);
            }
          } else if (layer.type === 'solid' && layer.color) {
            bCtx.fillStyle = layer.color;
            bCtx.fillRect(0, 0, layer.width, layer.height);
          } else if (layer.type === 'text') {
            bCtx.fillStyle = layer.textColor || '#ffffff';
            bCtx.font = \`\${layer.fontWeight || 'bold'} \${Math.round(layer.fontSize || 32)}px Inter, sans-serif\`;
            bCtx.textBaseline = 'middle';
            bCtx.textAlign = 'center';
            bCtx.fillText(layer.text || textVal, layer.width / 2, layer.height / 2);
          } else if (layer.type === 'vector') {
            bCtx.fillStyle = layer.color || shapeFillColor;
            bCtx.strokeStyle = layer.strokeColor || shapeStrokeColor;
            bCtx.lineWidth = Math.max(1, layer.strokeWidth || 2);
            if (layer.vectorType === 'rect') {
              bCtx.fillRect(10, 10, layer.width - 20, layer.height - 20);
              bCtx.strokeRect(10, 10, layer.width - 20, layer.height - 20);
            } else if (layer.vectorType === 'circle') {
              bCtx.beginPath();
              bCtx.arc(layer.width / 2, layer.height / 2, Math.min(layer.width, layer.height) / 2 - 10, 0, Math.PI * 2);
              bCtx.fill();
              bCtx.stroke();
            } else if (layer.vectorType === 'line') {
              bCtx.beginPath();
              bCtx.moveTo(20, layer.height / 2);
              bCtx.lineTo(layer.width - 20, layer.height / 2);
              bCtx.stroke();
            }
          }
        }

        // Apply Adjustments (expensive pixel processing only when needed)
        const adj = layer.adjustments;
        const hasAdjustment = adj.exposure !== 0 || adj.contrast !== 0 || adj.temp !== 0 || adj.tint !== 0 || adj.saturation !== 0 || adj.curves.length > 2 || adj.hue !== 0 || adj.lightness !== 0 || (adj.levels && (adj.levels.blackMin !== 0 || adj.levels.gamma !== 1.0 || adj.levels.whiteMin !== 255)) || adj.invert || (adj.threshold && adj.threshold > 0) || (adj.posterize && adj.posterize < 255);
        
        if (hasAdjustment) {
          try {
            const imgData = bCtx.getImageData(0, 0, layer.width, layer.height);
            const pixels = imgData.data;

            const curvesPoints = adj.curves;
            const curveLUT = new Uint8Array(256);
            for (let i = 0; i < 256; i++) {
              const xVal = i;
              let finalY = i;
              if (curvesPoints.length >= 3) {
                const closestPoint = curvesPoints.reduce((prev, curr) => 
                  Math.abs(curr[0] - xVal) < Math.abs(prev[0] - xVal) ? curr : prev
                );
                finalY = closestPoint[1];
              }
              curveLUT[i] = Math.max(0, Math.min(255, finalY));
            }

            const expFactor = 1 + (adj.exposure / 100);
            const contr = 1 + (adj.contrast / 100);
            const satFactor = 1 + (adj.saturation / 100);
            const lightPercent = adj.lightness || 0;
            const hueShiftDegrees = adj.hue || 0;
            
            const lBlack = adj.levels?.blackMin ?? 0;
            const lWhite = adj.levels?.whiteMin ?? 255;
            const lGamma = adj.levels?.gamma ?? 1.0;
            const levelDiff = Math.max(1, lWhite - lBlack);

            for (let i = 0; i < pixels.length; i += 4) {
              let r = pixels[i];
              let g = pixels[i + 1];
              let b = pixels[i + 2];

              r = curveLUT[r];
              g = curveLUT[g];
              b = curveLUT[b];

              if (lBlack !== 0 || lWhite !== 255 || lGamma !== 1.0) {
                r = Math.pow(Math.max(0, (r - lBlack) / levelDiff), 1 / lGamma) * 255;
                g = Math.pow(Math.max(0, (g - lBlack) / levelDiff), 1 / lGamma) * 255;
                b = Math.pow(Math.max(0, (b - lBlack) / levelDiff), 1 / lGamma) * 255;
              }

              r *= expFactor;
              g *= expFactor;
              b *= expFactor;

              r = ((r - 128) * contr) + 128;
              g = ((g - 128) * contr) + 128;
              b = ((b - 128) * contr) + 128;

              r += (adj.temp * 0.4);
              b -= (adj.temp * 0.4);
              g += (adj.tint * 0.2);

              if (hueShiftDegrees !== 0 || lightPercent !== 0) {
                const [h, s, l] = rgbToHsl(r, g, b);
                let newH = h + (hueShiftDegrees / 360);
                if (newH < 0) newH += 1.0;
                if (newH > 1) newH -= 1.0;
                let newL = l + (lightPercent / 100);
                newL = Math.max(0, Math.min(1, newL));
                const [nr, ng, nb] = hslToRgb(newH, s, newL);
                r = nr; g = ng; b = nb;
              }

              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              r = gray + (r - gray) * satFactor;
              g = gray + (g - gray) * satFactor;
              b = gray + (b - gray) * satFactor;

              if (adj.invert) {
                r = 255 - r;
                g = 255 - g;
                b = 255 - b;
              }

              if (adj.threshold && adj.threshold > 0) {
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                const val = lum >= adj.threshold ? 255 : 0;
                r = val; g = val; b = val;
              }

              if (adj.posterize && adj.posterize < 255 && adj.posterize >= 2) {
                const step = 255 / (adj.posterize - 1);
                r = Math.round(r / step) * step;
                g = Math.round(g / step) * step;
                b = Math.round(b / step) * step;
              }

              pixels[i] = Math.max(0, Math.min(255, r));
              pixels[i+1] = Math.max(0, Math.min(255, g));
              pixels[i+2] = Math.max(0, Math.min(255, b));
            }
            bCtx.putImageData(imgData, 0, 0);
          } catch (e) {
            console.warn('CORS prevented pixel adjustments on canvas', e);
          }
        }

        // Apply Mask if needed (to the cached layerBuffer)
        if (layer.hasMask) {
          try {
            const maskCanvas = getOrCreateMaskCanvas(layer);
            const maskCtx = maskCanvas.getContext('2d');
            if (maskCtx) {
              const mData = maskCtx.getImageData(0, 0, layer.width, layer.height).data;
              const imgData = bCtx.getImageData(0, 0, layer.width, layer.height);
              const pixels = imgData.data;
              for (let i = 0; i < pixels.length; i += 4) {
                 pixels[i+3] = (pixels[i+3] * mData[i]) / 255; 
              }
              bCtx.putImageData(imgData, 0, 0);
            }
          } catch (e) {
             console.warn('Mask read failed due to CORS');
          }
        }

        adjustedLayerCacheRef.current[layer.id] = { canvas: layerBuffer, hash };
      }

      // 3. Render separate Layer Styles/Effects`;

if (code.match(regex)) {
   code = code.replace(regex, replacement);
   fs.writeFileSync('src/components/AIPsEngineNode.tsx', code);
   console.log("Patched renderComposite successfully.");
} else {
   console.log("No match found.");
}
