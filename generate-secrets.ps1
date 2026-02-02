# Generate cryptographically secure secrets for CRM PRO
Write-Host "=== Generating Secure Secrets ===" -ForegroundColor Cyan
Write-Host ""

# JWT_SECRET (128 hex chars)
$jwtBytes = New-Object byte[] 64
$rng = [Security.Cryptography.RNGCryptoServiceProvider]::Create()
$rng.GetBytes($jwtBytes)
$JWT_SECRET = -join ($jwtBytes | ForEach-Object { $_.ToString('x2') })

Write-Host "JWT_SECRET (copy this):" -ForegroundColor Green
Write-Host $JWT_SECRET
Write-Host ""

# DATA_ENCRYPTION_KEY (64 hex chars)
$encBytes = New-Object byte[] 32
$rng.GetBytes($encBytes)
$DATA_ENCRYPTION_KEY = -join ($encBytes | ForEach-Object { $_.ToString('x2') })

Write-Host "DATA_ENCRYPTION_KEY (copy this):" -ForegroundColor Green
Write-Host $DATA_ENCRYPTION_KEY
Write-Host ""

# MYSQL_PASSWORD (base64, 32 bytes)
$mysqlBytes = New-Object byte[] 32
$rng.GetBytes($mysqlBytes)
$MYSQL_PASSWORD_RAW = [Convert]::ToBase64String($mysqlBytes)
$MYSQL_PASSWORD = $MYSQL_PASSWORD_RAW -replace '[/+=]',''

Write-Host "MYSQL_PASSWORD (copy this):" -ForegroundColor Green
Write-Host $MYSQL_PASSWORD
Write-Host ""

# WHATSAPP_WEBHOOK_VERIFY_TOKEN (64 hex chars)
$whatsappBytes = New-Object byte[] 32
$rng.GetBytes($whatsappBytes)
$WEBHOOK_TOKEN = -join ($whatsappBytes | ForEach-Object { $_.ToString('x2') })

Write-Host "WHATSAPP_WEBHOOK_VERIFY_TOKEN (copy this):" -ForegroundColor Green
Write-Host $WEBHOOK_TOKEN
Write-Host ""

# BOOTSTRAP_ADMIN_PASSWORD
$adminBytes = New-Object byte[] 16
$rng.GetBytes($adminBytes)
$ADMIN_PASSWORD_RAW = [Convert]::ToBase64String($adminBytes)
$ADMIN_PASSWORD = $ADMIN_PASSWORD_RAW -replace '[/+=]',''

Write-Host "BOOTSTRAP_ADMIN_PASSWORD (copy this):" -ForegroundColor Green
Write-Host $ADMIN_PASSWORD
Write-Host ""

$rng.Dispose()

Write-Host "=== All secrets generated! ===" -ForegroundColor Cyan
Write-Host "Copy these values to your .env file" -ForegroundColor Yellow
