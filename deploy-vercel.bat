@echo off
echo ====================================
echo   First Edition Backend - Vercel Deploy
echo ====================================
echo.

echo Checking if Vercel CLI is installed...
where vercel >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Vercel CLI not found. Installing...
    npm install -g vercel
)

echo.
echo Starting deployment...
echo.

vercel --prod

echo.
echo ====================================
echo   Deployment Complete!
echo ====================================
echo.
echo Don't forget to set environment variables in Vercel Dashboard:
echo - MONGODB_URI
echo - JWT_SECRET
echo - JWT_EXPIRE
echo - EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD
echo - STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY
echo - FRONTEND_URL
echo.
pause
