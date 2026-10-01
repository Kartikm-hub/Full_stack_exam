# windowsWorker.ps1 — Background Win32 window management worker for Focus Mode Agent
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WinFocusCore {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    public const int SW_HIDE = 0;
    public const int SW_SHOWNORMAL = 1;
    public const int SW_SHOWMINIMIZED = 2;
    public const int SW_MAXIMIZE = 3;
    public const int SW_SHOW = 5;
    public const int SW_MINIMIZE = 6;
    public const int SW_SHOWMINNOACTIVE = 7;
    public const int SW_RESTORE = 9;
    public const int SW_FORCEMINIMIZE = 11;

    public const uint WM_SYSCOMMAND = 0x0112;
    public static readonly IntPtr SC_MINIMIZE = new IntPtr(0xF020);
    public static readonly IntPtr SC_RESTORE = new IntPtr(0xF120);

    public class WindowEntry {
        public long Hwnd;
        public uint Pid;
        public string ProcessName;
        public string Title;
        public bool IsMinimized;
    }

    public static List<WindowEntry> GetWindows() {
        var list = new List<WindowEntry>();
        EnumWindowsProc callback = (hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;

            int exStyle = GetWindowLong(hWnd, -20); // GWL_EXSTYLE
            if ((exStyle & 0x00000080) != 0) return true; // WS_EX_TOOLWINDOW

            StringBuilder sb = new StringBuilder(512);
            GetWindowText(hWnd, sb, 512);
            string title = sb.ToString().Trim();
            if (string.IsNullOrEmpty(title)) return true;

            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            string proc = "";
            try {
                proc = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName;
            } catch {}

            list.Add(new WindowEntry {
                Hwnd = hWnd.ToInt64(),
                Pid = pid,
                ProcessName = proc,
                Title = title,
                IsMinimized = IsIconic(hWnd)
            });
            return true;
        };

        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) {
            EnumDesktopWindows(hDesk, callback, IntPtr.Zero);
            CloseDesktop(hDesk);
        } else {
            EnumWindows(callback, IntPtr.Zero);
        }
        return list;
    }

    public static bool ExecuteOnWindow(long targetHwnd, string action) {
        IntPtr target = new IntPtr(targetHwnd);
        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        bool success = false;

        EnumWindowsProc callback = (hWnd, lParam) => {
            if (hWnd == target) {
                if (action == "minimize") {
                    ShowWindow(hWnd, SW_FORCEMINIMIZE);
                    PostMessage(hWnd, WM_SYSCOMMAND, SC_MINIMIZE, IntPtr.Zero);
                    success = true;
                } else if (action == "restore") {
                    PostMessage(hWnd, WM_SYSCOMMAND, SC_RESTORE, IntPtr.Zero);
                    ShowWindow(hWnd, SW_RESTORE);
                    success = true;
                } else if (action == "activate") {
                    PostMessage(hWnd, WM_SYSCOMMAND, SC_RESTORE, IntPtr.Zero);
                    ShowWindow(hWnd, SW_RESTORE);
                    SetForegroundWindow(hWnd);
                    success = true;
                }
                return false;
            }
            return true;
        };

        if (hDesk != IntPtr.Zero) {
            EnumDesktopWindows(hDesk, callback, IntPtr.Zero);
            CloseDesktop(hDesk);
        } else {
            EnumWindows(callback, IntPtr.Zero);
        }

        if (!success) {
            if (action == "minimize") {
                ShowWindow(target, SW_FORCEMINIMIZE);
                PostMessage(target, WM_SYSCOMMAND, SC_MINIMIZE, IntPtr.Zero);
                success = true;
            } else if (action == "restore") {
                PostMessage(target, WM_SYSCOMMAND, SC_RESTORE, IntPtr.Zero);
                ShowWindow(target, SW_RESTORE);
                success = true;
            } else if (action == "activate") {
                PostMessage(target, WM_SYSCOMMAND, SC_RESTORE, IntPtr.Zero);
                ShowWindow(target, SW_RESTORE);
                SetForegroundWindow(target);
                success = true;
            }
        }

        return success;
    }
}
'@

[Console]::WriteLine("READY")

while ($line = [Console]::ReadLine()) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line -eq "QUIT") { break }

    try {
        $req = $line | ConvertFrom-Json
        $res = @{ id = $req.id; success = $true }

        switch ($req.action) {
            "getWindows" {
                $res.windows = [WinFocusCore]::GetWindows()
            }
            "minimize" {
                $count = 0
                foreach ($h in $req.hwnds) {
                    if ([WinFocusCore]::ExecuteOnWindow([long]$h, "minimize")) {
                        $count++
                    }
                }
                $res.count = $count
            }
            "restore" {
                $count = 0
                foreach ($h in $req.hwnds) {
                    if ([WinFocusCore]::ExecuteOnWindow([long]$h, "restore")) {
                        $count++
                    }
                }
                $res.count = $count
            }
            "restoreByNames" {
                $all = [WinFocusCore]::GetWindows()
                $targetNames = @($req.names | ForEach-Object { "$_".ToLower() })
                $count = 0
                $restored = @()
                foreach ($w in $all) {
                    if (-not $w.IsMinimized) { continue }
                    $pName = $w.ProcessName.ToLower()
                    $tName = $w.Title.ToLower()
                    $matched = $false
                    foreach ($tn in $targetNames) {
                        if ($pName -eq $tn -or $pName.Contains($tn) -or $tn.Contains($pName) -or $tName.Contains($tn)) {
                            $matched = $true
                            break
                        }
                    }
                    if ($matched) {
                        [WinFocusCore]::ExecuteOnWindow([long]$w.Hwnd, "restore")
                        $count++
                        $restored += $w.ProcessName
                    }
                }
                $res.count = $count
                $res.restored = $restored
            }
            "activate" {
                $ok = [WinFocusCore]::ExecuteOnWindow([long]$req.hwnd, "activate")
                $res.activated = $ok
            }
            default {
                $res.success = $false
                $res.error = "Unknown action: " + $req.action
            }
        }
    } catch {
        $res = @{ id = $req.id; success = $false; error = $_.Exception.Message }
    }

    [Console]::WriteLine(($res | ConvertTo-Json -Compress))
}
