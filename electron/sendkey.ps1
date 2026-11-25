param([int]$vk)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Input {
  [DllImport("user32.dll")] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  [StructLayout(LayoutKind.Sequential)] public struct INPUT {
    public uint type;
    public InputUnion U;
  }
  [StructLayout(LayoutKind.Explicit)] public struct InputUnion {
    [FieldOffset(0)] public MOUSEINPUT mi;
    [FieldOffset(0)] public KEYBDINPUT ki;
  }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }
}
"@

$down = New-Object Input+INPUT
$down.type = 1
$down.U.ki.wVk = $vk

$up = New-Object Input+INPUT
$up.type = 1
$up.U.ki.wVk = $vk
$up.U.ki.dwFlags = 2

[Input]::SendInput(2, @($down, $up), [System.Runtime.InteropServices.Marshal]::SizeOf([type][Input+INPUT]))
