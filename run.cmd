@echo off
REM Windows entry point. Tries the py launcher first, then python on PATH.
where py >nul 2>nul && (py -3 "%~dp0run.py" %* & exit /b %errorlevel%)
python "%~dp0run.py" %*
