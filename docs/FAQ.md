## Can’t connect to localhost Win10 server with Minecraft Win10 Edition

This issue occurs due to loopback restrictions on Windows 10 UWP apps. To lift this restriction, launch Windows PowerShell as an administrator and run the following:

```ps
CheckNetIsolation LoopbackExempt -a -n="Microsoft.MinecraftUWP_8wekyb3d8bbwe"
```
## Kicked during login

Some servers can kick you if you don't set `authTitle` as explained in the README. 