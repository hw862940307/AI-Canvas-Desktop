import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import zlib from 'zlib';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function appendLog(message: string) {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(path.join(__dirname, 'app_logs.txt'), `[${timestamp}] ${message}\n`);
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

const upload = multer({ storage: multer.memoryStorage() });

const isLocalUrl = (url: string) => {
  return false; // Relax restriction to allow proxying to local server instances
};

function decompressBuffer(buffer: Buffer, encoding: string): Buffer {
  if (!encoding || !buffer || buffer.length === 0) return buffer;
  const lower = encoding.toLowerCase();
  try {
    if (lower.includes('gzip')) {
      if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
        return zlib.gunzipSync(buffer);
      }
    } else if (lower.includes('deflate')) {
      if (buffer.length > 0 && buffer[0] === 0x78) {
        return zlib.inflateSync(buffer);
      }
    } else if (lower.includes('br')) {
      // Brotli compressed stream begins with binary data, so trying to decompress already decompressed plain text will throw.
      // We safely try and catch.
      return zlib.brotliDecompressSync(buffer);
    }
  } catch (err: any) {
    console.warn('Decompression failed, using raw buffer instead:', err.message);
  }
  return buffer;
}

const historyDir = path.join(__dirname, 'history');
if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir, { recursive: true });
}

async function saveImageToHistory(urlOrBase64: string): Promise<string> {
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 10000);
  const fileName = `gen_${timestamp}_${randomSuffix}.png`;
  const filePath = path.join(historyDir, fileName);

  try {
    if (urlOrBase64.startsWith('data:')) {
      const matches = urlOrBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const base64Data = matches[2];
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        return `/history/${fileName}`;
      } else {
        const base64Data = urlOrBase64.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        return `/history/${fileName}`;
      }
    } else if (urlOrBase64.startsWith('http')) {
      const response = await axios.get(urlOrBase64, { responseType: 'arraybuffer', timeout: 30000 });
      fs.writeFileSync(filePath, Buffer.from(response.data));
      return `/history/${fileName}`;
    } else if (urlOrBase64.length > 200) {
      fs.writeFileSync(filePath, Buffer.from(urlOrBase64, 'base64'));
      return `/history/${fileName}`;
    }
  } catch (error: any) {
    console.error('Failed to save image to history folder:', error.message);
  }
  return urlOrBase64;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  app.use('/history', express.static(historyDir));

  app.get('/api/history-files', (req, res) => {
    try {
      if (!fs.existsSync(historyDir)) {
        return res.json([]);
      }
      const files = fs.readdirSync(historyDir);
      const fileList = files
        .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
        .map(file => {
          const stats = fs.statSync(path.join(historyDir, file));
          return {
            id: `server-${file}`,
            name: file,
            type: 'image',
            url: `/history/${file}`,
            createdAt: stats.mtimeMs,
            size: stats.size
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      res.json(fileList);
    } catch (error: any) {
      console.error('Failed to read history directory:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Browser log receiver for real-time monitoring of sandboxed iframe events
  app.post('/api/browser-log', (req, res) => {
    const { type, message, stack, url } = req.body;
    console.log(`\x1b[33m%s\x1b[0m`, `[BROWSER CLIENT ${type?.toUpperCase() || 'LOG'}] ${message}`, stack ? `\nStack: ${stack}` : '', url ? `\nPage URL: ${url}` : '');
    res.json({ ok: true });
  });

  // ComfyUI Proxy Routes
  
  // 1. Status Check
  app.get('/api/comfy/status', async (req, res) => {
    const comfyUrl = (req.query.url as string || '').trim() || 'http://127.0.0.1:8188';
    if (isLocalUrl(comfyUrl)) {
      return res.status(403).json({ ok: false, error: 'Server-side proxy cannot access local addresses. Use browser-side mode.' });
    }
    try {
      const response = await axios.get(`${comfyUrl.replace(/\/$/, '')}/system_stats`, { 
        timeout: 5000,
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      res.json({ ok: true, comfyUrl, message: 'connected', stats: response.data });
    } catch (error: any) {
      console.error('Status Check Error:', error.message);
      res.status(500).json({ ok: false, comfyUrl, message: 'disconnected', error: error.message || String(error) });
    }
  });

  // 2. Upload Image
  app.post('/api/comfy/upload-image', upload.single('image'), async (req, res) => {
    const comfyUrl = (req.body.url || '').trim() || 'http://127.0.0.1:8188';
    if (isLocalUrl(comfyUrl)) {
      return res.status(403).json({ error: 'Server-side proxy cannot access local addresses.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    try {
      const form = new FormData();
      form.append('image', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
      form.append('overwrite', req.body.overwrite || 'true');

      const response = await axios.post(`${comfyUrl.replace(/\/$/, '')}/upload/image`, form, {
        headers: {
          ...form.getHeaders(),
          'ngrok-skip-browser-warning': 'true'
        },
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('ComfyUI Upload Error:', error.message);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // 3. Run Workflow (Prompt)
  app.post('/api/comfy/run-workflow', async (req, res) => {
    const comfyUrl = (req.body.url || '').trim() || 'http://127.0.0.1:8188';
    if (isLocalUrl(comfyUrl)) {
      return res.status(403).json({ error: 'Server-side proxy cannot access local addresses.' });
    }
    const { workflow, client_id } = req.body;

    try {
      const response = await axios.post(`${comfyUrl.replace(/\/$/, '')}/prompt`, {
        prompt: workflow,
        client_id: client_id
      }, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('ComfyUI Run Error:', error.message);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // 4. Get History
  app.get('/api/comfy/history/:prompt_id', async (req, res) => {
    const comfyUrl = (req.query.url as string || '').trim() || 'http://127.0.0.1:8188';
    if (isLocalUrl(comfyUrl)) {
      return res.status(403).json({ error: 'Server-side proxy cannot access local addresses.' });
    }
    const { prompt_id } = req.params;

    try {
      const response = await axios.get(`${comfyUrl.replace(/\/$/, '')}/history/${prompt_id}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // 5. View (Proxy Image)
  app.get('/api/comfy/view', async (req, res) => {
    const comfyUrl = (req.query.url as string || '').trim() || 'http://127.0.0.1:8188';
    const { filename, subfolder, type } = req.query;

    try {
      const response = await axios.get(`${comfyUrl.replace(/\/$/, '')}/view`, {
        params: { filename, subfolder, type },
        responseType: 'arraybuffer',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      const contentType = (response.headers['content-type'] as string) || 'image/png';
      res.set('Content-Type', contentType);
      res.send(response.data);
    } catch (error) {
      res.status(500).send('Error proxying image from ComfyUI');
    }
  });

  // 6. Launch ComfyUI via local .bat (Runs only when server is running on the local machine)
  app.post('/api/comfy/launch', async (req, res) => {
    const { launcherPath } = req.body;
    if (!launcherPath) {
      return res.status(400).json({ ok: false, error: '启动器路径不能为空' });
    }

    try {
      const fs = await import('fs');
      const cp = await import('child_process');
      
      if (!fs.existsSync(launcherPath)) {
        return res.status(404).json({ 
          ok: false, 
          error: `无法在当前宿主机上找到该启动文件: "${launcherPath}"。\n\n💡 解决办法:\n1. 网页云预览中无法直接运行您的本地电脑文件。请在您的本地电脑终端上手动双击运行该 .bat 文件启动 ComfyUI。\n2. 如果您已下载应用到本地运行，请在设置中对该路径进行微调，确认该路径在您本地电脑上是否 100% 正确。` 
        });
      }

      const workingDir = path.dirname(launcherPath);
      const isWin = process.platform === 'win32';
      let proc;

      if (isWin) {
        proc = cp.spawn('cmd.exe', ['/c', launcherPath], {
          cwd: workingDir,
          detached: true,
          stdio: 'ignore'
        });
        proc.unref();
      } else {
        proc = cp.spawn('sh', [launcherPath], {
          cwd: workingDir,
          detached: true,
          stdio: 'ignore'
        });
        proc.unref();
      }

      res.json({ 
        ok: true, 
        message: `已经为您成功调用本地启动器指令！\n路径: [${launcherPath}]\n\n请查看您本地后台控制台终端，ComfyUI 正在火速加载并拉起，大约 10-30 秒启动完成后，您可以再次尝试测试连接服务！` 
      });
    } catch (err: any) {
      console.error('Launch execution failed:', err);
      res.status(500).json({ 
        ok: false, 
        error: `调用本地启动器程序发生异常: ${err.message || String(err)}`
      });
    }
  });

  // Keep-alive agent pooling to tremendously slash SSL handshake times
  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100, maxFreeSockets: 10, timeout: 60000 });
  const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100, maxFreeSockets: 10, timeout: 60000, rejectUnauthorized: false });

  interface CachedResponse {
    data: any;
    contentType: string;
    setCookies: string[] | string | undefined;
    timestamp: number;
  }
  const proxyCache = new Map<string, CachedResponse>();
  const CACHE_TTL = 30 * 1000; // 30 seconds caching to make navigation and back/forward extremely responsive

  // Proxy for custom HTML page loading and link interception
  app.all('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send('No URL specified');
    
    // Direct redirect for Google Federated Login (GSI) widgets back to native origin
    const isGoogleGsi = (urlStr: string) => {
      const lower = urlStr.toLowerCase();
      return lower.includes('accounts.google.com/gsi/') || lower.includes('google.com/gsi/');
    };

    if (isGoogleGsi(targetUrl)) {
      return res.redirect(targetUrl);
    }
    
    // Define high-security authentication / OAuth portals that can never run inside iframes
    const isHighSecurityPortal = (urlStr: string) => {
      if (!urlStr) return false;
      const lower = urlStr.toLowerCase();
      if (lower.includes('accounts.google.com/gsi/') || lower.includes('google.com/gsi/')) {
        return false;
      }
      return lower.includes('accounts.google.com') ||
             lower.includes('google.com/accounts') ||
             lower.includes('appleid.apple.com') ||
             lower.includes('microsoftonline.com');
    };

    if (isHighSecurityPortal(targetUrl)) {
      const securityPortalHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>安全登录与授权引导</title>
        <style>
          body {
            background-color: #0c0c0e;
            color: #e4e4e7;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 24px;
            box-sizing: border-box;
            text-align: center;
          }
          .card {
            background-color: #16161a;
            border: 1px solid #27272a;
            border-radius: 20px;
            padding: 40px 32px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
          }
          .icon {
            color: #3b82f6;
            margin-bottom: 24px;
            display: inline-block;
          }
          h1 {
            font-size: 20px;
            font-weight: 700;
            margin: 0 0 16px 0;
            letter-spacing: -0.025em;
            color: #ffffff;
          }
          p {
            font-size: 13.5px;
            color: #a1a1aa;
            line-height: 1.6;
            margin: 0 0 28px 0;
          }
          .btn {
            background-color: #2563eb;
            color: #ffffff;
            border: none;
            padding: 14px 28px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 10px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
          }
          .btn:hover {
            background-color: #1d4ed8;
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
          }
          .btn:active {
            transform: translateY(0);
          }
          .footer {
            margin-top: 24px;
            font-size: 11px;
            color: #52525b;
            word-break: break-all;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1>需要进行安全的外部登录与授权</h1>
          <p>您正在访问具有高安全保护策略的帐号登录或第三方授权页面。出于对您的密码及凭据安全保护，并根据 Google 的防点击截持 (Clickjacking) 安全政策，该登录页面不支持在第三方内嵌框 (iFrame) 中加载渲染。</p>
          <a href="${targetUrl}" class="btn" onclick="openExternal(event)">
            <span>安全地在新窗口中登录</span>
          </a>
          <div class="footer">${targetUrl}</div>
        </div>
         <script>
          function getAppWindow() {
            var w = window;
            for (var i = 0; i < 10; i++) {
              try {
                if (w.parent && w.parent !== w && w.parent.document) {
                  w = w.parent;
                } else {
                  break;
                }
              } catch (e) {
                break;
              }
            }
            return w;
          }
          function openExternal(e) {
            if (e && e.preventDefault) {
              e.preventDefault();
            }
            try {
              getAppWindow().postMessage({ type: 'OPEN_EXTERNAL_TAB', url: "${targetUrl}" }, '*');
            } catch(t) {}
            return false;
          }
        </script>
      </body>
      </html>
      `;
      res.header('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(securityPortalHtml);
    }

    // Cache lookup to serve identical URLs near-instantly for smooth tab paging/navigation
    const cacheKey = targetUrl;
    const isGet = ['GET', 'HEAD'].includes(req.method);
    if (isGet) {
      const cached = proxyCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        if (cached.setCookies) {
          if (Array.isArray(cached.setCookies)) {
            cached.setCookies.forEach(cookie => res.append('Set-Cookie', cookie));
          } else if (typeof cached.setCookies === 'string') {
            res.append('Set-Cookie', cached.setCookies);
          }
        }
        res.header('Content-Type', cached.contentType);
        return res.send(cached.data);
      }
    }

    try {
      // Forward incoming cookies from the browser to maintain login sessions
      const clientCookies = req.headers.cookie || '';

      const parsedTargetUrl = new URL(targetUrl);
      const forwardHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Accept-Encoding': 'gzip, deflate, br' // Natively support high-performance decompress forwarding
      };

      const isHeaderBlocked = (key: string) => {
        const k = key.toLowerCase();
        return [
          'host', 'connection', 'content-length', 'accept-encoding', 'cookie', 'user-agent',
          'via', 'forwarded', 'upgrade-insecure-requests',
          'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host', 'x-real-ip',
          'x-cloud-trace-context', 'x-appengine-api-ticket', 'x-appengine-country',
          'cf-connecting-ip', 'cf-ray', 'cf-visitor', 'cf-ipcountry', 'cdn-loop',
          'sec-fetch-mode', 'sec-fetch-site', 'sec-fetch-dest', 'sec-fetch-user'
        ].includes(k) || k.startsWith('sec-fetch-') || k.startsWith('sec-ch-');
      };

      for (const [key, value] of Object.entries(req.headers)) {
        if (!value) continue;
        const lowerKey = key.toLowerCase();
        
        if (isHeaderBlocked(lowerKey)) {
          continue;
        }

        if (lowerKey === 'origin') {
          forwardHeaders['origin'] = parsedTargetUrl.origin;
        } else if (lowerKey === 'referer') {
          try {
            if (typeof value === 'string' && value.includes('/api/proxy?url=')) {
              const refererUrlStr = decodeURIComponent(value.split('/api/proxy?url=')[1]);
              forwardHeaders['referer'] = refererUrlStr;
            } else {
              forwardHeaders['referer'] = targetUrl;
            }
          } catch (e) {
            forwardHeaders['referer'] = targetUrl;
          }
        } else if (lowerKey === 'content-type') {
          forwardHeaders['content-type'] = String(value);
        } else {
          forwardHeaders[key] = String(value);
        }
      }

      if (clientCookies) {
        forwardHeaders['Cookie'] = clientCookies;
      }

      // Serialize dynamic post data based on Content-Type
      let requestData = undefined;
      if (!isGet) {
        const reqContentType = String(req.headers['content-type'] || '');
        if (reqContentType.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams();
          if (req.body && typeof req.body === 'object') {
            for (const [k, v] of Object.entries(req.body)) {
              params.append(k, String(v));
            }
            requestData = params.toString();
          } else {
            requestData = req.body;
          }
        } else if (reqContentType.includes('application/json')) {
          requestData = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
        } else {
          requestData = req.body;
        }
      }

      const response = await axios({
        method: req.method,
        url: targetUrl,
        headers: forwardHeaders,
        data: requestData,
        responseType: 'arraybuffer', // Retrieve as arraybuffer to prevent character set issues and safely store image/binary buffers
        timeout: 30000,
        maxRedirects: 10, // Let server-side proxy follow redirects natively to keep clients inside the sandbox and make load speed incredibly fast
        httpAgent: httpAgent,
        httpsAgent: httpsAgent,
        validateStatus: () => true // Forward non-200 responses seamlessly too
      });
      
      const contentType = String(response.headers['content-type'] || '');

      // Forward response Set-Cookie headers back to browser (rewriting domains to store locally)
      const setCookies = response.headers['set-cookie'];
      let mappedSetCookies: string[] | string | undefined = undefined;
      if (setCookies) {
        const cleanSetCookie = (cookieStr: string) => {
          let cleaned = cookieStr
            .replace(/domain\s*=\s*[^;]+/gi, '')
            .replace(/samesite\s*=\s*(lax|strict|none)/gi, '')
            .replace(/secure/gi, '')
            .replace(/;\s*;\s*/g, '; ')
            .trim();
          
          // Force SameSite=None and Secure so cookies persist inside nested iframes
          cleaned = cleaned.replace(/;\s*$/g, '');
          cleaned += '; SameSite=None; Secure';
          return cleaned;
        };
        if (Array.isArray(setCookies)) {
          mappedSetCookies = setCookies.map(cleanSetCookie);
          mappedSetCookies.forEach(cookie => {
            res.append('Set-Cookie', cookie);
          });
        } else if (typeof setCookies === 'string') {
          mappedSetCookies = cleanSetCookie(setCookies);
          res.append('Set-Cookie', mappedSetCookies);
        }
      }

      // Explicitly capture and rewrite HTTP Redirect (3xx) Location targets
      const isRedirect = response.status >= 300 && response.status < 400;
      const responseLocation = response.headers['location'];
      if (isRedirect && responseLocation) {
        try {
          const resolvedLocation = new URL(responseLocation, targetUrl).href;
          const proxiedLocation = `/api/proxy?url=${encodeURIComponent(resolvedLocation)}`;
          res.setHeader('Location', proxiedLocation);
          return res.status(response.status).send();
        } catch (e) {
          console.warn('Redirect location resolution failed', responseLocation, e);
        }
      }

      // Propagate the original HTTP status
      res.status(response.status);

      // Secure decompression of server response body content
      let decompressedBuffer = Buffer.from(response.data);
      const contentEncoding = String(response.headers['content-encoding'] || '');
      if (contentEncoding) {
        decompressedBuffer = decompressBuffer(decompressedBuffer, contentEncoding);
      }

      let isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
      
      // Fallback: sniff HTML from buffer headers if Content-Type string is vague or generic
      if (!isHtml && decompressedBuffer && decompressedBuffer.length > 0) {
        try {
          const sample = decompressedBuffer.slice(0, 1000).toString('utf-8').toLowerCase();
          if (sample.includes('<html') || sample.includes('<!doctype html') || sample.includes('<body')) {
            isHtml = true;
          }
        } catch (e) {}
      }

      if (isHtml) {
        let html = decompressedBuffer.toString('utf-8');
        
        // Find the ultimate final URL after redirection to use as baseHref
        const finalUrl = response.request?.res?.responseUrl || response.config?.url || targetUrl;
        const baseHref = `<base href="${finalUrl}" />\n`;

        // Helper pattern to decide if a URL should be proxied
        const shouldProxyUrl = (urlStr: string) => {
          if (!urlStr) return false;
          const lower = urlStr.toLowerCase().trim();
          if (lower.startsWith('/') || lower.startsWith('data:') || lower.startsWith('blob:')) {
            return false;
          }
          if (lower.includes('accounts.google.com/gsi/') || lower.includes('google.com/gsi/')) {
            return false;
          }
          const isLocal = lower.includes('127.0.0.1') || 
                          lower.includes('localhost') || 
                          lower.startsWith('http://192.168.') || 
                          lower.startsWith('http://10.') || 
                          lower.startsWith('http://172.');
          return !isLocal && (lower.startsWith('http://') || lower.startsWith('https://'));
        };

        // Recursively rewrite iframe and frame tags inside the page to stream through the proxy as well
        html = html.replace(/<iframe\b([^>]*)src\s*=\s*(["'])([^"'\s>]+)\2([^>]*)>/gi, (match, before, quote, src, after) => {
          try {
            const resolvedSrc = new URL(src, finalUrl).href;
            if (shouldProxyUrl(resolvedSrc)) {
              return `<iframe${before}src=${quote}/api/proxy?url=${encodeURIComponent(resolvedSrc)}${quote}${after}>`;
            }
          } catch (e) {}
          return match;
        });
        
        html = html.replace(/<frame\b([^>]*)src\s*=\s*(["'])([^"'\s>]+)\2([^>]*)>/gi, (match, before, quote, src, after) => {
          try {
            const resolvedSrc = new URL(src, finalUrl).href;
            if (shouldProxyUrl(resolvedSrc)) {
              return `<frame${before}src=${quote}/api/proxy?url=${encodeURIComponent(resolvedSrc)}${quote}${after}>`;
            }
          } catch (e) {}
          return match;
        });
        
        // Inject custom interception script elements
        const injectJs = `
          <script>
            (function() {
              const baseTargetUrl = "${finalUrl}";
              const originalWindowOpen = window.open;

              // Dynamic browser diagnostics log system to pipe client sandboxed console/raw logs back to container output
              (function() {
                const reportLog = function(type, message, stack) {
                  try {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/api/browser-log', true);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.send(JSON.stringify({ type: type, message: message, stack: stack, url: window.location.href }));
                  } catch(e) {}
                };
                
                window.onerror = function(message, source, lineno, colno, error) {
                  reportLog('error', String(message) + ' at ' + String(source) + ':' + String(lineno) + ':' + String(colno), error ? error.stack : '');
                };
                
                window.onunhandledrejection = function(event) {
                  reportLog('unhandledrejection', String(event.reason), event.reason ? event.reason.stack : '');
                };
                
                const originalConsoleError = console.error;
                console.error = function() {
                  const args = Array.prototype.slice.call(arguments);
                  reportLog('console.error', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                  originalConsoleError.apply(console, arguments);
                };
                
                const originalConsoleWarn = console.warn;
                console.warn = function() {
                  const args = Array.prototype.slice.call(arguments);
                  reportLog('console.warn', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                  originalConsoleWarn.apply(console, arguments);
                };
              })();
              
              const getAppWindow = function() {
                var w = window;
                for (var i = 0; i < 10; i++) {
                  try {
                    if (w.parent && w.parent !== w && w.parent.document) {
                      w = w.parent;
                    } else {
                      break;
                    }
                  } catch (e) {
                    break;
                  }
                }
                return w;
              };

              const postToApp = function(msg) {
                try {
                  getAppWindow().postMessage(msg, '*');
                } catch (e) {
                  window.parent.postMessage(msg, '*');
                }
              };

              // Image drag interceptor for drag and drop to parent canvas
              document.addEventListener('dragstart', function(e) {
                try {
                  var target = e.target;
                  if (target) {
                    var img = target.tagName === 'IMG' ? target : (target.querySelector ? target.querySelector('img') : null);
                    if (!img && target.closest) {
                      img = target.closest('img');
                    }
                    var src = img ? (img.src || img.getAttribute('src')) : null;
                    if (!src && target.style && target.style.backgroundImage) {
                      var bg = target.style.backgroundImage;
                      var match = bg.match(/url\(['"]?(.*?)['"]?\)/);
                      if (match && match[1]) {
                        src = match[1];
                      }
                    }
                    if (src) {
                      var absoluteUrl = new URL(src, window.location.href).href;
                      postToApp({
                        type: 'APT_DRAG_IMAGE_START',
                        url: absoluteUrl
                      });
                    }
                  }
                } catch(err) {}
              }, true);

              document.addEventListener('dragend', function(e) {
                try {
                  postToApp({
                    type: 'APT_DRAG_IMAGE_END'
                  });
                } catch(err) {}
              }, true);

              const isLoginOrAuthUrl = function(urlString) {
                if (!urlString) return false;
                const lower = urlString.toLowerCase();
                return lower.includes('accounts.google.com') ||
                       lower.includes('google.com/accounts') ||
                       lower.includes('appleid.apple.com') ||
                       lower.includes('apple.com/auth') ||
                       lower.includes('microsoftonline.com') ||
                       lower.includes('login.live.com') ||
                       lower.includes('github.com/login') ||
                       lower.includes('github.com/join') ||
                       lower.includes('github.com/oauth');
              };
              
              function resolveAndProxyUrl(url) {
                if (!url) return url;
                let urlStr = '';
                if (typeof url === 'string') {
                  urlStr = url;
                } else if (url && url.href) {
                  urlStr = url.href;
                } else if (url && url.url) {
                  urlStr = url.url;
                } else {
                  urlStr = String(url);
                }

                if (urlStr.startsWith('/api/proxy') || urlStr.includes('/api/proxy?')) {
                  return url;
                }

                try {
                  const resolved = new URL(urlStr, baseTargetUrl);
                  
                  // If the resolved URL points to our container origin, it means the app resolved a relative path 
                  // against our container instead of the base target URL. We must rewrite this relative path to the base target!
                  if (resolved.origin === window.location.origin) {
                    const relativePath = resolved.pathname + resolved.search + resolved.hash;
                    const targetResolved = new URL(relativePath, baseTargetUrl);
                    return '/api/proxy?url=' + encodeURIComponent(targetResolved.href);
                  }
                  
                  // For all other domains (such as target or CDN domains), route them securely through our proxy
                  return '/api/proxy?url=' + encodeURIComponent(resolved.href);
                } catch(e) {}
                return url;
              }

              // Overwrite Fetch API to resolve CORS and session state integration for dynamic components
              if (window.fetch) {
                const originalFetch = window.fetch;
                window.fetch = function(input, init) {
                  try {
                    let urlStr = '';
                    if (typeof input === 'string') {
                      urlStr = input;
                    } else if (input && typeof input === 'object' && input.url) {
                      urlStr = input.url;
                    } else if (input && input.href) {
                      urlStr = input.href;
                    }
                    if (urlStr) {
                      const proxied = resolveAndProxyUrl(urlStr);
                      if (proxied !== urlStr) {
                        if (!init) init = {};
                        init.credentials = 'include';
                        if (typeof input === 'string') {
                          input = proxied;
                        } else if (input && typeof input === 'object' && input.url) {
                          try {
                            const initOpts = {
                              method: input.method,
                              headers: new Headers(input.headers),
                              credentials: input.credentials || 'include',
                              mode: input.mode,
                              cache: input.cache,
                              redirect: input.redirect
                            };
                            if (input.method !== 'GET' && input.method !== 'HEAD') {
                              try {
                                const cloned = input.clone();
                                initOpts.body = cloned.body;
                              } catch(bodyErr) {}
                            }
                            input = new Request(proxied, initOpts);
                          } catch (e) {
                            input = proxied;
                          }
                        } else {
                          input = proxied;
                        }
                      }
                    }
                  } catch (err) {
                    console.warn('Fetch redirect wrapper failed', err);
                  }
                  return originalFetch.call(this, input, init);
                };
              }

              // Overwrite XMLHttpRequest similarly to prevent cross-origin network errors
              if (window.XMLHttpRequest) {
                const originalOpen = window.XMLHttpRequest.prototype.open;
                window.XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
                  try {
                    if (url) {
                      const proxied = resolveAndProxyUrl(url);
                      if (proxied !== url) {
                        this.withCredentials = true;
                        url = proxied;
                      }
                    }
                  } catch (err) {
                    console.warn('XHR redirect wrapper failed', err);
                  }
                  return originalOpen.call(this, method, url, async, user, password);
                };
              }

              // Override window.open to open inside node's internal tabs, but delegate auth portals to native popup windows
              window.open = function(url, target, specs) {
                try {
                  const targetUrlStr = url ? String(url) : '';
                  
                  // Google GSI and standard auth libraries open a blank window first and then set its location.
                  // To support this without crashing client JS, we open a real blank window,
                  // and wrap it in a Proxy to dynamically intercept high-security redirects seamlessly.
                  const realWin = originalWindowOpen.call(window, url || 'about:blank', target || '_blank', specs);
                  if (!realWin) {
                    return null;
                  }

                  const winProxy = new Proxy(realWin, {
                    get(tgt, prop) {
                      if (prop === 'location') {
                        return new Proxy(tgt.location, {
                          get(locTgt, locProp) {
                            if (locProp === 'href') {
                              return locTgt.href;
                            }
                            const locVal = locTgt[locProp];
                            if (typeof locVal === 'function') {
                              return locVal.bind(locTgt);
                            }
                            return locVal;
                          },
                          set(locTgt, locProp, val) {
                            if (locProp === 'href' || locProp === 'assign' || locProp === 'replace') {
                              const urlVal = String(val);
                              const resolved = new URL(urlVal, baseTargetUrl).href;
                              if (isLoginOrAuthUrl(resolved)) {
                                try {
                                  postToApp({ type: 'OPEN_EXTERNAL_TAB', url: resolved });
                                } catch (e) {}
                              }
                              locTgt[locProp] = resolved;
                              return true;
                            }
                            locTgt[locProp] = val;
                            return true;
                          }
                        });
                      }

                      // Return standard descriptors/properties binding them to the real window context
                      const val = tgt[prop];
                      if (typeof val === 'function') {
                        return val.bind(tgt);
                      }
                      return val;
                    },
                    set(tgt, prop, val) {
                      if (prop === 'location') {
                        const urlVal = String(val);
                        const resolved = new URL(urlVal, baseTargetUrl).href;
                        if (isLoginOrAuthUrl(resolved)) {
                          try {
                            postToApp({ type: 'OPEN_EXTERNAL_TAB', url: resolved });
                          } catch (e) {}
                        }
                        tgt.location = resolved;
                        return true;
                      }
                      tgt[prop] = val;
                      return true;
                    }
                  });

                  return winProxy;
                } catch(e) {
                  console.warn("Interception of window.open failed", e);
                  try {
                    return originalWindowOpen.call(window, url, target, specs);
                  } catch (err) {
                    return null;
                  }
                }
              };
              
              // Intercept click events on Anchor (<a>) tags to navigate smoothly inside the current node
              document.addEventListener('click', function(e) {
                let targetEl = e.target;
                while (targetEl && targetEl.parentNode && targetEl.tagName && targetEl.tagName.toUpperCase() !== 'A') {
                  targetEl = targetEl.parentNode;
                }
                if (targetEl && targetEl.tagName && targetEl.tagName.toUpperCase() === 'A') {
                  const href = targetEl.getAttribute('href');
                  const target = targetEl.getAttribute('target') || '_self';
                  if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                    try {
                      const resolvedUrl = new URL(href, baseTargetUrl).href;
                      if (isLoginOrAuthUrl(resolvedUrl)) {
                        // Open in a new tab natively so that Google/standard OAuth is not restricted by iframe
                        e.preventDefault();
                        originalWindowOpen.call(window, resolvedUrl, '_blank');
                      } else {
                        e.preventDefault();
                        if (target === '_blank' || e.ctrlKey || e.metaKey) {
                          postToApp({ type: 'OPEN_INTERNAL_TAB', url: resolvedUrl });
                        } else {
                          postToApp({ type: 'NAVIGATE_CURRENT_TAB', url: resolvedUrl });
                        }
                      }
                    } catch(err) {}
                  }
                }
              }, true);

              // Intercept GET and POST form submissions to keep user inside the sandbox smoothly
              document.addEventListener('submit', function(e) {
                const form = e.target;
                if (form && form.tagName === 'FORM') {
                  const action = form.getAttribute('action') || '';
                  const method = (form.getAttribute('method') || 'get').toLowerCase();
                  try {
                    const resolvedUrl = new URL(action, baseTargetUrl).href;
                    if (isLoginOrAuthUrl(resolvedUrl)) {
                      return; // Allow standard popup high security auth redirection
                    }
                    
                    if (method === 'get') {
                      e.preventDefault();
                      const url = new URL(resolvedUrl);
                      const formData = new FormData(form);
                      for (const [key, value] of formData.entries()) {
                        if (typeof value === 'string') {
                          url.searchParams.append(key, value);
                        }
                      }
                      postToApp({ type: 'NAVIGATE_CURRENT_TAB', url: url.href });
                    } else {
                      // For POST requests, dynamically update Form Action target on submission
                      form.setAttribute('action', '/api/proxy?url=' + encodeURIComponent(resolvedUrl));
                    }
                  } catch (err) {}
                }
              }, true);
            })();
          </script>
        `;
        
        // Case-insensitive injection with support for attributes to avoid rendering the page in Quirks Mode
        const headRegex = /<head\b[^>]*>/i;
        const htmlRegex = /<html\b[^>]*>/i;
        const doctypeRegex = /<!doctype\s+html[^>]*>/i;

        if (headRegex.test(html)) {
          html = html.replace(headRegex, (match) => match + '\n' + baseHref + injectJs);
        } else if (htmlRegex.test(html)) {
          html = html.replace(htmlRegex, (match) => match + '\n<head>' + baseHref + injectJs + '</head>');
        } else if (doctypeRegex.test(html)) {
          html = html.replace(doctypeRegex, (match) => match + '\n<html><head>' + baseHref + injectJs + '</head>');
        } else {
          html = baseHref + injectJs + html;
        }
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        if (isGet && response.status === 200 && html && html.trim().length > 0) {
          proxyCache.set(cacheKey, {
            data: html,
            contentType: 'text/html; charset=utf-8',
            setCookies: mappedSetCookies,
            timestamp: Date.now()
          });
        }
        return res.send(html);
      } else {
        // Safe streaming of decompressed binary buffer data
        res.setHeader('Content-Type', contentType);
        
        // Fast Page Load Optimization: let the user's browser cache static assets (JS, CSS, images, fonts)
        // so they are not repeatedly requested from the backend, slashing subsequent load times down to milliseconds
        const isStaticAsset = contentType.includes('javascript') || 
                              contentType.includes('css') || 
                              contentType.includes('image/') || 
                              contentType.includes('font/') || 
                              contentType.includes('audio/') || 
                              contentType.includes('video/');
        if (isStaticAsset) {
          res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=600');
        } else {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }

        if (isGet && response.status === 200 && decompressedBuffer && decompressedBuffer.length > 0) {
          proxyCache.set(cacheKey, {
            data: decompressedBuffer,
            contentType: contentType,
            setCookies: mappedSetCookies,
            timestamp: Date.now()
          });
        }
        return res.send(decompressedBuffer);
      }
    } catch (error: any) {
      console.warn('Proxy failed, building fallback safe interactive portal for URL:', targetUrl, error.message);
      
      const safeHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>外部展示引导 | Port Portal</title>
        <style>
          body {
            background-color: #0c0c0e;
            color: #e4e4e7;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 24px;
            box-sizing: border-box;
            text-align: center;
          }
          .card {
            background-color: #16161a;
            border: 1px solid #27272a;
            border-radius: 16px;
            padding: 32px;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
          }
          .icon {
            color: #eab308;
            margin-bottom: 20px;
            display: inline-block;
          }
          h1 {
            font-size: 18px;
            font-weight: 700;
            margin: 0 0 12px 0;
            letter-spacing: -0.025em;
          }
          p {
            font-size: 13px;
            color: #a1a1aa;
            line-height: 1.6;
            margin: 0 0 24px 0;
          }
          .btn {
            background-color: #3b82f6;
            color: #ffffff;
            border: none;
            padding: 12px 24px;
            font-size: 13px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
            transition: all 0.2s;
          }
          .btn:hover {
            background-color: #2563eb;
            transform: translateY(-1px);
          }
          .btn:active {
            transform: translateY(0);
          }
          .footer {
            font-size: 11px;
            color: #52525b;
            margin-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </div>
          <h1>此外部链接需在新窗口中加载</h1>
          <p>由于该网页的安全限制 (如 X-Frame-Options、Cloudflare 安全盾或 SSL 防御)，该少数页面无法在此内嵌框直接完全解密渲染。</p>
          <a href="${targetUrl}" class="btn" onclick="openExternal(event)">
            <span>在新窗口或外部浏览器中加载</span>
          </a>
          <div id="urlText" style="margin-top:16px; word-break: break-all; font-family: monospace; font-size: 11px; color: #71717a;">${targetUrl}</div>
          <div id="errorText" style="margin-top:8px; font-family: monospace; font-size: 10px; color: #f87171; background-color: #ef444410; padding: 6px 12px; border-radius: 6px; border: 1px solid #ef444420; word-break: break-all;">诊断信息 (Diagnostic Info): ${String(error.message).replace(/`/g, "'")} (${error.code || 'STATUS_CODE_HTTP_' + (error.response?.status || 'UNKNOWN')})</div>
        </div>
        <script>
          function getAppWindow() {
            var w = window;
            for (var i = 0; i < 10; i++) {
              try {
                if (w.parent && w.parent !== w && w.parent.document) {
                  w = w.parent;
                } else {
                  break;
                }
              } catch (e) {
                break;
              }
            }
            return w;
          }
          function openExternal(e) {
            if (e && e.preventDefault) {
              e.preventDefault();
            }
            try {
              getAppWindow().postMessage({ type: 'OPEN_EXTERNAL_TAB', url: "${targetUrl}" }, '*');
            } catch(t) {}
            return false;
          }
        </script>
      </body>
      </html>
      `;
      res.header('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(safeHtml);
    }
  });

  // Proxy for LLM Chat Completions
  app.post('/api/chat', async (req, res) => {
    const { engine, baseUrl, apiKey, modelId, messages, attachments, webSearch } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is missing' });
    }

    try {
      if (engine === 'gemini') {
        let finalBaseUrl = (baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
        if (finalBaseUrl.endsWith('/v1beta')) {
          finalBaseUrl = finalBaseUrl.slice(0, -7);
        }
        const url = `${finalBaseUrl}/v1beta/models/${modelId || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
        
        // Construct the multi-turn contents structure for Gemini API
        let contents: any[] = [];
        if (Array.isArray(messages)) {
          contents = messages.map((m, idx) => {
            const role = m.role === 'assistant' ? 'model' : 'user';
            const parts: any[] = [{ text: m.content || '' }];
            
            // Include historical message attachments if present
            if (m.attachments && m.attachments.length > 0) {
              m.attachments.forEach((att: any) => {
                if (att.type?.startsWith('image/')) {
                  const base64Data = att.base64.includes(';base64,') ? att.base64.split(';base64,')[1] : att.base64;
                  parts.push({
                    inlineData: {
                      mimeType: att.type,
                      data: base64Data
                    }
                  });
                } else if (att.text) {
                  parts.push({ text: `\n\n[Attached Document: ${att.name}]\n${att.text}` });
                }
              });
            }
            return { role, parts };
          });
        } else {
          contents = [{ role: 'user', parts: [{ text: String(messages) }] }];
        }

        // Add client attachments from the active turn to the last user block
        if (attachments && attachments.length > 0) {
          const lastTurn = contents[contents.length - 1];
          if (lastTurn && lastTurn.role === 'user') {
            attachments.forEach((att: any) => {
              const isAlreadyAttached = lastTurn.parts.some((p: any) => p.text && p.text.includes(`[Attached Document: ${att.name}]`));
              if (!isAlreadyAttached) {
                if (att.type?.startsWith('image/')) {
                  const base64Data = att.base64.includes(';base64,') ? att.base64.split(';base64,')[1] : att.base64;
                  lastTurn.parts.push({
                    inlineData: {
                      mimeType: att.type,
                      data: base64Data
                    }
                  });
                } else if (att.text) {
                  lastTurn.parts.push({ text: `\n\n[Attached Document: ${att.name}]\n${att.text}` });
                }
              }
            });
          }
        }

        const requestBody: any = { contents };
        
        // Support Google Search Grounding for Gemini models
        if (webSearch) {
          requestBody.tools = [{ googleSearch: {} }];
        }

        const response = await axios.post(url, requestBody, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        const candidate = response.data.candidates?.[0];
        let text = candidate?.content?.parts?.[0]?.text || '';
        
        // Append Search Grounding links if present
        const groundingMetadata = candidate?.groundingMetadata;
        if (groundingMetadata && groundingMetadata.groundingChunks) {
          const links = groundingMetadata.groundingChunks
            .map((chunk: any) => chunk.web?.uri)
            .filter((uri: string | undefined): uri is string => !!uri);
          
          if (links.length > 0) {
            const uniqueLinks = Array.from(new Set(links));
            text += `\n\n**🌐 联网搜索来源：**\n` + uniqueLinks.map((link, idx) => `[${idx + 1}] ${link}`).join('\n');
          }
        }

        return res.json({ text });
      } else {
        // OpenAI compatibility format
        const finalBaseUrl = baseUrl || 'https://api.openai.com/v1';
        const url = `${finalBaseUrl.replace(/\/$/, '')}/chat/completions`;
        
        const openAiMessages: any[] = [];
        if (Array.isArray(messages)) {
          messages.forEach((m, idx) => {
            const isLastMessage = idx === messages.length - 1;
            const currentTurnAttachments = isLastMessage ? (attachments || []) : [];
            const combinedAttachs = [...(m.attachments || []), ...currentTurnAttachments];

            if (combinedAttachs.length > 0) {
              const contentArray: any[] = [{ type: 'text', text: m.content || '' }];
              combinedAttachs.forEach((att: any) => {
                if (att.type?.startsWith('image/')) {
                  contentArray.push({
                    type: 'image_url',
                    image_url: { url: att.base64 }
                  });
                } else if (att.text) {
                  contentArray.push({
                    type: 'text',
                    text: `\n\n[Attached Document: ${att.name}]\n${att.text}`
                  });
                }
              });
              openAiMessages.push({ role: m.role, content: contentArray });
            } else {
              openAiMessages.push({ role: m.role, content: m.content || '' });
            }
          });
        } else {
          openAiMessages.push({ role: 'user', content: String(messages) });
        }

        const response = await axios.post(url, {
          model: modelId || 'gpt-3.5-turbo',
          messages: openAiMessages,
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        const text = response.data.choices?.[0]?.message?.content || '';
        return res.json({ text });
      }
    } catch (error: any) {
      console.error('LLM API Error:', error?.response?.data || error.message);
      const errMsg = error?.response?.data?.error?.message || error?.response?.data?.error || error.message || 'Unknown API Error';
      res.status(500).json({ error: typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg });
    }
  });

  // Proxy for LLM Image Generations (OpenAI format and Gemini format)
  app.post('/api/images', async (req, res) => {
    const { engine, baseUrl, apiKey, modelId, prompt, size, n, quality, lora, msAsync, opMode, images, format, background, moderation } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is missing' });
    }

    // Helper to recursively find all HTTP/HTTPS image-like URLs in a response object
    const extractImageUrls = (obj: any): string[] => {
      const urls: string[] = [];
      const recurse = (value: any) => {
        if (typeof value === 'string') {
          if (value.startsWith('http://') || value.startsWith('https://')) {
            urls.push(value);
          }
        } else if (Array.isArray(value)) {
          for (const item of value) recurse(item);
        } else if (value && typeof value === 'object') {
          for (const k of Object.keys(value)) recurse(value[k]);
        }
      };
      recurse(obj);
      return urls;
    };

    try {
      if (engine === 'modelscope') {
        const finalBaseUrl = baseUrl || 'https://api-inference.modelscope.cn/v1';
        const isModelScope = finalBaseUrl.toLowerCase().includes('modelscope');
        const url = `${finalBaseUrl.replace(/\/$/, '')}/images/generations`;

        let finalPrompt = prompt;
        if (lora && lora.enabled && lora.triggerWord) {
          finalPrompt = `${lora.triggerWord}, ${prompt}`;
        }

        const payload: any = {
          prompt: finalPrompt,
          model: modelId || 'Tongyi-MAI/Z-Image-Turbo',
          n: parseInt(n) || 1,
        };

        // Map ratio + resolution into a valid width x height string for ModelScope
        let finalSize = '1024x1024';
        const ratio = size || '1:1';
        const resType = quality || '1K';

        if (ratio.toLowerCase().includes('x')) {
          finalSize = ratio.toLowerCase();
        } else if (resType === '512x512' || resType === '768x768') {
          finalSize = resType;
        } else {
          const is2K = resType === '2K';
          if (ratio === '1:1' || ratio === '自动') {
            finalSize = is2K ? '2048x2048' : '1024x1024';
          } else if (ratio === '4:3') {
            finalSize = is2K ? '2048x1536' : '1024x768';
          } else if (ratio === '3:4') {
            finalSize = is2K ? '1536x2048' : '768x1024';
          } else if (ratio === '16:9') {
            finalSize = is2K ? '2048x1152' : '1024x576';
          } else if (ratio === '9:16') {
            finalSize = is2K ? '1152x2048' : '576x1024';
          } else {
            finalSize = is2K ? '2048x2048' : '1024x1024';
          }
        }
        payload.size = finalSize;

        if (lora && lora.enabled) {
          payload.lora = lora;
        }

        const headers: any = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        };

        // ModelScope API gateway does not expose a running tasks status polling endpoint for ModelScope token users (it returns 500 task not found).
        // Therefore, we must run synchronously (isActuallyAsync = false) when using ModelScope endpoints,
        // so that the gateway blocks, processes the generation, and returns standard OpenAI-compatible results directly.
        // DashScope endpoints with proper DashScope keys can safely use async polling mode.
        const isActuallyAsync = isModelScope ? false : !!(msAsync || (lora && lora.enabled));

        if (isActuallyAsync) {
          headers['X-DashScope-Async'] = 'enable';
          headers['X-ModelScope-Async'] = 'enable';
        }

        appendLog(`[ModelScope Request] URL: ${url}, Model: ${payload.model}, Size: ${payload.size}, Payload: ${JSON.stringify(payload)}, Async: ${isActuallyAsync}`);

        const response = await axios.post(url, payload, {
          headers,
          timeout: 45000
        });

        appendLog(`[ModelScope Response] Status: ${response.status}, Raw Data: ${JSON.stringify(response.data)}`);

        let urls: string[] = [];

        // If we received a task ID and no image URLs are immediately available, we MUST poll regardless of msAsync flag,
        // because LoRA or complex image generation on ModelScope and DashScope is always asynchronous under the hood.
        const taskId = response.data.output?.task_id || response.data.task_id;
        
        // Extract immediate urls if present in the response
        urls = response.data.data?.map((d: any) => d.url).filter(Boolean) || [];
        if (urls.length === 0) {
          urls = extractImageUrls(response.data);
        }

        if (taskId && urls.length === 0) {
          appendLog(`[ModelScope] Task ID: ${taskId} received with no immediate image URLs. Initiating robust polling...`);
          
          const candidates: string[] = [
            `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
            `${finalBaseUrl.replace(/\/v1\/?$/, '')}/tasks/${taskId}`,
            `${finalBaseUrl.replace(/\/$/, '')}/tasks/${taskId}`,
            `https://api-inference.modelscope.cn/v1/tasks/${taskId}`,
            `https://api-inference.modelscope.cn/tasks/${taskId}`,
            `https://api-inference.modelscope.ai/v1/tasks/${taskId}`,
            `https://api-inference.modelscope.ai/tasks/${taskId}`,
            `https://api-inference.modelscope.cn/api/v1/tasks/${taskId}`
          ];
          appendLog(`[ModelScope] Candidates for polling task status: ${JSON.stringify(candidates)}`);

          let completed = false;
          let attempts = 0;
          const maxAttempts = 12; // 12 attempts * 2s = 24s, preventing HTTP reverse proxy / browser 504 gateway timeouts
          let consecutiveFailures = 0;

          while (!completed && attempts < maxAttempts) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 2000));

            try {
              appendLog(`[ModelScope] Polling attempt ${attempts}/${maxAttempts}`);
              let taskResponse: any = null;
              let fetchedStatus = '';
              let fetchErrorMsg = '';
              let isTaskNotFound = false;

              for (const candidateUrl of candidates) {
                try {
                  appendLog(`[ModelScope] Requesting candidateUrl: ${candidateUrl}`);
                  
                  // Try first with Bearer prefix, standard custom headers, and direct custom headers
                  let res = null;
                  try {
                    res = await axios.get(candidateUrl, {
                      headers: { 
                        'Authorization': `Bearer ${apiKey}`,
                        'X-ModelScope-Token': apiKey,
                        'X-DashScope-ApiKey': apiKey,
                        'Content-Type': 'application/json'
                      },
                      timeout: 8000
                    });
                  } catch (firstErr: any) {
                    appendLog(`[ModelScope] First token attempt failed on ${candidateUrl}: ${firstErr.message}. Trying direct token fallback...`);
                    // Try fallback without Bearer prefix as some proxies reject 'Bearer ' on custom endpoints or mismatch
                    res = await axios.get(candidateUrl, {
                      headers: { 
                        'Authorization': apiKey,
                        'X-ModelScope-Token': apiKey,
                        'X-DashScope-ApiKey': apiKey,
                        'Content-Type': 'application/json'
                      },
                      timeout: 8000
                    });
                  }

                  const errors = res.data.errors || res.data.error;
                  if (errors && (JSON.stringify(errors).toLowerCase().includes('not found') || JSON.stringify(errors).toLowerCase().includes('notfound'))) {
                    appendLog(`[ModelScope] Candidate ${candidateUrl} returned not found errors: ${JSON.stringify(errors)}`);
                    isTaskNotFound = true;
                    continue; // Skip and try next candidate
                  }

                  const taskStatus = res.data.output?.task_status || res.data.task_status || res.data.status;
                  if (taskStatus) {
                    taskResponse = res;
                    fetchedStatus = taskStatus;
                    appendLog(`[ModelScope] Success fetch from ${candidateUrl}. Status: ${taskStatus}`);
                    break;
                  }
                } catch (candidateErr: any) {
                  const errMsg = candidateErr?.response?.data ? JSON.stringify(candidateErr.response.data) : candidateErr.message;
                  appendLog(`[ModelScope] Fetch candidate URL error on ${candidateUrl}: ${errMsg}`);
                  if (errMsg.toLowerCase().includes('task not found') || errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('invalidapikey')) {
                    isTaskNotFound = true;
                  }
                  fetchErrorMsg = errMsg;
                }
              }

              if (!taskResponse) {
                consecutiveFailures++;
                appendLog(`[ModelScope] All candidate URLs failed to resolve task ${taskId} at attempt ${attempts}. Consecutive failures: ${consecutiveFailures}. Last error message: ${fetchErrorMsg}`);
                
                if (isTaskNotFound && consecutiveFailures >= 3) {
                  const isLoraEnabled = !!(lora && lora.enabled);
                  const activeModel = payload.model || 'Tongyi-MAI/Z-Image-Turbo';
                  const isDashScopeProxied = activeModel.toLowerCase().includes('tongyi') || activeModel.toLowerCase().includes('qwen') || activeModel.toLowerCase().includes('wanx');
                  
                  let errorMsg = `图片生成失败：ModelScope 接口无法查询到该异步生图结果 (任务ID: ${taskId})。\n\n【原因与排查】\n`;
                  
                  if (isLoraEnabled) {
                    errorMsg += `1. 您当前启用了 [LoRA] 微调。魔搭社区版 API 接口对配置了微调的生图任务不支持常规异步状态和结果查询。\n`;
                  } else if (isDashScopeProxied && isModelScope) {
                    errorMsg += `1. 您当前选择的模型为 [阿里通义/万相托管模型] (「${activeModel}」)。此类模型提交后，魔搭网关会将任务交由阿里云后台处理，但社区版极简 Token 目前不具备阿里云异步任务的查询权限 (系统会反馈 500 task not found 错误)。\n`;
                  } else {
                    errorMsg += `1. 请求已成功到达托管网关，但网关反馈 500 task not found，通常是因为高负载下或第三方镜像任务在瞬间完成后被自动清理，导致状态无法轮询。\n`;
                  }
                  
                  errorMsg += `\n【推荐解决方案】\n` +
                              `➡️ **推荐方案 A (最稳定且免费)**：在节点下方或侧边设置中，将生图模型更换为魔搭原生极高稳定性的同步免轮询模型，例如 **\`black-forest-labs/FLUX.2-klein-9B\`** (FLUX模型)。此类原生模型可直接在首次请求中秒级同步返回精美生图，不依赖后台轮询，极其稳定高效！\n` +
                              `➡️ **推荐方案 B (启用万相 & LoRA)**：如果您必须对「${activeModel}」进行生图或配合 LoRA 微调，建议在系统全局密钥配置中，获取并改用正式的 **阿里云 DashScope API-KEY (以 \`sk-\` 开头)**，并将自定义 Base URL 替换为通义官方端点，选择 DashScope 服务，即可完美启用完整的异步画图及微调生态！`;
                  
                  if (isLoraEnabled) {
                    errorMsg += `\n➡️ **推荐方案 C**：在生成节点下方关闭 [启用 LoRA] 复选框，然后点击重新生成进行排查。`;
                  }
                  
                  throw new Error(errorMsg);
                }
                continue; // retry next main poll loop attempt
              }

              // Reset on active response success
              consecutiveFailures = 0;
              appendLog(`[ModelScope] Selected polling response data: ${JSON.stringify(taskResponse.data)}`);

              if (fetchedStatus === 'SUCCEEDED' || fetchedStatus === 'SUCCESS') {
                completed = true;
                urls = extractImageUrls(taskResponse.data);
                if (urls.length === 0) {
                  urls = taskResponse.data.output?.results?.map((r: any) => r.url).filter(Boolean) || [];
                }
                appendLog(`[ModelScope] Polling Succeeded. URLs: ${JSON.stringify(urls)}`);
              } else if (fetchedStatus === 'FAILED' || fetchedStatus === 'REJECTED') {
                completed = true;
                const taskErr = taskResponse.data.output?.message || taskResponse.data.message || 'ModelScope task failed';
                appendLog(`[ModelScope] Polling returned failed task status: ${fetchedStatus}, msg: ${taskErr}`);
                throw new Error(taskErr);
              }
            } catch (pollErr: any) {
              const pollErrMsg = pollErr?.response?.data ? JSON.stringify(pollErr.response.data) : pollErr.message;
              appendLog(`[ModelScope] Error during polling attempt ${attempts}: ${pollErrMsg}`);
              if (pollErr.message && !pollErr.message.includes('timeout') && !pollErr.message.includes('not found')) {
                throw pollErr;
              }
            }
          }

          if (!completed) {
            appendLog(`[ModelScope] Polling timed out (limit reached)`);
            throw new Error('ModelScope image generation task timed out on the upstream server (limit reached)');
          }
        } else {
          appendLog(`[ModelScopeSync] Already have URLs or no taskId. Output URLs: ${JSON.stringify(urls)}`);
        }

        console.log(`[ModelScope] Image extraction completed successfully. Extracted URLs count: ${urls.length}`);
        appendLog(`[ModelScope] Output result urls: ${JSON.stringify(urls)}`);
        return res.json({ urls });
      } else if (engine === 'gemini') {
        let finalBaseUrl = (baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
        if (finalBaseUrl.endsWith('/v1beta')) {
          finalBaseUrl = finalBaseUrl.slice(0, -7);
        }
        let geminiModel = 'imagen-3.0-generate-001';
        if (modelId && modelId.startsWith('imagen-')) {
          geminiModel = modelId;
        }
        const url = `${finalBaseUrl}/v1beta/models/${geminiModel}:predict?key=${apiKey}`;
        
        let aspectRatio = '1:1';
        if (size) {
            const aspectStr = size.split(' ')[0];
            if (['1:1', '4:3', '3:4', '16:9', '9:16'].includes(aspectStr)) {
                aspectRatio = aspectStr;
            } else if (aspectStr === '4:5') {
                aspectRatio = '3:4'; // Fallback for unsupported ratios
            }
        }

        const response = await axios.post(url, {
          instances: [
            { prompt: prompt }
          ],
          parameters: {
            sampleCount: parseInt(n) || 1,
            aspectRatio: aspectRatio
          }
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        // The response format for imagen-3 prediction:
        // { predictions: [ { mimeType: "image/jpeg", bytesBase64: "..." }, ... ] }
        const urls = response.data.predictions?.map((p: any) => `data:${p.mimeType || 'image/jpeg'};base64,${p.bytesBase64}`) || [];
        return res.json({ urls });
      } else {
        let finalBaseUrl = (baseUrl || 'https://api.openai.com/v1').trim().replace(/\/$/, '');
        if (finalBaseUrl.endsWith('/images/generations')) {
          finalBaseUrl = finalBaseUrl.slice(0, -'/images/generations'.length);
        } else if (finalBaseUrl.endsWith('/images/edits')) {
          finalBaseUrl = finalBaseUrl.slice(0, -'/images/edits'.length);
        } else if (finalBaseUrl.endsWith('/images')) {
          finalBaseUrl = finalBaseUrl.slice(0, -'/images'.length);
        }
        finalBaseUrl = finalBaseUrl.replace(/\/$/, '');
        
        const modelLower = String(modelId || '').toLowerCase();
        const isDallE3 = modelLower.includes('dall-e-3');
        const isDallE2 = modelLower.includes('dall-e-2') || (modelLower.includes('dall') && !isDallE3);

        let mappedSize = size || '1024x1024';
        if (mappedSize === '自动' || mappedSize === 'Auto' || !mappedSize) {
          mappedSize = '1024x1024';
        } else if (mappedSize === '1:1') {
          mappedSize = '1024x1024';
        } else if (mappedSize === '16:9') {
          mappedSize = isDallE3 ? '1792x1024' : '1024x576';
        } else if (mappedSize === '9:16') {
          mappedSize = isDallE3 ? '1024x1792' : '576x1024';
        } else if (mappedSize === '4:3') {
          mappedSize = '1024x768';
        } else if (mappedSize === '3:4') {
          mappedSize = '768x1024';
        } else if (mappedSize === '3:2') {
          mappedSize = '1536x1024';
        } else if (mappedSize === '2:3') {
          mappedSize = '1024x1536';
        } else if (mappedSize === '21:9') {
          mappedSize = '2048x858';
        }

        // For DALL-E-3, force standard resolutions for parameters safety
        if (isDallE3) {
          if (!['1024x1024', '1792x1024', '1024x1792'].includes(mappedSize)) {
            mappedSize = '1024x1024';
          }
        } else if (isDallE2) {
          if (!['1024x1024', '512x512', '256x256'].includes(mappedSize)) {
            mappedSize = '1024x1024';
          }
        }

        // Filter and normalize quality values to match model compliance
        let finalQuality: string | undefined = undefined;
        if (quality && quality !== 'auto') {
          if (isDallE3) {
            if (quality === 'standard' || quality === 'hd') {
              finalQuality = quality;
            }
          } else if (isDallE2) {
            finalQuality = undefined;
          } else {
            finalQuality = quality;
          }
        }

        // Custom parameters formatting safety (ignore on standard DALL-E)
        let finalFormat: string | undefined = undefined;
        if (format && format !== 'auto' && !isDallE3 && !isDallE2) {
          finalFormat = format;
        }

        let finalBackground: string | undefined = undefined;
        if (background && background !== 'auto' && !background.includes('auto') && !isDallE3 && !isDallE2) {
          finalBackground = background;
        }

        let finalModeration: string | undefined = undefined;
        if (moderation && moderation !== 'auto' && !isDallE3 && !isDallE2) {
          finalModeration = moderation;
        }
        
        if (opMode === 'edits') {
          const url = `${finalBaseUrl}/images/edits`;
          const form = new FormData();
          form.append('model', modelId || 'gpt-image-2');
          form.append('prompt', prompt || '');
          form.append('n', parseInt(n) || 1);
          form.append('size', mappedSize);
          if (finalQuality) form.append('quality', finalQuality);
          if (finalFormat) form.append('format', finalFormat);
          if (finalBackground) form.append('background', finalBackground);
          if (finalModeration) form.append('moderation', finalModeration);

          if (images && Array.isArray(images) && images.length > 0) {
            for (let i = 0; i < images.length; i++) {
              const imageStr = images[i];
              if (!imageStr) continue;
              try {
                if (imageStr.startsWith('data:')) {
                  const matches = imageStr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                  if (matches && matches.length === 3) {
                    const mime = matches[1];
                    const buffer = Buffer.from(matches[2], 'base64');
                    let ext = 'png';
                    if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpeg';
                    else if (mime.includes('webp')) ext = 'webp';
                    form.append('image', buffer, { filename: `file_${i}.${ext}`, contentType: mime });
                  }
                } else {
                  let downloadUrl = imageStr;
                  if (imageStr.startsWith('/')) {
                    downloadUrl = `http://localhost:3000${imageStr}`;
                    appendLog(`[Image Edit Fetch] Client-relative path detected. Normalizing source target to self: ${downloadUrl}`);
                  }
                  if (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')) {
                    appendLog(`[Image Edit Fetch] Downloading ${downloadUrl}`);
                    const imgRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(imgRes.data);
                    const contentType = String(imgRes.headers['content-type'] || 'image/png');
                    let ext = 'png';
                    if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpeg';
                    else if (contentType.includes('webp')) ext = 'webp';
                    form.append('image', buffer, { filename: `file_${i}.${ext}`, contentType });
                  }
                }
              } catch (imgErr: any) {
                appendLog(`[Image Edit Fetch Error] Failed to process image index ${i}: ${imgErr.message}`);
              }
            }
          }

          appendLog(`[Image Edit Request] URL: ${url}, Model: ${modelId}, Size: ${mappedSize}`);
          const response = await axios.post(url, form, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              ...form.getHeaders()
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 240000
          });

          const parseImageResponse = (responseData: any): string[] => {
            if (!responseData) return [];
            appendLog(`[Image API Success] Response keys: ${Object.keys(responseData)}`);
            appendLog(`[Image API Success] Response preview: ${JSON.stringify(responseData).substring(0, 1000)}`);

            let extractedUrls: string[] = [];

            // 1. Try to find from standard pathways: data, images, results, output
            const arraysToTry = [
              responseData.data,
              responseData.images,
              responseData.results,
              responseData.output?.results,
              responseData.output
            ];

            for (const item of arraysToTry) {
              if (Array.isArray(item)) {
                const parsed = item.map((d: any) => {
                  if (typeof d === 'string') {
                    if (d.startsWith('http://') || d.startsWith('https://') || d.startsWith('data:')) {
                      return d;
                    }
                    if (d.length > 50) { // likely raw base64 data
                      return d.startsWith('data:') ? d : `data:image/png;base64,${d}`;
                    }
                    return null;
                  }
                  if (d && typeof d === 'object') {
                    if (d.url) return d.url;
                    if (d.b64_json) {
                      return d.b64_json.startsWith('data:') ? d.b64_json : `data:image/png;base64,${d.b64_json}`;
                    }
                    if (d.image) return d.image;
                    if (d.base64) {
                      return d.base64.startsWith('data:') ? d.base64 : `data:image/png;base64,${d.base64}`;
                    }
                  }
                  return null;
                }).filter(Boolean) as string[];

                if (parsed.length > 0) {
                  extractedUrls = parsed;
                  break;
                }
              }
            }

            // 2. Fallback to generic URL deep scanning
            if (extractedUrls.length === 0) {
              const scannedFromKeys = extractImageUrls(responseData);
              if (scannedFromKeys.length > 0) {
                extractedUrls = scannedFromKeys;
              }
            }

            // 3. Fallback to raw base64 check inside keys if nothing else worked
            if (extractedUrls.length === 0) {
              if (typeof responseData === 'string' && responseData.length > 1000) {
                extractedUrls = [responseData.startsWith('data:') ? responseData : `data:image/png;base64,${responseData}`];
              } else if (responseData && typeof responseData === 'object') {
                const checkedKeys = ['b64_json', 'base64', 'image', 'url'];
                for (const key of checkedKeys) {
                  if (typeof responseData[key] === 'string' && responseData[key].length > 10) {
                    const content = responseData[key];
                    if (content.startsWith('http://') || content.startsWith('https://')) {
                      extractedUrls = [content];
                      break;
                    } else if (content.length > 100) {
                      extractedUrls = [content.startsWith('data:') ? content : `data:image/png;base64,${content}`];
                      break;
                    }
                  }
                }
              }
            }

            appendLog(`[Parser Result] Extracted URLs count: ${extractedUrls.length}. Previews: ${extractedUrls.map(u => u.substring(0, 80) + '...').join(', ')}`);
            return extractedUrls;
          };

          const urls = parseImageResponse(response.data);
          const savedUrls = await Promise.all(urls.map(u => saveImageToHistory(u)));
          return res.json({ urls: savedUrls });
        } else {
          const url = `${finalBaseUrl}/images/generations`;
          
          const payload: any = {
            prompt: prompt,
            model: modelId || 'dall-e-3',
            n: parseInt(n) || 1,
            size: mappedSize
          };
          if (finalQuality) {
             payload.quality = finalQuality;
          }

          appendLog(`[Image Gen Request] URL: ${url}, Model: ${payload.model}, Size: ${payload.size}`);
          const response = await axios.post(url, payload, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 240000
          });

          const parseImageResponse = (responseData: any): string[] => {
            if (!responseData) return [];
            appendLog(`[Image API Success] Response keys: ${Object.keys(responseData)}`);
            appendLog(`[Image API Success] Response preview: ${JSON.stringify(responseData).substring(0, 1000)}`);

            let extractedUrls: string[] = [];

            // 1. Try to find from standard pathways: data, images, results, output
            const arraysToTry = [
              responseData.data,
              responseData.images,
              responseData.results,
              responseData.output?.results,
              responseData.output
            ];

            for (const item of arraysToTry) {
              if (Array.isArray(item)) {
                const parsed = item.map((d: any) => {
                  if (typeof d === 'string') {
                    if (d.startsWith('http://') || d.startsWith('https://') || d.startsWith('data:')) {
                      return d;
                    }
                    if (d.length > 50) { // likely raw base64 data
                      return d.startsWith('data:') ? d : `data:image/png;base64,${d}`;
                    }
                    return null;
                  }
                  if (d && typeof d === 'object') {
                    if (d.url) return d.url;
                    if (d.b64_json) {
                      return d.b64_json.startsWith('data:') ? d.b64_json : `data:image/png;base64,${d.b64_json}`;
                    }
                    if (d.image) return d.image;
                    if (d.base64) {
                      return d.base64.startsWith('data:') ? d.base64 : `data:image/png;base64,${d.base64}`;
                    }
                  }
                  return null;
                }).filter(Boolean) as string[];

                if (parsed.length > 0) {
                  extractedUrls = parsed;
                  break;
                }
              }
            }

            // 2. Fallback to generic URL deep scanning
            if (extractedUrls.length === 0) {
              const scannedFromKeys = extractImageUrls(responseData);
              if (scannedFromKeys.length > 0) {
                extractedUrls = scannedFromKeys;
              }
            }

            // 3. Fallback to raw base64 check inside keys if nothing else worked
            if (extractedUrls.length === 0) {
              if (typeof responseData === 'string' && responseData.length > 1000) {
                extractedUrls = [responseData.startsWith('data:') ? responseData : `data:image/png;base64,${responseData}`];
              } else if (responseData && typeof responseData === 'object') {
                const checkedKeys = ['b64_json', 'base64', 'image', 'url'];
                for (const key of checkedKeys) {
                  if (typeof responseData[key] === 'string' && responseData[key].length > 10) {
                    const content = responseData[key];
                    if (content.startsWith('http://') || content.startsWith('https://')) {
                      extractedUrls = [content];
                      break;
                    } else if (content.length > 100) {
                      extractedUrls = [content.startsWith('data:') ? content : `data:image/png;base64,${content}`];
                      break;
                    }
                  }
                }
              }
            }

            appendLog(`[Parser Result] Extracted URLs count: ${extractedUrls.length}. Previews: ${extractedUrls.map(u => u.substring(0, 80) + '...').join(', ')}`);
            return extractedUrls;
          };

          const urls = parseImageResponse(response.data);
          const savedUrls = await Promise.all(urls.map(u => saveImageToHistory(u)));
          return res.json({ urls: savedUrls });
        }
      }
    } catch (error: any) {
      const errDetails = error?.response?.data ? (typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : String(error.response.data)) : error.message;
      appendLog(`[Image API Error] Details: ${errDetails}`);
      console.error('Image API Error:', error?.response?.data || error.message);
      
      let errMsg = '';
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        errMsg = `中转接口通道超时 (Timeout of 4 minutes reached)。请确认您连接的第三方中转 API (如 yuli.host) 实际渲染耗时或通道排队情况。`;
      } else {
        errMsg = error?.response?.data?.error?.message || error?.response?.data?.error || error.message || 'Unknown API Error';
      }
      
      res.status(500).json({ error: typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg) });
    }
  });

  // API Connection Tester for verification
  app.post('/api/test-connection', async (req, res) => {
    const { engine, baseUrl, apiKey, modelId, modelUrl } = req.body;

    if (!apiKey) {
      return res.status(200).json({ ok: false, error: 'API 密钥为空，请输入 API 密钥后再测试。' });
    }

    try {
      if (engine === 'gemini') {
        let finalBaseUrl = (baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
        if (finalBaseUrl.endsWith('/v1beta')) {
          finalBaseUrl = finalBaseUrl.slice(0, -7);
        }
        const url = `${finalBaseUrl}/v1beta/models?key=${apiKey}`;
        const response = await axios.get(url, { timeout: 8000 });
        if (response.status === 200) {
          return res.json({ ok: true });
        } else {
          return res.json({ ok: false, error: `Http Code: ${response.status}` });
        }
      } else {
        let finalBaseUrl = (baseUrl || 'https://api.openai.com/v1').trim().replace(/\/$/, '');
        if (finalBaseUrl.endsWith('/images/generations')) {
          finalBaseUrl = finalBaseUrl.slice(0, -'/images/generations'.length);
        } else if (finalBaseUrl.endsWith('/images')) {
          finalBaseUrl = finalBaseUrl.slice(0, -'/images'.length);
        }
        finalBaseUrl = finalBaseUrl.replace(/\/$/, '');

        // Check if this is a ModelScope models list request
        const isModelScopeList = (engine === 'modelscope');

        if (isModelScopeList) {
          const finalModelUrl = modelUrl || `${finalBaseUrl}/models`;
          appendLog(`[ModelScope Test Connection] GET request to modelUrl: ${finalModelUrl}`);
          try {
            const response = await axios.get(finalModelUrl, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            });
            if (response.status === 200 || response.status === 201) {
              const count = response.data?.data?.length || 0;
              appendLog(`[ModelScope Test Connection] Success! Found ${count} models.`);
              return res.json({ ok: true, count, models: response.data?.data || [] });
            } else {
              return res.json({ ok: false, error: `模型列表获取失败: Http Code ${response.status}` });
            }
          } catch (modelErr: any) {
            const errMsg = modelErr?.response?.data ? JSON.stringify(modelErr.response.data) : modelErr.message;
            appendLog(`[ModelScope Test Connection] Models endpoint failed: ${errMsg}`);
            return res.json({
              ok: false,
              error: `模型接入测试失败: ${modelErr?.response?.data?.error?.message || modelErr?.response?.data?.error || modelErr.message || '未知异常'}。
💡 建议配置国内/海外「平台模型获取地址」并确认联网正常后再次尝试！`
            });
          }
        }

        // Standard OpenAI-compatible testing: Try GET /models first (most safe, free, and supports image-only keys/scopes)
        let testOk = false;
        let testError = '';

        try {
          appendLog(`[Test Connection] Attempting models list test: GET ${finalBaseUrl}/models`);
          const modelsRes = await axios.get(`${finalBaseUrl}/models`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: 6000
          });
          if (modelsRes.status === 200 || modelsRes.status === 201) {
            appendLog(`[Test Connection] Models list test succeeded!`);
            return res.json({ ok: true });
          }
        } catch (modelsErr: any) {
          const details = modelsErr?.response?.data ? JSON.stringify(modelsErr.response.data) : modelsErr.message;
          appendLog(`[Test Connection] Models list test failed (expected for some narrow-scope keys or proxy routing): ${details}`);
          testError = modelsErr?.response?.data?.error?.message || modelsErr?.response?.data?.error || modelsErr.message;
        }

        // Fallback to image generation or chat completion test if models list was rejected or unsupported
        const isImageOnlyModel = modelId && (
          modelId.toLowerCase().includes('image') ||
          modelId.toLowerCase().includes('dall') ||
          modelId.toLowerCase().includes('sd_') ||
          modelId.toLowerCase().includes('sdxl') ||
          modelId.toLowerCase().includes('flux') ||
          modelId.toLowerCase().includes('midjourney')
        );

        if (isImageOnlyModel) {
          const url = `${finalBaseUrl}/images/generations`;
          const payload = {
            model: modelId || 'gpt-image-2',
            prompt: 'a simple design dot',
            n: 1,
            size: '1024x1024'
          };
          appendLog(`[Test Connection] Image-only model detected. Trying image generation test: POST ${url}`);
          try {
            const imgRes = await axios.post(url, payload, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            });
            if (imgRes.status === 200 || imgRes.status === 201) {
              appendLog(`[Test Connection] Image generation test succeeded!`);
              return res.json({ ok: true });
            } else {
              return res.json({ ok: false, error: `Http Code: ${imgRes.status}` });
            }
          } catch (imgErr: any) {
            const details = imgErr?.response?.data ? JSON.stringify(imgErr.response.data) : imgErr.message;
            appendLog(`[Test Connection] Image generation test failed: ${details}`);
            const errMsg = imgErr?.response?.data?.error?.message || imgErr?.response?.data?.error || imgErr.message;
            return res.json({ ok: false, error: `图像生成测试失败: ${typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg}` });
          }
        } else {
          const testModel = modelId || 'gpt-3.5-turbo';
          const url = `${finalBaseUrl}/chat/completions`;
          const payload = {
            model: testModel,
            messages: [{ role: 'user', content: 'test connection' }],
            max_tokens: 1
          };

          appendLog(`[Test Connection] Fallback to chat completion: POST ${url} with model ${testModel}`);
          const response = await axios.post(url, payload, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 8000
          });

          if (response.status === 200 || response.status === 201) {
            appendLog(`[Test Connection] Chat completions test succeeded!`);
            return res.json({ ok: true });
          } else {
            return res.json({ ok: false, error: `Http Code: ${response.status} (Models endpoint error: ${testError})` });
          }
        }
      }
    } catch (error: any) {
      console.error('Connection Test Error:', error?.response?.data || error.message);
      const errMsg = error?.response?.data?.error?.message 
        || error?.response?.data?.error 
        || error.message 
        || '连接异常，请检查 Base URL & API Key 或网络连通性。';
      return res.json({ 
        ok: false, 
        error: typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg 
      });
    }
  });

  // API debug logs endpoint to view server-side logs during development
  app.get('/api/debug-logs', (req, res) => {
    try {
      const logPath = path.join(__dirname, 'app_logs.txt');
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        return res.send(`
          <html>
            <head><title>App Server Debug Logs</title></head>
            <body style="margin:0; background:#121212;">
              <pre style="font-family: monospace; white-space: pre-wrap; font-size: 13px; color: #00ff00; padding: 20px; line-height: 1.5;">${content}</pre>
            </body>
          </html>
        `);
      } else {
        return res.send(`No logs generated yet. Log path: ${logPath}`);
      }
    } catch (err: any) {
      return res.status(500).send(`Error reading logs: ${err.message}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
