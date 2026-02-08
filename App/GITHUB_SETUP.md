# Connect this project to GitHub

Git is initialized and the initial commit is done. To push to GitHub:

## 1. Create a new repository on GitHub

- Go to [github.com/new](https://github.com/new)
- Choose a name (e.g. `seal-website`)
- Leave "Initialize with README" **unchecked** (this repo already has content)
- Create the repository

## 2. Add the remote and push

From the **seal-website** folder, run (replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub username and repo name):

```bash
cd "/home/rcasey/Projects/Seal/demo 1/seal-website"

git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Or with SSH:

```bash
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 3. (Optional) Set your Git identity

If you want commits to show your name and email:

```bash
git config user.name "Your Name"
git config user.email "your@email.com"
```

Future commits will use this identity.
