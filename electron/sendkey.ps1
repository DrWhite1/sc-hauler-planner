param([int]$vk)

try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class KInput {
  [DllImport("user32.dll", SetLastError=true)]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

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
  public struct MOUSEINPUT {
    public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT {
    public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
  }
}
"@

  $down = New-Object KInput+INPUT
  $down.type = 1
  $down.U.ki.wVk = $vk

  $up = New-Object KInput+INPUT
  $up.type = 1
  $up.U.ki.wVk = $vk
  $up.U.ki.dwFlags = 2

  $size = [System.Runtime.InteropServices.Marshal]::SizeOf([type][KInput+INPUT])
  $result = [KInput]::SendInput(2, @($down, $up), $size)
  Write-Output "sent $result"
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
