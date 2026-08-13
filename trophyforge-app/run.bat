@echo off
rem Launch TrophyForge with the project's own interpreter.
rem Double-clicking main.py hands it to py.exe, which uses the *global*
rem Python — PySide6 lives only in .venv, so that fails instantly and the
rem console closes before the traceback can be read.

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo The virtualenv is missing. Create it first:
    echo.
    echo     python -m venv .venv
    echo     .venv\Scripts\pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

".venv\Scripts\python.exe" main.py
set RC=%errorlevel%

if not "%RC%"=="0" (
    echo.
    echo TrophyForge exited with code %RC%.
    pause
)
