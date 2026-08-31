# Tux's Take - first push to GitHub

Same shape as the Ask the Atlas push you already did, so most of this will feel
familiar. Two differences worth knowing before you start:

1. **This folder has a build step.** `src\app.template.html` is the source of truth and
   `build.py` produces `index.html` from it. GitHub only serves `index.html`. So the
   rule is: **never hand-edit `index.html`**, and always run `build.py` before you push.
2. **After the first push you never type Git commands again.** `publish.bat` is already
   in the folder - double-click it, type a sentence describing the change, done.

---

## Step 0 - open PowerShell in the right folder

1. Open **File Explorer**
2. Go to `C:\Users\brian.kingery\Claude\CFB Atlas\Claude\experience\tuxs-take`
3. Click once in the **address bar** so the path becomes editable text
4. Type `powershell` over it and press **Enter**

The prompt should end with `\tuxs-take>`. Confirm:

```powershell
dir
```

You should see `index.html`, `src`, `vendor`, `build.py`, `smoke.js`, `publish.bat`,
`README.md`, `LICENSE`, `.gitignore`, `.nojekyll`.

---

## Step 1 - make the empty repo on github.com

1. Go to **https://github.com/new**
2. **Repository name:** `tuxs-take`  *(no apostrophe - it becomes the URL)*
3. **Description:** `Post-game college football recaps and the Aftermath Index. The post-game half of the CFB Atlas.`
4. **Public**
5. **Do NOT tick** "Add a README", "Add .gitignore", or "Choose a license" - the folder
   already has all three, and ticking them creates the "unrelated histories" mess in the
   troubleshooting table below
6. **Create repository**

Leave that page open. The URL you want is
`https://github.com/briankingery87/tuxs-take.git`

---

## Step 2 - Git already knows who you are

You set this when you pushed Ask the Atlas and it was `--global`, so it carried over.
Confirm in one command:

```powershell
git config --global user.name
```

If it prints `Brian Kingery`, skip to step 3. If it prints nothing, redo the two config
lines from the Ask the Atlas guide.

---

## Step 3 - build before you push

This is the step Ask the Atlas did not have. Do it every time.

```powershell
python build.py
```

Expect: `built index.html  NNN,NNN bytes  (2 script blocks)`

If `python` is not recognised, use ArcGIS Pro's:

```powershell
& "C:\Program Files\ArcGIS\Pro\bin\Python\Scripts\propy.bat" build.py
```

---

## Step 4 - the six commands

One at a time. Read what each prints before typing the next.

### 4a. Start tracking this folder
```powershell
git init
```
Expect `Initialized empty Git repository in ...\tuxs-take\.git\`

### 4b. Name the branch main
```powershell
git branch -M main
```
No output.

### 4c. Stage everything
```powershell
git add .
```
No output. A `LF will be replaced by CRLF` warning is harmless.

`.gitignore` already excludes `node_modules/`, `.appcheck.js` and `*.png`, so the
Playwright install and the screenshots stay off GitHub. Check what is actually going up:

```powershell
git status --short
```

You should see roughly 10 lines. If you see hundreds, `node_modules` is being tracked -
stop and tell me.

### 4d. Save the snapshot
```powershell
git commit -m "Tux's Take - initial release"
```
Expect `[main (root-commit) abc1234] Tux's Take - initial release`

### 4e. Point at GitHub
```powershell
git remote add origin https://github.com/briankingery87/tuxs-take.git
```
No output.

### 4f. Upload
```powershell
git push -u origin main
```

A **Connect to GitHub** window appears. Click **Sign in with your browser**, authorize,
come back - PowerShell continues on its own.

Expect `* [new branch]      main -> main`.

---

## Step 5 - turn Pages on

**Settings > Pages** in the repo.

1. **Source:** Deploy from a branch
2. **Branch:** `main`
3. **Folder:** `/ (root)`
4. **Save**

Wait a minute, refresh. Green box:

> Your site is live at **https://briankingery87.github.io/tuxs-take/**

First build can take 2-3 minutes. A 404 at first is normal - wait, then Ctrl+Shift+R.

---

## Step 6 - check the live site

Open the URL and confirm:

- The header stamp reads `198 games recapped - 2 weeks - Week 1 - 2025, 2026 season`
- Home shows Tux's Top 25 with a headline in every row
- Q3 The Yard draws the map (this is the one that proves the vendored Leaflet is inlined
  correctly - if the map is blank, tell me)
- The footer's **Data last refreshed** line has a real date

---

## From now on - publishing an update

**Two steps. No Git commands.**

1. Edit `src\app.template.html`, then run `python build.py`
2. Double-click **`publish.bat`**

`publish.bat` shows you exactly which files changed, asks for a one-line description,
then stages, commits and pushes. If nothing changed it says so and stops.

### Writing good commit messages the easy way

`publish.bat` prompts `Describe this update:`. One sentence saying what a reader would
notice. Present tense, no ceremony:

- `Add Tux's headline to every row of the home board`
- `Match the header to Ask the Atlas`
- `Fix the Dig showing an empty table when a team has not played yet`
- `Publish 2026 week 1`

If you press Enter without typing, it uses the date and time - fine for a quick data
refresh, useless six months later for anything else.

**The one rule:** always `python build.py` before `publish.bat`. If you forget, you push
an `index.html` that does not match the source, and the next person to build gets a
confusing diff. If you are ever unsure, run `build.py` again - it is harmless to run
twice.

---

## If something goes wrong

| PowerShell says | What happened | Fix |
|---|---|---|
| `The term 'git' is not recognized` | PowerShell opened before Git was installed | Close it, reopen, redo step 0 |
| `remote origin already exists` | You ran 4e twice | `git remote set-url origin https://github.com/briankingery87/tuxs-take.git` then redo 4f |
| `Updates were rejected...` | The repo was created WITH a README or license | `git pull origin main --allow-unrelated-histories` then redo 4f |
| `fatal: not a git repository` | Wrong folder | Redo step 0, check with `dir` |
| `src refspec main does not match any` | 4d did not commit | `git status`; if "nothing added to commit", redo 4c then 4d |
| Hundreds of files in `git status` | `node_modules` is being tracked | `git rm -r --cached node_modules` then redo 4c |
| Site loads but the map is blank | `index.html` was pushed without a build, or `vendor\` was excluded | `python build.py`, check `vendor` is not in `.gitignore`, publish again |

**Nothing here can break your local files.** Git only adds a hidden `.git` folder. To
start completely over, delete `.git` and begin again at 4a.

---

## What is NOT going to GitHub, on purpose

The repo is the app only. It is a public page that reads public services, so it needs
nothing else - and everything below either does not belong in public or is not yours to
publish.

| Stays local | Why |
|---|---|
| `Claude\notebooks\` | The pipeline. Contains the shape of your CFBD key usage and your gdb paths. |
| `Claude\data\` | Raw CFBD payloads. Their terms cover redistribution; yours does not. |
| `Claude\scripts\` | Refresh automation with machine-specific paths. |
| `Claude\experience\*.md` | Build notes and runbooks, written for you not for readers. |
| `node_modules\`, `.appcheck.js`, `*.png` | Test machinery and screenshots. Already in `.gitignore`. |

If you ever want the notebook public, that is a separate decision and a separate repo,
and the CFBD key handling needs a review first.
