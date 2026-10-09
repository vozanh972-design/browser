@echo off
title GoLike Auto Login Bridge
cd /d "%~dp0.."
"C:\Users\Admin\AppData\Local\Programs\Python\Python313\Lib\site-packages\playwright\driver\node.exe" "scripts\golike-login.cjs" --open
