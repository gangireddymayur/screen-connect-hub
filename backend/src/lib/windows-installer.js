const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

function runPowerShell(script) {
  return spawnSync(
    'powershell.exe',
    ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, stdio: 'ignore' }
  );
}

function psQuote(value) {
  return String(value).replace(/'/g, "''");
}

function installIfNeeded() {
  if (!process.pkg || process.platform !== 'win32') return false;

  const installDir = path.join(
    process.env.LOCALAPPDATA || path.dirname(process.execPath),
    'Programs',
    'SignageHub Local Server'
  );
  const targetExe = path.join(installDir, 'local-server.exe');
  const currentExe = process.execPath;

  if (path.resolve(currentExe).toLowerCase() === path.resolve(targetExe).toLowerCase()) {
    return false;
  }

  const welcome = runPowerShell(`
    Add-Type -AssemblyName System.Windows.Forms;
    $answer = [System.Windows.Forms.MessageBox]::Show(
      'This will install SignageHub Local Server on this computer and create Desktop and Start Menu shortcuts.',
      'SignageHub Local Server Setup',
      [System.Windows.Forms.MessageBoxButtons]::OKCancel,
      [System.Windows.Forms.MessageBoxIcon]::Information
    );
    if ($answer -eq [System.Windows.Forms.DialogResult]::OK) { exit 0 } else { exit 1 }
  `);
  if (welcome.status !== 0) process.exit(0);

  fs.mkdirSync(installDir, { recursive: true });
  fs.copyFileSync(currentExe, targetExe);

  // A downloaded offline bundle contains backup.json beside the setup EXE.
  // Carry it into the installed directory for the first-start auto restore.
  const sourceBackup = path.join(path.dirname(currentExe), 'backup.json');
  if (fs.existsSync(sourceBackup)) {
    fs.copyFileSync(sourceBackup, path.join(installDir, 'backup.json'));
  }

  runPowerShell(`
    $shell = New-Object -ComObject WScript.Shell;
    $desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) 'SignageHub Local Server.lnk';
    $desktopShortcut = $shell.CreateShortcut($desktop);
    $desktopShortcut.TargetPath = '${psQuote(targetExe)}';
    $desktopShortcut.WorkingDirectory = '${psQuote(installDir)}';
    $desktopShortcut.Description = 'SignageHub Local Server';
    $desktopShortcut.Save();

    $startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'SignageHub Local Server.lnk';
    $startShortcut = $shell.CreateShortcut($startMenu);
    $startShortcut.TargetPath = '${psQuote(targetExe)}';
    $startShortcut.WorkingDirectory = '${psQuote(installDir)}';
    $startShortcut.Description = 'SignageHub Local Server';
    $startShortcut.Save();
  `);

  runPowerShell(`
    Add-Type -AssemblyName System.Windows.Forms;
    [System.Windows.Forms.MessageBox]::Show(
      'SignageHub Local Server was installed successfully. The local dashboard will open now.',
      'Installation Complete',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Information
    );
  `);

  const child = spawn(targetExe, [], {
    cwd: installDir,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, IS_OFFLINE: 'true' },
    windowsHide: true
  });
  child.unref();
  process.exit(0);
}

module.exports = { installIfNeeded };
