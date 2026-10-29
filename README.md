# Class Assignments board

A shared board where classmates add a class, then assignments with due dates. Anyone with the link can view and add, with no sign-in.

## Put it online (free, about 10 minutes)

1. **Put the files on GitHub.** Make a free account at github.com, click **New repository**, name it `class-board`, then use **uploading an existing file** to drag in everything from this folder (`index.html`, `cover.jpg`, `package.json`, `README.md` and the `api` folder).
2. **Deploy on Vercel.** Sign in at vercel.com with your GitHub account, click **Add New → Project**, pick `class-board`, and click **Deploy**.
3. **Add the database.** In your new Vercel project, open the **Storage** tab, choose **Upstash for Redis** (the free plan is fine), create it and connect it to this project.
4. **Redeploy.** Go to **Deployments**, open the menu on the latest one and click **Redeploy**, so the site picks up the database.
5. **Share the link** (something like `class-board-abc.vercel.app`) in your class group.

## Removing things

- Everyone can remove only what they added, from the same phone or laptop they added it on.
- To be able to remove anything: in Vercel go to **Settings → Environment Variables**, add `ADMIN_KEY` with a secret word, and redeploy. Then open your site once as `https://your-site.vercel.app/?admin=YOURSECRETWORD`. That browser can now remove any class or assignment.

## Changing the banner photo

Replace `cover.jpg` in the GitHub repository with another photo of the same name. Vercel redeploys automatically.
