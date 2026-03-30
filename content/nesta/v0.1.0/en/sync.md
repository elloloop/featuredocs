# Seamless Local Sync

Nesta keeps every device in your home in perfect harmony without ever sending a byte of your family's data to the cloud. Sync happens automatically, invisibly, over your home WiFi. Change something on the kitchen tablet and it appears on your phone before you can walk across the room.

This is not a compromise — it is a deliberate design choice. Your family's schedule, your children's activities, your daily routines: none of it needs to live on someone else's server. Nesta uses conflict-free replicated data types (CRDTs) to ensure that even when two people edit the same event at the same time on different devices, everything merges cleanly without anyone losing their changes.

::video[videos/demo_sync.mp4]

## Key Features

- Automatic device discovery over your local WiFi network
- Sub-second sync latency for most changes
- CRDT-based conflict resolution — no data loss, ever
- Works offline with automatic catch-up when devices reconnect
- Zero cloud dependency — your data never leaves your home network

## How It Works

When you pair a device to your family using the PIN, Nesta registers it on the local network. From that moment on, every device continuously discovers and communicates with every other paired device over WiFi. There is no central server, no hub device, no single point of failure. Every device holds a complete copy of your family's calendar.

When you create, edit, or complete an event, the change is broadcast to all online devices within milliseconds. If a device is offline — perhaps a phone that left the house — it catches up automatically the moment it reconnects to your home WiFi. The CRDT engine ensures that even conflicting edits merge gracefully: if Mum changes the dinner time to 6pm on her phone while Dad changes it to 6:30pm on the tablet, both changes are preserved and you are gently prompted to resolve the difference.

The result is a calendar that feels like one shared surface, even though it is running independently on every device. It is the digital equivalent of a single sheet of paper that everyone in the family can read and write on at the same time.
