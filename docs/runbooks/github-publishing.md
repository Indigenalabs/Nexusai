# GitHub Publishing

This repo is now connected to:

- `origin` -> `https://github.com/Indigenalabs/Nexusai.git`

## Normal push flow

1. Check repo state

```bash
git status --short
```

2. Run the release safety checks

```bash
npm run release:check
```

3. Stage and commit

```bash
git add .
git commit -m "Your change summary"
```

4. Push to `main`

```bash
git push origin main
```

## Release tag flow

After `main` is clean and pushed:

```bash
npm run release:tag -- v0.1.0
```

That creates an annotated Git tag and pushes it to GitHub.

## Notes

- Do not commit `.env.local`
- Do not commit `backend/.data/`
- If GitHub CLI auth is added later, you can create GitHub Releases on top of pushed tags with `gh release create`
