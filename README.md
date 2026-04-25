# Kreeda-Ankana

Kreeda-Ankana is a **Ground & Match Organizer** for village sports communities.

## Features

- **Ground Calendar** with slot booking.
- **Conflict prevention**: overlapping bookings are blocked.
- **Challenge Board** with open challenge posts and replies.
- **Score Wall** with persistent local match history.
- **Team profiles + match history persistence** using a browser-local, Room-like IndexedDB store.
- **Optional Firebase real-time sync** for the challenge board.

## Run locally

Because this is a static app, you can run with any local server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Firebase setup (optional)

To enable cloud real-time challenge syncing:

1. Create a Firebase project and Realtime Database.
2. Open `app.js`.
3. Fill `firebaseConfig` with your project values.
4. Reload the app.

Without Firebase config, the app still works using local browser storage.
