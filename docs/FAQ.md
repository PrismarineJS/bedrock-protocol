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

## Replit

Replit may [not support](https://github.com/PrismarineJS/bedrock-protocol/issues/363) the necessary outbound UDP connections required to connect to a Minecraft server. For further assistance using Replit, please contact Replit support or consider using an alternative hosting service if hosting locally is not possible.

Some alternatives:
* [Gitpod](https://www.gitpod.io/)
  * Gitpod is a cloud development environment for teams to efficiently and securely develop software, right from your browser.
* [Github Codespaces](https://github.com/features/codespaces)
  * A Codespace is a developer environment like Gitpod that's hosted in the cloud, accessed in your browser.
* [Google Colab](https://colab.research.google.com/)
  * Google Colab is a Jupyter notebook environment. Jupyter notebook offer a Python environment where you can write, explain, visualize and execute code straight from a web-based developer environment. For more information on using Colab for JavaScript projects, see [Mineflayer on Google Colab](https://colab.research.google.com/github/PrismarineJS/mineflayer/blob/master/docs/mineflayer.ipynb).

## Kicked during login
NOTE: If you not receiving any errors, the error probably logged in debug mode which is not enabled. To enable it, set `process.env.DEBUG = 'minecraft-protocol'` to the top of the file

Some servers can kick you if you don't set `authTitle` as explained in the README. 

## Server clients kicked due to "jwt not active"

The system time is incorrect and needs to be corrected.
