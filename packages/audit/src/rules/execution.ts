import type { LinePattern, Rule } from "../types.js";
import { runPatterns } from "../util.js";

const patterns: LinePattern[] = [
  {
    rule: "AA-E01",
    severity: "critical",
    title: "Downloads and runs code in one step",
    why: "Whatever the remote server returns runs immediately, and it can change after anyone reviewed it.",
    fix: "Download to a file, pin a version or checksum, review it, then run it as a separate step.",
    scope: "code",
    quotable: true,
    re: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z|da|k)?sh\b|\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:python3?|node|ruby|perl|php)\b|\b(?:ba|z)?sh\s+(?:-c\s+)?["']?<?\(?\s*\$?\(?\s*(?:curl|wget)\b|\bsource\s+<\(\s*(?:curl|wget)\b|\beval\s+["']?\$\(\s*(?:curl|wget)\b|\b(?:iex|Invoke-Expression)\b[^\n]*\b(?:irm|iwr|Invoke-RestMethod|Invoke-WebRequest|DownloadString)\b|\b(?:irm|iwr|Invoke-RestMethod|Invoke-WebRequest)\b[^\n]*\|\s*(?:iex|Invoke-Expression)\b/i,
  },
  {
    rule: "AA-E02",
    severity: "critical",
    title: "Decodes hidden code and runs it",
    why: "Encoding hides what will run, which is a common way to smuggle in malicious commands.",
    fix: "Write the command in plain text so it can be read in review.",
    scope: "code",
    quotable: true,
    re: /\b(?:base64|b64)\b[^\n|]*(?:-d|-D|--decode|decode)[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b|\b(?:xxd\s+-r|openssl\s+(?:enc\s+)?-?base64\s+-d)[^\n|]*\|\s*(?:ba|z)?sh\b|\b(?:eval|new\s+Function|exec|execSync)\s*\(\s*(?:atob|Buffer\.from)\s*\(|\b(?:exec|eval)\s*\(\s*(?:__import__\(["']base64["']\)\.)?(?:base64\.)?b64decode\s*\(|\b(?:exec|eval)\s*\(\s*(?:bytes|bytearray)\.fromhex\s*\(|\b(?:exec|eval)\s*\(\s*compile\s*\(\s*(?:base64\.)?b64decode|\bFromBase64String\b[^\n]*\|\s*iex\b|\biex\b[^\n]*FromBase64String/i,
  },
  {
    rule: "AA-E03",
    severity: "high",
    title: "Destructive command",
    why: "Deleting or formatting broad paths can destroy your files, and a misread variable turns a small cleanup into a wipe.",
    fix: "Delete only specific, validated paths inside the project, and never run disk-level commands.",
    scope: "code",
    quotable: true,
    re: /\brm\s+(?:-[a-zA-Z]*[rR][a-zA-Z]*f?[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*[rR][a-zA-Z]*|--recursive\s+--force|-r\s+-f|-f\s+-r)\s+(?:--\s+)?["']?(?:\/(?:\*|\s|["']|$)|~(?:\/\*?)?["']?(?:\s|$)|\$HOME\b|\$\{HOME\}|%USERPROFILE%|\$[A-Za-z_]\w*\/\*|\$\{[A-Za-z_]\w*:?-\}|["']\$[A-Za-z_]\w*["']\/\*)|\bmkfs(?:\.\w+)?\b|\bdd\b[^\n]*\bof=\/dev\/|:\(\)\s*\{\s*:\|:&\s*\};:|>\s*\/dev\/sd[a-z]\b|\bRemove-Item\b[^\n]*-Recurse[^\n]*(?:\bC:\\(?:\s|$|\*)|\$env:USERPROFILE|~)|\bformat\s+[a-z]:\s|\b(?:rmSync|rimraf(?:Sync)?|rmdirSync|rm)\s*\(\s*(?:["'`]\/["'`]|os\.homedir\(\)|process\.env\.HOME|require\(["']os["']\)\.homedir\(\))/i,
  },
  {
    rule: "AA-E04",
    severity: "high",
    title: "Makes itself persistent",
    why: "Shell startup files, cron jobs and launch agents make code run again and again, long after the skill is gone.",
    fix: "Do not modify shell startup files or schedulers; tell the user what to add and let them do it.",
    scope: "code",
    quotable: true,
    re: /(?:>>?|\btee\b(?:\s+-a)?|\bappendFile\w*|\bwriteFile\w*|\bcp\b|\bmv\b|\bsed\s+-i)[^\n]*(?:\.bashrc|\.zshrc|\.bash_profile|\.zprofile|\.profile\b|\.zshenv|\.zlogin|config\.fish)\b|\bcrontab\s+(?:-[el]\b|-\s|\S)|\|\s*crontab\b|\/etc\/cron|\bLaunch(?:Agents|Daemons)\b|\blaunchctl\s+(?:load|bootstrap|enable)\b|\/etc\/systemd|\.config\/systemd\/user|\bsystemctl\s+(?:--user\s+)?enable\b|Start Menu[\\/]Programs[\\/]Startup|\bschtasks\s+\/create\b|CurrentVersion[\\/]Run\b|\bat\s+-f\b/i,
  },
  {
    rule: "AA-E05",
    severity: "high",
    title: "Asks for elevated privileges",
    why: "Root-level commands can change anything on the machine, and world-writable permissions open files to every user.",
    fix: "Run without sudo, keep permissions minimal, and leave system paths alone.",
    scope: "code",
    quotable: true,
    re: /(?:^|[\s;&|(`$])(?:sudo|doas)\s+\S|\bsu\s+-\s|\bchmod\s+(?:-R\s+)?(?:0?777|a\+rwx|ugo\+rwx)\b|\bchmod\s+(?:-R\s+)?[ugoa]*\+s\b|\bchown\b[^\n]*\s\/(?:etc|usr|bin|sbin|var|System|Library|opt|root|boot)\b|\bRunAs\b[^\n]*-Verb\s+RunAs|Start-Process\b[^\n]*-Verb\s+RunAs/i,
  },
  {
    rule: "AA-E06",
    severity: "medium",
    title: "Installs an unpinned or remote package",
    why: "An unpinned package can change under you, and one installed from a URL or git is not reviewed by any registry.",
    fix: "Pin an exact version (npx pkg@1.2.3), commit a lockfile, and avoid installing from URLs.",
    scope: "script",
    re: /\b(?:npx|pnpm\s+dlx|yarn\s+dlx|bunx)\s+(?:(?:-y|--yes|-p|--package(?:=\S+)?|--no-install)\s+)*(?!--)(?:@[\w.-]+\/)?[\w.-]+(?!@\d)(?:\s|$|["'`])|\bpip3?\s+install\b[^\n]*(?:git\+|https?:\/\/|\.zip\b|\.tar\.gz\b)|\b(?:npm|pnpm|yarn)\s+(?:install|i|add)\b[^\n]*(?:git\+|https?:\/\/|github:)|\b(?:npm|pnpm|yarn|bun)\s+(?:install|i|add)\s+(?:-g\s+|--global\s+)?(?:@[\w.-]+\/)?[\w.-]+(?!@\d)(?:\s|$|["'`])/i,
    // Hints printed to the user ("Run: npx playwright install") are not commands the script runs.
    skip: (line, m) =>
      /\b(?:install|i)\s*(?:-g\s+)?$/.test(m[0].trim()) ||
      /\bconsole\.\w+\(|\bprint\(|\becho\s/.test(line.text) ||
      /^\s*["'`]/.test(line.text),
  },
  {
    rule: "AA-E07",
    severity: "medium",
    title: "Runs dynamically built code or commands",
    why: "Building a command or program from variables lets unexpected input become code.",
    fix: "Pass arguments as an array, avoid eval, and validate any value that reaches a command.",
    scope: "script",
    re: /(?<![\w.$])eval\s*\(|\bnew\s+Function\s*\(|\b(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|[^)\n]*["'`]\s*\+|[^)\n]*\+\s*["'`])|\bspawn(?:Sync)?\s*\([^)\n]*shell\s*:\s*true|\bos\.system\s*\(\s*(?:f["']|[^)\n]*\+|[^)\n]*%\s|[^)\n]*\.format\()|\bsubprocess\.\w+\s*\([^)\n]*shell\s*=\s*True|(?:^|[\s;&|])eval\s+["']?\$|\bexec\s*\(\s*f["']|(?<![\w.$])exec\s*\(\s*(?:input|[^)\n]*\+)/,
    skip: (line) => /\.exec\(|regex|\.test\(/.test(line.text) && !/eval|Function/.test(line.text),
  },
];

export const executionRules: Rule[] = [(ctx) => runPatterns(ctx, patterns)];
