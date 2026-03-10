const { exec } = require('child_process');
const script = `
tell application "Google Chrome"
    try
        close (every window whose id is 1234)
    end try
end tell
`;
exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
    console.log("Error:", error);
    console.log("Stdout:", stdout);
    console.log("Stderr:", stderr);
});
