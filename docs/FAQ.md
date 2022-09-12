## Can’t connect to localhost Win10 server with Minecraft Win10 Edition

This issue occurs due to loopback restrictions on Windows 10 UWP apps. To lift this restriction, launch Windows PowerShell as an administrator and run the following:

```ps
CheckNetIsolation LoopbackExempt -a -n="Microsoft.MinecraftUWP_8wekyb3d8bbwe"
```

If you are running a preview or beta release, you can run the following command to unlock that version:

```ps
CheckNetIsolation LoopbackExempt -a -n="Microsoft.MinecraftWindowsBeta"
```

If that still doesn't work, you can inspect what Minecraft versions are available on your system with:

```ps
Get-AppxPackage -AllUsers | Where Name -Match ".*Minecraft.*" | Select Name,InstallLocation,PackageFullName
```

Use the PackageFullName field in place of the `Microsoft.MinecraftUWP_8wekyb3d8bbwe` for the command above.

## Kicked during login

Some servers can kick you if you don't set `authTitle` as explained in the README. 
