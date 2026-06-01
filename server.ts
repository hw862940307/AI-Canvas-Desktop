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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

const isLocalUrl = (url: string) => {
  if (!url) return true; // Treat empty as local/invalid
  const normalized = url.toLowerCase().trim();
  return normalized.includes('127.0.0.1') || 
         normalized.includes('localhost') || 
         normalized.startsWith('http://192.168.') || 
         normalized.startsWith('http://10.') ||
         normalized.startsWith('http://172.');
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
    const { engine, baseUrl, apiKey, modelId, prompt, size, n, quality } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is missing' });
    }

    try {
      if (engine === 'gemini') {
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
        const finalBaseUrl = baseUrl || 'https://api.openai.com/v1';
        const url = `${finalBaseUrl.replace(/\/$/, '')}/images/generations`;
        
        const payload: any = {
          prompt: prompt,
          model: modelId || 'dall-e-3',
          n: parseInt(n) || 1,
          size: size || '1024x1024'
        };
        if (quality) {
           payload.quality = quality;
        }

        const response = await axios.post(url, payload, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        // Map through all returned data objects and extract URLs
        const urls = response.data.data?.map((d: any) => d.url) || [];
        return res.json({ urls });
      }
    } catch (error: any) {
      console.error('Image API Error:', error?.response?.data || error.message);
      const errMsg = error?.response?.data?.error?.message || error?.response?.data?.error || error.message || 'Unknown API Error';
      res.status(500).json({ error: typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg });
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
