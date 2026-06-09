const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  uniform vec2 u_resolution;

  void main() {
    // convert the position from pixels to 0.0 to 1.0
    vec2 zeroToOne = a_position / u_resolution;
    // convert from 0->1 to 0->2
    vec2 zeroToTwo = zeroToOne * 2.0;
    // convert from 0->2 to -1->+1 (clipspace)
    vec2 clipSpace = zeroToTwo - 1.0;
    // invert y to match canvas coords
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_texCoord = a_texCoord;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;

  void main() {
    gl_FragColor = texture2D(u_image, v_texCoord);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// Keep an offscreen canvas and context
let cachedCanvas: HTMLCanvasElement | null = null;
let cachedGL: WebGLRenderingContext | null = null;
let cachedProgram: WebGLProgram | null = null;
let positionBuffer: WebGLBuffer | null = null;
let texCoordBuffer: WebGLBuffer | null = null;
let indexBuffer: WebGLBuffer | null = null;
let texture: WebGLTexture | null = null;

export function renderLiquifyWebGL(
  img: HTMLImageElement | HTMLCanvasElement,
  cols: number,
  rows: number,
  points: { ox: number; oy: number; x: number; y: number }[],
  width: number,
  height: number
): HTMLCanvasElement | null {
  try {
    if (!cachedCanvas) {
      cachedCanvas = document.createElement("canvas");
    }
    cachedCanvas.width = width;
    cachedCanvas.height = height;

    if (!cachedGL) {
      cachedGL = (cachedCanvas.getContext("webgl", { antialias: true, alpha: true, preserveDrawingBuffer: true }) || 
                 cachedCanvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    }
    const gl = cachedGL;
    if (!gl) return null;

    if (!cachedProgram) {
      cachedProgram = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    }
    const program = cachedProgram;
    if (!program) return null;

    gl.useProgram(program);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Disable depth testing for standard 2D overlay
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Upload vertices positional data
    const positions = new Float32Array(points.length * 2);
    const texCoords = new Float32Array(points.length * 2);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      positions[i * 2] = p.x;
      positions[i * 2 + 1] = p.y;
      // Normalizing tex coords [0, 1] relative to the overall geometry size
      texCoords[i * 2] = p.ox / width;
      texCoords[i * 2 + 1] = p.oy / height;
    }

    // Set up program uniform variables
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    gl.uniform2f(resolutionLocation, width, height);

    // Buffer position attributes
    if (!positionBuffer) positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    const posAttrLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posAttrLocation);
    gl.vertexAttribPointer(posAttrLocation, 2, gl.FLOAT, false, 0, 0);

    // Buffer texture attributes
    if (!texCoordBuffer) texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.DYNAMIC_DRAW);
    const texAttrLocation = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(texAttrLocation);
    gl.vertexAttribPointer(texAttrLocation, 2, gl.FLOAT, false, 0, 0);

    // Create Index buffer of triangles grid
    const indices: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const i00 = r * cols + c;
        const i10 = (r + 1) * cols + c;
        const i01 = r * cols + (c + 1);
        const i11 = (r + 1) * cols + (c + 1);

        // Triangle 1
        indices.push(i00, i10, i01);
        // Triangle 2
        indices.push(i11, i01, i10);
      }
    }

    if (!indexBuffer) indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // Upload source texture
    if (!texture) texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Texture scaling configuration properties
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Set texture image content
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    // Drawing call triggered nicely
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    return cachedCanvas;
  } catch (error) {
    console.error("WebGL Liquify draw error, falling back:", error);
    return null;
  }
}
