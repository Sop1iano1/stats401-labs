# STATS 401 Labs

## Run Lab 1 locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open:

`http://localhost:8000/lab1/`

## Publish

Create a GitHub repository named `stats401-labs`, then:

```bash
git init
git add .
git commit -m "Create STATS 401 Lab 1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stats401-labs.git
git push -u origin main
```

Enable GitHub Pages from **Settings → Pages → Deploy from a branch → main → /(root)**.
