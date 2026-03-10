const { exec } = require('child_process');
exec(`osascript -e 'tell application "Google Chrome" to get name of every window'`, (err, stdout) => {
    console.log("Names:", stdout);
});
