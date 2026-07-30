# TASK FM — App Store Connect Listing (copy-paste ready)

## App Information
| Field | Value |
|---|---|
| **Name** | TASK FM |
| **Subtitle** (30 chars max) | A tiny checklist in your menu bar |
| **Bundle ID** | com.taskfm.app |
| **SKU** | taskfm-mac-001 |
| **Primary Category** | Productivity |
| **Secondary Category** | Utilities (optional) |
| **Price** | Free |

## URLs
| Field | Value |
|---|---|
| **Support URL** | https://taskfm.shop/ |
| **Marketing URL** (optional) | https://taskfm.shop/ |
| **Privacy Policy URL** | https://taskfm.shop/privacy |

## Description
```
TASK FM is a tiny, beautiful checklist that lives in your menu bar — one click away, all day long.

No projects. No boards. No accounts. Just your tasks, your checklists, and the satisfying feeling of getting things done.

WHY YOU'LL LOVE IT

• Lives in your menu bar — your list is one click away, and Escape makes it disappear
• Checklists that work — subtasks with drag-to-reorder, progress badges, double-click to rename
• Smart deadlines — Today, Tomorrow, 3d overdue. The way you actually think
• Sound personality — this is not another silent to-do app. Every task you create, every step you check, every task you finish has its own sound

SOUND-FIRST EXPERIENCE

Choose between distinctive sound packs — or hit Shuffle and let TASK FM surprise you with a different pack on every action. Set the volume, pick your ambient hours, or go silent anytime. Productivity you can hear.

MADE FOR YOUR MAC

• Native menu bar app — fast, lightweight, distraction-free
• Dark, light, or system theme
• English and Arabic, with full right-to-left support
• Archive & Trash — nothing disappears by accident
• Everything stays on your Mac. No account, no cloud, no tracking

Download it, pin your day, and hear your progress.
```

## Keywords (100 chars max)
```
todo,checklist,menu bar,tasks,productivity,minimal,task manager,to-do list,reminders,focus
```

## App Privacy
- **Data Not Collected** — the app has no analytics, no accounts, no network features. All data stays on device.

## App Review Notes
```
TASK FM is a menu bar app. After launching, click the TASK FM icon in the
macOS menu bar (animated waveform icon) to open the popup window.
The app works fully offline and requires no account.
```

## Screenshots (in appstore-assets/)
2880×1800 PNG — upload in this order:
1. `01-tasks.png` — task list with expanded checklist
2. `02-onboarding.png` — onboarding (sound packs + themes)
3. `03-settings.png` — settings
4. `04-sound-packs.png` — sound packs + shuffle

## ⚠️ Before building the MAS package (see APP_STORE_CHECKLIST.md)
1. Restore `"entitlements": "Entitlements.plist"` in tauri.conf.json (sandbox is mandatory on MAS)
2. **Fix the blank-window-under-sandbox issue first** (likely needs `com.apple.security.network.client`)
3. Remove/disable the updater plugin for the MAS build (self-update is forbidden)
