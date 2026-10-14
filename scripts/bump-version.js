const fs = require('fs');
const path = require('path');

const packageJsonPath = path.resolve(__dirname, '../package.json');
const appJsonPath = path.resolve(__dirname, '../app.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const arg = process.argv[2] || 'patch';

let [major, minor, patch] = (packageJson.version || '1.0.0')
  .split('.')
  .map((n) => parseInt(n, 10));

if (arg === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (arg === 'minor') {
  minor += 1;
  patch = 0;
} else if (arg === 'patch') {
  patch += 1;
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  [major, minor, patch] = arg.split('.').map((n) => parseInt(n, 10));
} else {
  console.error(`Bilinmeyen sürüm argümanı: "${arg}". Kullanım: major | minor | patch | 1.5.0`);
  process.exit(1);
}

const newVersion = `${major}.${minor}.${patch}`;

// Android versionCode ve iOS buildNumber artır
const currentVersionCode = appJson.expo.android?.versionCode || 1;
const newVersionCode = currentVersionCode + 1;
const newBuildNumber = String(newVersionCode);

packageJson.version = newVersion;
appJson.expo.version = newVersion;

if (!appJson.expo.android) appJson.expo.android = {};
appJson.expo.android.versionCode = newVersionCode;

if (!appJson.expo.ios) appJson.expo.ios = {};
appJson.expo.ios.buildNumber = newBuildNumber;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');

console.log(`✅ Sürüm başarıyla güncellendi:`);
console.log(`   - Yeni Sürüm (SemVer): ${newVersion}`);
console.log(`   - Android versionCode: ${newVersionCode}`);
console.log(`   - iOS buildNumber:     ${newBuildNumber}`);
