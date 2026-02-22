Set WshShell = WScript.CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
Set oShellLink = WshShell.CreateShortcut(strDesktop & "\Calculadora Mod 40.lnk")
oShellLink.TargetPath = "C:\modalidad 10\iniciar.bat"
oShellLink.WorkingDirectory = "C:\modalidad 10"
oShellLink.IconLocation = "shell32.dll,13"
oShellLink.Description = "Calculadora Modalidad 40 IMSS"
oShellLink.Save
WScript.Echo "Acceso directo creado: Calculadora Mod 40"
