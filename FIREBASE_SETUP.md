# Firebase Setup Guide for Jea's Budget Tracker 🌸

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** (or "Add project")
3. Name it something like `jea-budget-tracker`
4. Disable Google Analytics (not needed), click **Create Project**
5. Wait for it to finish, then click **Continue**

## Step 2: Create a Firestore Database

1. In the left sidebar, click **"Build"** → **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (we'll secure it later)
4. Pick a location closest to you: **asia-southeast1 (Singapore)** is best
5. Click **Enable**

## Step 3: Register a Web App

1. On the Project Overview page, click the **web icon** `</>`
2. Give it a nickname like `budget-tracker-web`
3. Check **"Also set up Firebase Hosting"** if you want (optional, since we use Vercel)
4. Click **Register app**
5. You'll see a config object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "jea-budget-tracker.firebaseapp.com",
  projectId: "jea-budget-tracker",
  storageBucket: "jea-budget-tracker.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

6. **Copy these values** and paste them into `src/firebase.js` in your project

## Step 4: Update firebase.js

Open `src/firebase.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",        // paste from Firebase
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Step 5: Set Firestore Security Rules

1. In Firebase Console, go to **Firestore Database** → **Rules** tab
2. Replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> Note: This allows anyone with the link to read/write.
> Since this is a personal budget tracker, it's fine.
> If you want to add login later, we can secure it further.

3. Click **Publish**

## Step 6: Run Locally

```bash
cd jea-budget-tracker
npm install
npm run dev
```

Open `http://localhost:5173` and start adding expenses. They save to Firebase instantly!

## Step 7: Deploy to Vercel

```bash
git add .
git commit -m "add firebase"
git push
```

Vercel auto-deploys. Done! 🎉

## How It Works

- **Expenses** are stored in a `expenses` collection (each expense = 1 document)
- **Settings** (monthly budget + category limits) are in `settings/budget` document
- **Real-time sync** via Firestore `onSnapshot` means if Jea opens it on her phone and you open it on yours, both see changes instantly
- Data persists forever in the cloud, not tied to any browser

## Troubleshooting

**White screen?**
- Check browser console (F12 → Console) for errors
- Make sure `firebase.js` has your actual config values, not the placeholders

**Data not saving?**
- Check Firestore rules are set to allow read/write
- Check the Firestore Database tab in Firebase Console to see if documents appear

**"Missing or insufficient permissions" error?**
- Your Firestore rules need to be updated (see Step 5)
