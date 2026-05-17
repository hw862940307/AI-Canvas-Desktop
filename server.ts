import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

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
