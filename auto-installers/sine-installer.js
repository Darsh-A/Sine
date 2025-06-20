const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');
const https = require('https');
let isLiGNUx = false;
// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to get the default Zen Browser profile directory based on the platform
function getProfileDir() {
  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case 'win32':
      return path.join(homeDir, 'AppData', 'Roaming', 'zen', 'Profiles');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'Zen', 'Profiles');
    case 'linux':
      isLiGNUx = true;
      return path.join(homeDir, ".zen"); // temp, unused
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// Function to parse profiles.ini and extract profile paths
async function getProfiles(profileDir) {
  const iniPath = path.join(profileDir, isLiGNUx ? '' : '..', 'profiles.ini');
  try {
    const iniContent = await fs.promises.readFile(iniPath, 'utf8');
    const profiles = [];
    let currentProfile = null;

    iniContent.split('\n').forEach(line => {
      line = line.trim();
      if (line.startsWith('[Profile')) {
        if (currentProfile) profiles.push(currentProfile);
        currentProfile = {};
      } else if (currentProfile && line.includes('=')) {
        const [key, value] = line.split('=');
        currentProfile[key.trim()] = value.trim();
      }
    });
    if (currentProfile) profiles.push(currentProfile);

    return profiles
      .filter(p => p.Path)
      .map(p => ({
        name: p.Name || path.basename(p.Path),
        path: path.isAbsolute(p.Path) ? p.Path : path.join(profileDir, isLiGNUx ? '' : '..', p.Path)
      }));
  } catch (err) {
    console.error('Error reading profiles.ini:', err.message);
    return [];
  }
}

// Function to prompt user to select a profile
function promptProfileSelection(profiles) {
  return new Promise((resolve) => {
    console.log('\nAvailable Zen Browser profiles:');
    profiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.name} (${profile.path})`);
    });

    rl.question('\nEnter the number of the profile to install fx-autoconfig into: ', (answer) => {
      const index = parseInt(answer) - 1;
      if (index >= 0 && index < profiles.length) {
        resolve(profiles[index]);
      } else {
        console.log('Invalid selection. Please try again.');
        resolve(promptProfileSelection(profiles));
      }
    });
  });
}

async function promptLocationSelection() {
  const platform = os.platform();

  const type = await new Promise((resolve) => {
    rl.question('\nDo you want to install Sine on Zen Browser or Zen Twilight (enter twilight or zen): ', (answer) => {
      resolve(answer);
    });
  });
  
  // Define possible locations for each platform
  const locations = {
    win32: [
      "C:\\Program Files\\Zen Browser",
      "C:\\Program Files\\Zen Twilight",
    ],
    darwin: [
      "/Applications/Zen Browser.app/contents/resources",
      "/Applications/Zen Browser.app/Twilight/contents/resources",
      "/Applications/Zen Browser.app/Contents/MacOS",
      "/Applications/Zen Browser.app/Twilight/Contents/MacOS",
      "/Applications/Zen.app/Contents/Resources",
      "/Applications/Zen.app/Twilight/Contents/Resources",
      "/Applications/Zen.app/Contents/MacOS",
      "/Applications/Zen.app/Twilight/Contents/MacOS",
      "/Applications/Zen Browser.app/Contents/Resources",
      "/Applications/Zen Browser.app/Twilight/Contents/Resources",
      "/Applications/Zen.app/contents/resources",
      "/Applications/Zen.app/Twilight/contents/resources",
    ]
  };

  // Check if we have locations defined for this platform and filter through twilight or non-twilight installs.
  if (!locations.hasOwnProperty(platform)) {
    return promptUserInput();
  }

  const twilight = type.toLowerCase().trim().includes('twilight');
  const platformLocations = locations[platform];
  const filteredLocations =  platformLocations
    .filter(loc => (twilight && loc.toLowerCase().includes('twilight')) || (!twilight && !loc.toLowerCase().includes('twilight')));

  // Try each location until we find one that exists
  for (const location of platformLocations) {
    if (fs.existsSync(location)) {
      return location;
    }
  }

  // If no predefined location exists, prompt user
  return promptUserInput();
}

function promptUserInput() {
  return new Promise((resolve) => {
    rl.question('\nEnter the location of where your Zen Browser is located (not profiles directory): ', (answer) => {
      resolve(answer);
    });
  });
}

async function promptUsername() {
  return new Promise((resolve) => rl.question('\nEnter the name of the username to install fx-autoconfig into: ', (answer) => resolve(answer)));
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: Status ${response.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (err) => reject(err));
    }).on('error', (err) => reject(err));
  });
}

async function installFxAutoconfig(profilePath, programPath) {
  const filesToInstall = [
    { repoPath: 'CSS/agent_style.uc.css', targetPath: 'chrome/CSS/agent_style.uc.css' },
    { repoPath: 'CSS/author_style.uc.css', targetPath: 'chrome/CSS/author_style.uc.css' },
    { repoPath: 'JS/test.uc.js', targetPath: 'chrome/JS/test.uc.js' },
    { repoPath: 'JS/userChrome_ag_css.sys.mjs', targetPath: 'chrome/JS/userChrome_ag_css.sys.mjs' },
    { repoPath: 'JS/userChrome_au_css.uc.js', targetPath: 'chrome/JS/userChrome_au_css.uc.js' },
    { repoPath: 'resources/userChrome.ag.css', targetPath: 'chrome/resources/userChrome.ag.css' },
    { repoPath: 'resources/userChrome.au.css', targetPath: 'chrome/resources/userChrome.au.css' },
    { repoPath: 'utils/boot.sys.mjs', targetPath: 'chrome/utils/boot.sys.mjs' },
    { repoPath: 'utils/chrome.manifest', targetPath: 'chrome/utils/chrome.manifest' },
    { repoPath: 'utils/fs.sys.mjs', targetPath: 'chrome/utils/fs.sys.mjs' },
    { repoPath: 'utils/module_loader.mjs', targetPath: 'chrome/utils/module_loader.mjs' },
    { repoPath: 'utils/uc_api.sys.mjs', targetPath: 'chrome/utils/uc_api.sys.mjs' },
    { repoPath: 'utils/utils.sys.mjs', targetPath: 'chrome/utils/utils.sys.mjs' },
  ];

  const programFilesToInstall = [
    { repoPath: 'config.js', targetPath: 'config.js' },
    { repoPath: 'defaults/pref/config-prefs.js', targetPath: 'defaults/pref/config-prefs.js' }
  ];

  const sineFilesToInstall = [
    { repoPath: 'sine.uc.mjs', targetPath: 'chrome/JS/sine.uc.mjs' }
  ];

  for (const file of programFilesToInstall) {
    const url = `https://raw.githubusercontent.com/MrOtherGuy/fx-autoconfig/master/program/${file.repoPath}`;
    const dest = path.join(programPath, file.targetPath);
    try {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await downloadFile(url, dest);
      console.log(`Installed ${file.targetPath}`);
    } catch (err) {
      console.error(`Failed to install ${file.targetPath}: ${err.message}`);
    }
  }

  for (const file of filesToInstall) {
    const url = `https://raw.githubusercontent.com/MrOtherGuy/fx-autoconfig/master/profile/chrome/${file.repoPath}`;
    const dest = path.join(profilePath, file.targetPath);
    try {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await downloadFile(url, dest);
      console.log(`Installed ${file.targetPath}`);
    } catch (err) {
      console.error(`Failed to install ${file.targetPath}: ${err.message}`);
    }
  }

  for (const file of sineFilesToInstall) {
    const url = `https://raw.githubusercontent.com/CosmoCreeper/Sine/main/${file.repoPath}`;
    const dest = path.join(profilePath, file.targetPath);
    try {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await downloadFile(url, dest);
      console.log(`Installed ${file.targetPath}`);
    } catch (err) {
      console.error(`Failed to install ${file.targetPath}: ${err.message}`);
    }
  }

  console.log('\nSine has been installed successfully!');
}

// Main function to run the application
async function main() {
  console.log('Zen Browser fx-autoconfig Installer');

  let profileDir;
  if (!isLiGNUx) {
    try {
      profileDir = getProfileDir();
      if (!isLiGNUx) {
        await fs.promises.access(profileDir);
      }
    } catch (err) {
      console.error(`Profile directory not found at ${profileDir}.`);
      rl.close();
      return;
    }
  }
  if (isLiGNUx) {
    if (process.getuid?.() !== 0) {
      console.error("ERROR: THIS SCRIPT MUST BE RUN AS ROOT.");
      process.exit(1);
    }
    const tempUsername = await promptUsername();
    profileDir = path.join("/home/", tempUsername, ".zen"); // path of zen profiles directory
    try {
      await fs.promises.access(profileDir);
    } catch (err) {
      console.error(`Profile directory not found at ${profileDir}.`);
      rl.close();
      return;
    }
  }

  const profiles = await getProfiles(profileDir);
  if (profiles.length === 0) {
    console.log('No profiles found in the profile directory.');
    rl.close();
    return;
  }

  const selectedProfile = await promptProfileSelection(profiles);
  const location = await promptLocationSelection();
  await installFxAutoconfig(selectedProfile.path, location);

  rl.close();
}

// Run the application
main().catch(err => {
  console.error('An unexpected error occurred:', err.message);
  rl.close();
});
