# TASK FM — Landing Page Brief
> كل المعلومات اللازمة لبناء landing page متناسق مع هوية الأبلكيشن

---

## 1. هوية الأبلكيشن

| | |
|---|---|
| **الاسم** | TASK FM |
| **الـ tagline الرسمي** | "A tiny checklist that lives in your menu bar." |
| **الوصف الكامل** | A lightweight, elegant checklist app that lives in your macOS menu bar. Fast, focused, and distraction-free. |
| **الإصدار** | 1.0.0 |
| **الفئة** | Productivity |
| **المنصات** | macOS (الأساسي) + Windows |
| **Copyright** | © 2025 TASK FM. All rights reserved. |

---

## 2. الألوان (Design Tokens)

### Dark Theme (الافتراضي)
```
Background:
  --bg:           #141414       ← الخلفية الرئيسية
  --bg2:          #1c1c1e       ← خلفية الكروت والسكشنز
  --bg3:          #2c2c2e       ← خلفية العناصر الداخلية

Text:
  --text:         #f2f2f7       ← النص الرئيسي
  --text2:        #8e8e93       ← نص ثانوي
  --text3:        #48484a       ← نص خافت / disabled

Accent:
  --accent:       #F5C542       ← الأكسنت الرئيسي (أصفر ذهبي)
  --accent-dim:   rgba(245,197,66,0.16) ← أكسنت شفاف للخلفيات

Semantic:
  --danger:       #e05050       ← الحذف والأخطاء (أحمر)
  --border:       rgba(255,255,255,0.09) ← الحدود

Border Radius:
  --radius:       16px
  --radius-sm:    10px
```

### Light Theme
```
  --bg:           #f5f5f5
  --bg2:          #ebebeb
  --bg3:          #e0e0e0
  --border:       rgba(0,0,0,0.08)
  --text:         #111
  --text2:        #666
  --text3:        #999
  (الأكسنت والـ danger بيفضلوا نفسهم)
```

### ألوان إضافية للاستخدام في الـ Landing Page
```
أخضر (success / get started):  #50c878
نفس الأصفر للـ CTA:             #F5C542
خلفية اللاندينج (dark):         #0e0e0e أو #141414
```

---

## 3. الخطوط

```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
```

**Scale:**
| الاستخدام | الحجم | الوزن |
|---|---|---|
| Hero headline | 28px | 700 |
| Section title | 20px | 700 |
| Card title | 14–15px | 500 |
| Body / settings | 13–14px | 400–450 |
| Meta / captions | 11px | 400–600 |

**Letter spacing:** Headlines: `-0.5px` / Section labels uppercase: `0.6px`

---

## 4. الـ Assets المتاحة

```
src-tauri/icons/
├── icon.png              ← الأيقونة الكاملة (الأفضل للـ landing)
├── 128x128.png
├── 128x128@2x.png
├── 32x32.png
├── tray-icon.png         ← أيقونة الـ menu bar (بيضاء)
├── tray-dark-mode.png    ← نسخة dark mode
├── tray-light-mode.png   ← نسخة light mode
└── icon.icns             ← macOS bundle icon
```

**المسار الكامل:** `/Users/nedaladnan/Projects/tick/src-tauri/icons/`

---

## 5. الفيتشرز (للـ features section)

### Core
- ✅ Create tasks with titles
- ✅ Subtasks / Checklist items per task
- ✅ Drag-to-reorder checklist steps
- ✅ Double-click to rename any task or step
- ✅ Task deadlines with smart display (Today / Tomorrow / 3d overdue)
- ✅ Progress indicator per task (2/5)

### Organization
- ✅ Archive completed tasks
- ✅ Trash with restore + permanent delete
- ✅ Auto-sort completed tasks to bottom
- ✅ Auto-archive tasks older than 2.5 days

### Sound System ✨
- ✅ 6 sound packs: Soft Pop · Crisp Click · Minimal · Elsisi · Bahgt · El Guyar
- ✅ Sound triggers: task created, step checked, task completed
- ✅ Ambient / idle sounds during your work hours
- ✅ Frequency control (Often · Normal · Rarely)
- ✅ Volume slider
- ✅ Audio-reactive glow on the window

### Personalization
- ✅ Dark / Light / System theme
- ✅ English / Arabic (RTL support)
- ✅ Animations on/off
- ✅ Launch at startup

### Native macOS
- ✅ Lives in the menu bar — always one click away
- ✅ Transparent window with blur
- ✅ Native macOS traffic lights
- ✅ Keyboard shortcut: Escape to hide

---

## 6. Sound Packs (شرح لكل باك)

| الاسم | النوع | الوصف |
|---|---|---|
| **Soft Pop** | Built-in | ناعم ومريح — الافتراضي |
| **Crisp Click** | Built-in | واضح ومحدد |
| **Minimal** | Built-in | هادئ جداً |
| **Elsisi** | File-based | باك صوتي مميز |
| **Bahgt** | File-based | باك صوتي مميز |
| **El Guyar** | File-based | باك صوتي بطابع موسيقي |

---

## 7. أبعاد النافذة

```
Width:  360px  (min: 320px)
Height: 580px  (min: 500px)
Style:  Transparent + Overlay title bar
Shadow: None
```

مناسب لـ mockup في screenshots على خلفية dark.

---

## 8. Views / الشاشات

### 1. Task List (الرئيسية)
- Header: "My Tasks" + count + settings icon
- Empty state: أيقونة + "Tap + to add a task"
- Floating "+" button في الأسفل
- كل task: checkbox + title + deadline + progress badge
- اضغط على task تتفتح sub-steps

### 2. Onboarding
- اسم المستخدم (اختياري)
- إيميل (اختياري)
- اختيار sound pack
- اختيار theme
- تشغيل/إيقاف الصوت
- زرار "Get Started"

### 3. Settings
- Appearance (Theme + Animations)
- Tasks (Auto-sort)
- Sound (Volume + event toggles)
- Sound Pack (grid of pack buttons)
- Ambient Sound (idle sounds + hours)
- System (Launch at startup)
- Language
- Trash

### 4. Archive
- مهام مكتملة بـ strikethrough
- زرار restore لكل مهمة

### 5. Trash
- مهام محذوفة
- Restore / Delete forever
- Empty Trash button

---

## 9. Design Personality (للـ copy)

**الهوية:** Minimal · Focused · Native-feeling · Sound-first

**الكلمات المناسبة للـ landing:**
- "Lightweight" / "Tiny" / "Lives in your menu bar"
- "Distraction-free"
- "Feels native"
- "One click away"
- "Sound that makes you feel productive"
- "Dark by default"

**ما يميزه:**
1. الصوت — مش مجرد app صامت، فيه شخصية صوتية كاملة
2. Menu bar native — مش app كبير بيفتح في الـ dock
3. البساطة — tasks وchecklist بس، بدون تعقيد
4. الشكل — dark، أكسنت أصفر ذهبي، ناعم ومتكامل

---

## 10. اقتراح هيكل الـ Landing Page

```
[Hero]
  App icon + TASK FM
  "A tiny checklist that lives in your menu bar."
  [Download for macOS] button → أصفر #F5C542
  Screenshot/mockup للأبلكيشن

[Features - 3 columns]
  🎵 Sound-first experience
  ✓ Checklist that works
  🌙 Lives in your menu bar

[Sound section]
  عرض الـ sound packs الـ 6

[Screenshots]
  Task list / Settings / Archive

[How it works - 3 steps]
  1. Click the menu bar icon
  2. Add tasks & checklists
  3. Hear your progress

[Download]
  [Download for macOS - Free]
  Version 1.0 · macOS 12+

[Footer]
  © 2025 TASK FM. All rights reserved.
```

---

## 11. Tailwind / CSS للاستخدام المباشر في الـ Landing

```css
/* خلفية الـ hero */
background: #0e0e0e;

/* CTA button */
background: #F5C542;
color: #000;
font-weight: 700;
border-radius: 12px;
padding: 14px 28px;

/* Card / feature box */
background: #1c1c1e;
border: 1px solid rgba(255,255,255,0.09);
border-radius: 16px;

/* Accent text */
color: #F5C542;

/* Subtext */
color: #8e8e93;

/* Font */
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
```

---

*ملف مرجعي للـ landing page — TASK FM v1.0*
