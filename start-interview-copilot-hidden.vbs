Set shell = CreateObject("WScript.Shell")

projectDir = "D:\codex\interview-copilot-local"
command = "cmd.exe /c """ & projectDir & "\start-interview-copilot.cmd"""

' 0 = hidden window, False = do not wait
shell.Run command, 0, False
