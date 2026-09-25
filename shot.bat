@echo off
REM shot.bat - grab the connected phone's current screen into Docs\AuthScreenImg.
REM
REM   shot.bat              -> Docs\AuthScreenImg\shot-20260923-121530.png
REM   shot.bat login-dark   -> Docs\AuthScreenImg\login-dark-20260923-121530.png
REM
REM Double-clickable, and works from cmd or PowerShell. Same job as shot.sh,
REM for when you are not in Git Bash.
setlocal

set "DIR=%~dp0Docs\AuthScreenImg"
set "LABEL=%~1"
if "%LABEL%"=="" set "LABEL=shot"

if not exist "%DIR%" mkdir "%DIR%"

REM WMIC-free timestamp: PowerShell is always present on this machine and
REM %DATE%/%TIME% are locale-dependent (they produce slashes and spaces, which
REM make an invalid filename on some locales).
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%i"

set "OUT=%DIR%\%LABEL%-%TS%.png"

for /f %%s in ('adb get-state 2^>^&1') do set "STATE=%%s"
if not "%STATE%"=="device" (
  echo No device ready ^(adb get-state: %STATE%^).
  echo Plug the phone in, unlock it, and accept the USB-debugging prompt.
  exit /b 1
)

adb exec-out screencap -p > "%OUT%"

REM A failed capture still exits 0 and leaves a tiny file, so check the size.
for %%A in ("%OUT%") do set "BYTES=%%~zA"
if %BYTES% LSS 10000 (
  echo Capture looks empty ^(%BYTES% bytes^) - screen off, or a secure screen that blocks capture.
  del "%OUT%"
  exit /b 1
)

echo Saved: %OUT%  ^(%BYTES% bytes^)
endlocal
