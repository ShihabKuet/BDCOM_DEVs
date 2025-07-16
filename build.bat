@echo off
echo Building Flask App with PyInstaller...

REM Remove old build
rmdir /S /Q build
rmdir /S /Q dist
del /Q app.spec

REM Build the app
pyinstaller --noconfirm --onefile ^
  --add-data "templates;templates" ^
  --add-data "static;static" ^
  app.py

echo Build complete! Find your EXE in the 'dist' folder.
pause
