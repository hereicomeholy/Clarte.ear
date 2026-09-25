# Clarté Ear — GitHub Pages version

This package is the static GitHub Pages edition of the Clarté Ear calendar.
It keeps the calendar, customers, services, financial records, local automatic
saving, Google Drive backups, and installable phone-app behavior.

## Important before migrating

1. Open the current Clarté Ear website on the owner's phone.
2. Confirm that Google Drive says the latest backup completed successfully.
3. Keep the existing website and Home Screen icon until the GitHub version has
   loaded the same customers, appointments, services, and financial records.

The GitHub version checks for the existing Google Drive backup before its first
owner upload when the new browser has no local records. This prevents a new,
empty GitHub installation from replacing the existing backup.

## Publish on GitHub Pages

1. Create a new private or public GitHub repository.
2. Upload every file and folder from this package to the repository's `main`
   branch. Keep the `.github` folder.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. Open the repository's **Actions** tab and wait for
   **Deploy Clarte Ear to GitHub Pages** to finish.
6. GitHub will display the published URL.

The included workflow automatically detects the repository name, so the site
works at an address such as:

`https://USERNAME.github.io/REPOSITORY-NAME/`

## Required Google Cloud update

Google Drive login will not work on the new address until its origin is allowed.

1. Open Google Cloud Console using the project that owns the existing OAuth
   client.
2. Open **APIs & Services → Credentials**.
3. Open the Web application OAuth client used by Clarté Ear.
4. Under **Authorized JavaScript origins**, add:

   `https://YOUR-GITHUB-USERNAME.github.io`

   Add only the origin; do not include the repository path.
5. Save the OAuth client.
6. If the API key has website restrictions, add this referrer too:

   `https://YOUR-GITHUB-USERNAME.github.io/*`

## First safe opening

1. Open the new GitHub Pages link on the owner's phone.
2. Press **Connect Google Drive** and choose the owner's existing account.
3. Confirm that the customers, appointments, services, and financial records
   appear before adding or editing anything.
4. On Android, remove the old shortcut, open the GitHub link in Chrome, and use
   **Install app** or **Add to Home screen**.
5. On iPhone, open the link in Safari, use **Share → Add to Home Screen**.

## How saving works

- Every change is saved automatically in that browser's local storage.
- The owner's connected device uploads changes to the same Google Drive backup.
- The viewer account remains read-only and refreshes from Google Drive.
- GitHub stores only the website files; it does not receive customer records.

Avoid editing on two owner devices at exactly the same time. Google Drive is a
backup-and-refresh system, not a conflict-aware multi-user database, so the
last uploaded version wins.

## Local development

Requirements: Node.js 22 or later.

```bash
npm install
npm run dev
```

To create the static website locally:

```bash
npm run build
```

The generated HTML and assets will be in the `out` folder.

This download also contains a `PREBUILT_HTML_FOR_CLARTE_EAR_REPO` folder so
you can inspect the generated `index.html` and assets. GitHub Actions rebuilds
these files automatically during deployment; that preview folder does not need
to be uploaded to your repository.
