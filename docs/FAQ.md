## Can’t connect to localhost Win10 server with Minecraft Win10 Edition

This issue occurs due to loopback restrictions on Windows 10 UWP apps. To lift this restriction, launch Windows PowerShell as an administrator and run the following:

```ps
CheckNetIsolation LoopbackExempt -a -n="Microsoft.MinecraftUWP_8wekyb3d8bbwe"
```

If you are using a preview release or a tool like [MCMrARM Version Manager](https://github.com/MCMrARM/mc-w10-version-launcher) and are not the standard UWP app you can first locate the binary name with the following command:

```ps
Get-AppxPackage -AllUsers | Where Name -Match ".*Minecraft.*" | Select Name,InstallLocation,PackageFullName
```

Use the PackageFullName field in place of the `Microsoft.MinecraftUWP_8wekyb3d8bbwe` for the command above.

## Kicked during login

Some servers can kick you if you don't set `authTitle` as explained in the README. 
