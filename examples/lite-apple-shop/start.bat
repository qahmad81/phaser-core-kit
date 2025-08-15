@echo off
setlocal
cd /d "%~dp0"

where http-server >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Starting http-server on http://localhost:8080 ...
  http-server -p 8080 .
  goto :end
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Starting Python HTTP server on http://localhost:8080 ...
  python -m http.server 8080
  goto :end
)

echo.
echo No local server found.
echo Install one of:
echo   npm i -g http-server
echo OR
echo   Install Python and rerun
echo.
:end
endlocal
