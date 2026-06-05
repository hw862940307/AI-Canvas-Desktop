using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Net;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace OverlayBindingFramework
{
    // 1. OverlayBinding Structure
    public class Rect
    {
        public int X { get; set; }
        public int Y { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public int Right => X + Width;
        public int Bottom => Y + Height;
    }

    public class OverlayBinding
    {
        public string NodeId { get; set; }
        public IntPtr Hwnd { get; set; }
        public int ProcessId { get; set; }
        public string ProcessName { get; set; } = "";
        public Rect ContentRect { get; set; } = new Rect();
        public bool Visible { get; set; } = true;
        public bool Fullscreen { get; set; } = false;
        public bool Locked { get; set; } = false;
        public bool Headless { get; set; } = true;
    }

    // 2. WindowManager
    public class WindowManager
    {
        public void MoveOverlay(IntPtr hwnd, int x, int y, int width, int height)
        {
            // SWP_NOACTIVATE | SWP_NOZORDER ensures we update position/size smoothly
            // without stealing cursor focus or breaking mouse-drag and canvas loops in the browser.
            SetWindowPos(hwnd, IntPtr.Zero, x, y, width, height, SWP_NOACTIVATE | SWP_NOZORDER | SWP_SHOWWINDOW);
        }

        public void PrepareWindow(IntPtr hwnd, bool headless)
        {
            if (headless && hwnd != IntPtr.Zero)
            {
                try
                {
                    int style = GetWindowLong(hwnd, GWL_STYLE);
                    style |= WS_POPUP;
                    style &= ~WS_CAPTION;
                    style &= ~WS_THICKFRAME;
                    style &= ~WS_MINIMIZEBOX;
                    style &= ~WS_MAXIMIZEBOX;
                    style &= ~WS_SYSMENU;
                    style &= ~WS_DLGFRAME;
                    style &= ~WS_BORDER;
                    SetWindowLong(hwnd, GWL_STYLE, style);

                    int exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
                    exStyle &= ~WS_EX_DLGMODALFRAME;
                    exStyle &= ~WS_EX_CLIENTEDGE;
                    exStyle &= ~WS_EX_STATICEDGE;
                    exStyle &= ~WS_EX_WINDOWEDGE;
                    SetWindowLong(hwnd, GWL_EXSTYLE, exStyle);
                    
                    // Force framework recalculations
                    SetWindowPos(hwnd, IntPtr.Zero, 0, 0, 0, 0, SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
                }
                catch (Exception ex)
                {
                    Console.WriteLine("[WindowManager Prepare Error] " + ex.Message);
                }
            }
        }

        [DllImport("user32.dll", EntryPoint = "GetWindowLong")]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", EntryPoint = "SetWindowLong")]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        [DllImport("user32.dll")]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        private const int GWL_STYLE = -16;
        private const int GWL_EXSTYLE = -20;
        
        private const int WS_POPUP = unchecked((int)0x80000000);
        private const int WS_CAPTION = 0x00C00000;
        private const int WS_THICKFRAME = 0x00040000;
        private const int WS_MINIMIZEBOX = 0x00020000;
        private const int WS_MAXIMIZEBOX = 0x00010000;
        private const int WS_SYSMENU = 0x00080000;
        private const int WS_DLGFRAME = 0x00400000;
        private const int WS_BORDER = 0x00800000;

        private const int WS_EX_DLGMODALFRAME = 0x00000001;
        private const int WS_EX_CLIENTEDGE = 0x00000200;
        private const int WS_EX_STATICEDGE = 0x00010000;
        private const int WS_EX_WINDOWEDGE = 0x00000100;

        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOMOVE = 0x0002;
        private const uint SWP_NOZORDER = 0x0004;
        private const uint SWP_NOACTIVATE = 0x0010;
        private const uint SWP_FRAMECHANGED = 0x0020;
        private const uint SWP_SHOWWINDOW = 0x0040;
    }

    // 3. OverlayManager
    public class OverlayManager
    {
        private readonly Dictionary<string, OverlayBinding> _bindings = new Dictionary<string, OverlayBinding>();

        public IEnumerable<OverlayBinding> Bindings => _bindings.Values;

        public void Register(string nodeId, IntPtr hwnd, int pid, string processName)
        {
            _bindings[nodeId] = new OverlayBinding
            {
                NodeId = nodeId,
                Hwnd = hwnd,
                ProcessId = pid,
                ProcessName = processName
            };
            Console.WriteLine($"[OverlayManager] Registered Node {nodeId} <-> HWND {hwnd.ToString("X")}, PID {pid}, Name {processName}");
        }

        public OverlayBinding Get(string nodeId)
        {
            if (_bindings.TryGetValue(nodeId, out var binding))
                return binding;
            return null;
        }

        public void Unregister(string nodeId)
        {
            if (_bindings.ContainsKey(nodeId))
            {
                _bindings.Remove(nodeId);
                Console.WriteLine($"[OverlayManager] Unregistered Node {nodeId}");
            }
        }
    }

    // 4. ProcessManager
    public class ProcessManager
    {
        public Process Launch(string exe, string args = "")
        {
            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = exe,
                Arguments = args,
                UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Normal
            };
            return Process.Start(psi);
        }
    }

    // 5. HWND Finder (With child processes mapping & Title + Area score-based resolution)
    public class HwndFinder
    {
        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool IsWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
            public int Width => Right - Left;
            public int Height => Bottom - Top;
            public int Area => Width * Height;
        }

        public static IntPtr FindBestWindow(int primaryPid, string defaultProcessName = "")
        {
            string processName = defaultProcessName;
            if (string.IsNullOrEmpty(processName))
            {
                try
                {
                    using (Process p = Process.GetProcessById(primaryPid))
                    {
                        processName = p.ProcessName;
                    }
                }
                catch {}
            }

            // Collect target Process IDs
            HashSet<uint> targetPids = new HashSet<uint>();
            if (primaryPid > 0)
            {
                targetPids.Add((uint)primaryPid);
            }

            if (!string.IsNullOrEmpty(processName))
            {
                try
                {
                    Process[] procs = Process.GetProcessesByName(processName);
                    foreach (var p in procs)
                    {
                        targetPids.Add((uint)p.Id);
                    }
                }
                catch {}
            }

            IntPtr bestHwnd = IntPtr.Zero;
            long bestScore = -1;

            EnumWindows((hWnd, lParam) =>
            {
                if (IsWindow(hWnd) && IsWindowVisible(hWnd))
                {
                    GetWindowThreadProcessId(hWnd, out uint windowPid);
                    if (targetPids.Contains(windowPid))
                    {
                        // Get window Title
                        StringBuilder sbTitle = new StringBuilder(512);
                        GetWindowText(hWnd, sbTitle, 512);
                        string title = sbTitle.ToString().Trim();

                        // Get window size
                        RECT rect;
                        GetWindowRect(hWnd, out rect);
                        long area = (long)rect.Width * rect.Height;

                        // Calculate Score (preferring largest visible workspace windows, ignoring tiny utility frames/license bars)
                        long score = area;

                        // Give bonus for standard visible size
                        if (rect.Width > 150 && rect.Height > 150)
                        {
                            score += 10000;
                        }

                        // Priority bonus for non-empty matching window title
                        if (!string.IsNullOrEmpty(title))
                        {
                            score += 50000;

                            string lowerTitle = title.ToLower();
                            if (lowerTitle.Contains("keyshot") || lowerTitle.Contains("blender") || lowerTitle.Contains("photoshop") || lowerTitle.Contains("unreal") || lowerTitle.Contains("unity") || lowerTitle.Contains("painter") || lowerTitle.Contains("designer") || lowerTitle.Contains("houdini") || lowerTitle.Contains("code"))
                            {
                                score += 500000;
                            }
                            if (lowerTitle.Contains("license") || lowerTitle.Contains("loading") || lowerTitle.Contains("splash") || lowerTitle.Contains("updater"))
                            {
                                score -= 300000; 
                            }
                        }

                        if (area > 10000 && score > bestScore)
                        {
                            bestScore = score;
                            bestHwnd = hWnd;
                        }
                    }
                }
                return true; 
            }, IntPtr.Zero);

            return bestHwnd;
        }
    }

    // 6. Overlay Sync Loop (High speed 30FPS coordinate synchronizer with auto-healing checking)
    public class OverlaySyncLoop
    {
        private readonly OverlayManager _manager;
        private readonly WindowManager _windowManager;
        private bool _running = false;

        public OverlaySyncLoop(OverlayManager manager, WindowManager windowManager)
        {
            _manager = manager;
            _windowManager = windowManager;
        }

        public void Start()
        {
            if (_running) return;
            _running = true;
            Task.Run(async () =>
            {
                Console.WriteLine("[OverlaySyncLoop] Active sync thread started.");
                while (_running)
                {
                    try
                    {
                        foreach (var binding in _manager.Bindings)
                        {
                            if (binding.Hwnd != IntPtr.Zero && binding.Visible)
                            {
                                // Auto-healing: Test if HWND was closed or recycled
                                if (HwndFinder.IsWindow(binding.Hwnd))
                                {
                                    var rect = binding.ContentRect;
                                    _windowManager.MoveOverlay(
                                        binding.Hwnd,
                                        rect.X,
                                        rect.Y,
                                        rect.Width,
                                        rect.Height
                                    );
                                }
                                else
                                {
                                    // Let the next /sync restore it dynamically!
                                    binding.Hwnd = IntPtr.Zero;
                                    Console.WriteLine($"[OverlaySyncLoop] Target HWND for NodeId {binding.NodeId} became invalid. Flagged for auto-healing.");
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[OverlaySyncLoop Error] {ex.Message}");
                    }
                    await Task.Delay(33); // 30 FPS coordinate syncing
                }
            });
        }

        public void Stop()
        {
            _running = false;
        }
    }

    // Main Server Console Entry
    public class Program
    {
        private static readonly OverlayManager overlayManager = new OverlayManager();
        private static readonly WindowManager windowManager = new WindowManager();
        private static readonly ProcessManager processManager = new ProcessManager();
        private static OverlaySyncLoop syncLoop;

        public static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.WriteLine("==================================================");
            Console.WriteLine("        NATIVE OVERLAY COORDINATOR ENGINE         ");
            Console.WriteLine("==================================================");

            syncLoop = new OverlaySyncLoop(overlayManager, windowManager);
            syncLoop.Start();

            // Start simple REST API for high precision bindings
            int port = 23300;
            if (args.Length > 0 && int.TryParse(args[0], out int customPort))
            {
                port = customPort;
            }

            string baseUri = $"http://127.0.0.1:{port}/";
            HttpListener listener = new HttpListener();
            listener.Prefixes.Add(baseUri);

            try
            {
                listener.Start();
                Console.WriteLine($"[HTTP Server] Listening on {baseUri}");
                Console.WriteLine("[System Status] Perfect Alignment Sub-pixel Pipeline online.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FATAL] HttpListener start failed: {ex.Message}");
                return;
            }

            Task.Run(() => HandleIncomingRequests(listener));

            Console.WriteLine("Press [ENTER] to exit OverlayHost.");
            Console.ReadLine();

            syncLoop.Stop();
            listener.Stop();
        }

        private static async Task HandleIncomingRequests(HttpListener listener)
        {
            while (listener.IsListening)
            {
                try
                {
                    HttpListenerContext context = await listener.GetContextAsync();
                    HttpListenerRequest req = context.Request;
                    HttpListenerResponse resp = context.Response;

                    // Set CORS headers so the web page can call directly if needed
                    resp.Headers.Add("Access-Control-Allow-Origin", "*");
                    resp.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
                    resp.Headers.Add("Access-Control-Allow-Methods", "POST, GET, OPTIONS");

                    if (req.HttpMethod == "OPTIONS")
                    {
                        resp.StatusCode = (int)HttpStatusCode.OK;
                        resp.Close();
                        continue;
                    }

                    string rawBody = "";
                    using (var reader = new StreamReader(req.InputStream, req.ContentEncoding))
                    {
                        rawBody = await reader.ReadToEndAsync();
                    }

                    string responseJson = "{\"ok\":false,\"error\":\"Not Found\"}";
                    resp.StatusCode = (int)HttpStatusCode.NotFound;

                    if (req.Url.AbsolutePath == "/status")
                    {
                        resp.StatusCode = (int)HttpStatusCode.OK;
                        responseJson = "{\"ok\":true,\"status\":\"ready\",\"msg\":\"OverlayCoordinator is active.\"}";
                    }
                    else if (req.Url.AbsolutePath == "/launch")
                    {
                        // Parse simple JSON: {"appPath": "xxx", "args": "xxx", "nodeId": "xxx", "headless": true}
                        string appPath = ExtractSimpleJsonString(rawBody, "appPath");
                        string launchArgs = ExtractSimpleJsonString(rawBody, "args");
                        string nodeId = ExtractSimpleJsonString(rawBody, "nodeId");
                        bool headless = ExtractSimpleJsonBool(rawBody, "headless", true);

                        Console.WriteLine($"[Launch] Command received for NodeID: {nodeId}");
                        Console.WriteLine($"Path: {appPath}, Args: {launchArgs}");

                        if (string.IsNullOrEmpty(appPath))
                        {
                            responseJson = "{\"ok\":false,\"error\":\"App path is empty\"}";
                            resp.StatusCode = (int)HttpStatusCode.BadRequest;
                        }
                        else
                        {
                            try
                            {
                                Process proc = processManager.Launch(appPath, launchArgs);
                                if (proc == null)
                                {
                                    responseJson = "{\"ok\":false,\"error\":\"Failed to spawn process\"}";
                                    resp.StatusCode = (int)HttpStatusCode.InternalServerError;
                                }
                                else
                                {
                                    string processName = "";
                                    try
                                    {
                                        processName = Path.GetFileNameWithoutExtension(appPath);
                                    }
                                    catch {}

                                    // Wait up to 5 seconds for HWND creation, utilizing FindBestWindow
                                    IntPtr hwnd = IntPtr.Zero;
                                    for (int i = 0; i < 25; i++)
                                    {
                                        hwnd = HwndFinder.FindBestWindow(proc.Id, processName);
                                        if (hwnd != IntPtr.Zero) break;
                                        await Task.Delay(200);
                                    }

                                    if (hwnd == IntPtr.Zero)
                                    {
                                        Console.WriteLine($"[WARN] Could not find HWND automatically. Process PID: {proc.Id}, Name: {processName}. Active mapping registered anyway.");
                                    }

                                    // Register with processName
                                    overlayManager.Register(nodeId, hwnd, proc.Id, processName);
                                    var binding = overlayManager.Get(nodeId);
                                    if (binding != null)
                                    {
                                        binding.Headless = headless;
                                        if (hwnd != IntPtr.Zero)
                                        {
                                            windowManager.PrepareWindow(hwnd, headless);
                                        }
                                    }

                                    responseJson = $"{{\"ok\":true,\"pid\":{proc.Id},\"hwnd\":\"0x{hwnd.ToInt64():X}\",\"message\":\"Launched {Path.GetFileName(appPath)}\"}}";
                                    resp.StatusCode = (int)HttpStatusCode.OK;
                                }
                            }
                            catch (Exception ex)
                            {
                                responseJson = $"{{\"ok\":false,\"error\":\"{EscapeJsonString(ex.Message)}\"}}";
                                resp.StatusCode = (int)HttpStatusCode.InternalServerError;
                            }
                        }
                    }
                    else if (req.Url.AbsolutePath == "/sync")
                    {
                        // Parse simple JSON rect coordinates
                        string nodeId = ExtractSimpleJsonString(rawBody, "nodeId");
                        int rx = ExtractSimpleJsonInt(rawBody, "x");
                        int ry = ExtractSimpleJsonInt(rawBody, "y");
                        int rw = ExtractSimpleJsonInt(rawBody, "width");
                        int rh = ExtractSimpleJsonInt(rawBody, "height");
                        bool headless = ExtractSimpleJsonBool(rawBody, "headless", true);

                        var binding = overlayManager.Get(nodeId);
                        if (binding != null)
                        {
                            binding.ContentRect.X = rx;
                            binding.ContentRect.Y = ry;
                            binding.ContentRect.Width = rw;
                            binding.ContentRect.Height = rh;
                            binding.Headless = headless;

                            // If HWND wasn't resolved initially or became invalid/closed, try dynamic re-check & auto-healing
                            bool needsResolve = binding.Hwnd == IntPtr.Zero || !HwndFinder.IsWindow(binding.Hwnd) || !HwndFinder.IsWindowVisible(binding.Hwnd);
                            if (needsResolve && binding.ProcessId > 0)
                            {
                                IntPtr resolvedHwnd = HwndFinder.FindBestWindow(binding.ProcessId, binding.ProcessName);
                                if (resolvedHwnd != IntPtr.Zero)
                                {
                                    binding.Hwnd = resolvedHwnd;
                                    windowManager.PrepareWindow(resolvedHwnd, binding.Headless);
                                    Console.WriteLine($"[Late-Bind] Dynamic auto-healed HWND resolved for Node ID: {nodeId} -> {resolvedHwnd.ToString("X")}");
                                }
                            }

                            responseJson = "{\"ok\":true}";
                            resp.StatusCode = (int)HttpStatusCode.OK;
                        }
                        else
                        {
                            responseJson = "{\"ok\":false,\"error\":\"Binding not found for NodeId\"}";
                            resp.StatusCode = (int)HttpStatusCode.NotFound;
                        }
                    }
                    else if (req.Url.AbsolutePath == "/stop")
                    {
                        string nodeId = ExtractSimpleJsonString(rawBody, "nodeId");
                        var binding = overlayManager.Get(nodeId);
                        if (binding != null)
                        {
                            try
                            {
                                Process.GetProcessById(binding.ProcessId).Kill();
                            }
                            catch {}
                            overlayManager.Unregister(nodeId);
                            responseJson = "{\"ok\":true,\"message\":\"Process stopped and binding disposed\"}";
                            resp.StatusCode = (int)HttpStatusCode.OK;
                        }
                        else
                        {
                            responseJson = "{\"ok\":false,\"error\":\"No active binding to stop.\"}";
                            resp.StatusCode = (int)HttpStatusCode.NotFound;
                        }
                    }

                    byte[] buf = Encoding.UTF8.GetBytes(responseJson);
                    resp.ContentType = "application/json; charset=utf-8";
                    resp.ContentLength64 = buf.Length;
                    await resp.OutputStream.WriteAsync(buf, 0, buf.Length);
                    resp.Close();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Request ERROR] {ex.Message}");
                }
            }
        }

        // Extremely safe splitter parser to avoid assembly reference issues with JavaScriptSerializer
        private static string ExtractSimpleJsonString(string body, string key)
        {
            string searchKey = $"\"{key}\"";
            int idx = body.IndexOf(searchKey);
            if (idx == -1) return "";

            int colonIdx = body.IndexOf(':', idx);
            if (colonIdx == -1) return "";

            int quoteStart = body.IndexOf('"', colonIdx);
            if (quoteStart == -1) return "";

            int quoteEnd = body.IndexOf('"', quoteStart + 1);
            if (quoteEnd == -1) return "";

            return body.Substring(quoteStart + 1, quoteEnd - quoteStart - 1).Replace("\\\\", "\\").Replace("\\\"", "\"");
        }

        private static int ExtractSimpleJsonInt(string body, string key)
        {
            string searchKey = $"\"{key}\"";
            int idx = body.IndexOf(searchKey);
            if (idx == -1) return 0;

            int colonIdx = body.IndexOf(':', idx);
            if (colonIdx == -1) return 0;

            // Find start of digit
            int valStart = colonIdx + 1;
            while (valStart < body.Length && (char.IsWhiteSpace(body[valStart]) || body[valStart] == '"'))
            {
                valStart++;
            }

            int valEnd = valStart;
            while (valEnd < body.Length && (char.IsDigit(body[valEnd]) || body[valEnd] == '-' || body[valEnd] == '.'))
            {
                valEnd++;
            }

            if (valEnd > valStart)
            {
                string numStr = body.Substring(valStart, valEnd - valStart);
                if (double.TryParse(numStr, out double dVal))
                {
                    return (int)Math.Round(dVal);
                }
            }
            return 0;
        }

        private static bool ExtractSimpleJsonBool(string body, string key, bool defaultVal)
        {
            string searchKey = $"\"{key}\"";
            int idx = body.IndexOf(searchKey);
            if (idx == -1) return defaultVal;

            int colonIdx = body.IndexOf(':', idx);
            if (colonIdx == -1) return defaultVal;

            int valStart = colonIdx + 1;
            while (valStart < body.Length && char.IsWhiteSpace(body[valStart]))
            {
                valStart++;
            }

            if (valStart + 4 <= body.Length && body.Substring(valStart, 4).ToLower() == "true")
                return true;
            if (valStart + 5 <= body.Length && body.Substring(valStart, 5).ToLower() == "false")
                return false;

            return defaultVal;
        }

        private static string EscapeJsonString(string str)
        {
            return str.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
        }
    }
}
