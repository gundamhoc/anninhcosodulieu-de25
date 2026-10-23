# Tao database clinic_db, cac bang va du lieu mau.
# Chay bang PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\setup-db.ps1

$ErrorActionPreference = 'Stop'

$mysql = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
$schema = Join-Path $PSScriptRoot 'database\schema.sql'
$seed = Join-Path $PSScriptRoot 'database\seed.sql'

if (-not (Test-Path $mysql)) {
  throw "Khong tim thay mysql.exe tai: $mysql"
}
if (-not (Test-Path $schema)) {
  throw "Khong tim thay file: $schema"
}
if (-not (Test-Path $seed)) {
  throw "Khong tim thay file: $seed"
}

Write-Host ''
Write-Host '=== TAO DATABASE CLINIC_DB ===' -ForegroundColor Cyan
Write-Host 'Nhap mat khau tai khoan root MySQL.'
Write-Host 'Mat khau chi dung trong phien chay nay, khong luu vao file.'
Write-Host ''

$secure = Read-Host -AsSecureString 'Mat khau root MySQL'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

# MySQL client doc mat khau tu bien moi truong MYSQL_PWD.
# Cach nay tranh lo mat khau tren command line.
$env:MYSQL_PWD = $plain

try {
  Write-Host 'Dang tao database va cac bang...' -ForegroundColor Yellow
  $mysqlArgs = @('-u', 'root', '--default-character-set=utf8mb4')
  $p1 = Start-Process -FilePath $mysql -ArgumentList $mysqlArgs `
    -RedirectStandardInput $schema -NoNewWindow -Wait -PassThru
  if ($p1.ExitCode -ne 0) {
    throw "Loi khi chay schema.sql (exit code $($p1.ExitCode))."
  }

  Write-Host 'Dang nap du lieu mau...' -ForegroundColor Yellow
  $p2 = Start-Process -FilePath $mysql -ArgumentList $mysqlArgs `
    -RedirectStandardInput $seed -NoNewWindow -Wait -PassThru
  if ($p2.ExitCode -ne 0) {
    throw "Loi khi chay seed.sql (exit code $($p2.ExitCode))."
  }

  Write-Host ''
  Write-Host 'XONG. Database: clinic_db' -ForegroundColor Green
  Write-Host 'Tiep theo: mo MySQL Workbench -> Database -> Reverse Engineer de xuat ERD.'
} catch {
  Write-Host ''
  Write-Host "LOI: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Kiem tra lai mat khau root MySQL va thu lai.'
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
  $plain = $null
}

Write-Host ''
[void](Read-Host 'Nhan Enter de dong')
