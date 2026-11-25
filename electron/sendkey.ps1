param([int]$vk)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class GameInput {
  [DllImport("user32.dll")] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  [DllImport("user32.dll")] public static extern uint MapVirtualKey(uint uCode, uint uMapType);

  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT {
    public uint type;
    public InputUnion U;
  }

  [StructLayout(LayoutKind.Explicit)]
  public struct InputUnion {
    [FieldOffset(0)] public MOUSEINPUT mi;
    [FieldOffset(0)] public KEYBDINPUT ki;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }

  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }
}
"@

$scan = [GameInput]::MapVirtualKey($vk, 0)
$size = [System.Runtime.InteropServices.Marshal]::SizeOf([type][GameInput+INPUT])

$down = New-Object GameInput+INPUT
$down.type = 1
$down.U.ki.wScan = $scan
$down.U.ki.dwFlags = 0x0008

$up = New-Object GameInput+INPUT
$up.type = 1
$up.U.ki.wScan = $scan
$up.U.ki.dwFlags = 0x0008 -bor 0x0002

[GameInput]::SendInput(1, @($down), $size) | Out-Null
Start-Sleep -Milliseconds 60
$result = [GameInput]::SendInput(1, @($up), $size)
Write-Output "sent $result scan $scan"
