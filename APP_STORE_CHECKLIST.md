# TASK FM — خطوات النشر بعد الاشتراك في Apple Developer Program

> كل التعديلات التقنية اللي مش محتاجة حساب اتعملت خلاص (شوف قسم "اللي اتعمل" تحت).
> الملف ده فيه بس اللي فاضل، بالترتيب.

---

## المرحلة 1: تجهيز الحساب (مرة واحدة)

1. **اشترك في Apple Developer Program** ($99/سنة) من [developer.apple.com](https://developer.apple.com/programs/enroll/)
2. **سجّل الـ Bundle ID**: من [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → Identifiers → App IDs → سجّل `com.taskfm.app` (لازم يطابق الـ identifier في `tauri.conf.json`)
3. **اعمل الشهادات** (من Xcode → Settings → Accounts → Manage Certificates، أو من الموقع):
   - `Developer ID Application` ← للنسخة اللي هتتوزع من اللاندينج بيدج
   - `Apple Distribution` ← لنسخة الـ Mac App Store
   - `Mac Installer Distribution` ← لتوقيع الـ .pkg بتاع الـ Store
4. **اعمل App في App Store Connect**: [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps → + → New App → macOS → اربطها بـ `com.taskfm.app`
5. **اعمل Provisioning Profile** نوع Mac App Store لـ `com.taskfm.app` ونزّله باسم `embedded.provisionprofile`

---

## المرحلة 2: نسخة اللاندينج بيدج (Developer ID + Notarization)

```bash
# 1. اعرف اسم الـ signing identity بتاعتك
security find-identity -v -p codesigning
# هتلاقي حاجة زي: "Developer ID Application: YOUR NAME (TEAMID)"

# 2. جهّز App-Specific Password للـ notarization
# من appleid.apple.com → Sign-In and Security → App-Specific Passwords

# 3. ابني موقّع ومُوثّق في خطوة واحدة
export APPLE_SIGNING_IDENTITY="Developer ID Application: YOUR NAME (TEAMID)"
export APPLE_ID="your@appleid.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
npm run tauri build -- --target universal-apple-darwin
# Tauri هيوقّع ويبعت للـ notarization تلقائيًا لما الـ env vars دي موجودة
```

6. اتأكد إن الـ DMG سليم: `spctl -a -t open --context context:primary-signature -v path/to/TASK\ FM.dmg` — المفروض تشوف `accepted`
7. **ارفع الـ DMG** كـ Release جديد `v1.0.0` على GitHub (`Nedal-Elnono/task-fm-app`) باسم `TASK-FM-mac-1.0.0.dmg`
8. **حدّث لينك التحميل** في `landing/index.html` (سطر واحد): غيّر `releases/download/v0.0.1/TASK-FM-mac-0.0.1.dmg` لـ `releases/download/v1.0.0/TASK-FM-mac-1.0.0.dmg` وانشر التحديث على taskfm.shop — فولدر `landing/` هو نسخة مطابقة من الموقع الحالي + صفحتي `privacy.html` و`terms.html` الجداد

> ⚠️ ملحوظة: أول نسخة موقّعة sandboxed هتبدأ بيانات جديدة في `~/Library/Containers/com.taskfm.app` — مستخدمي النسخة القديمة غير الموقّعة (0.0.1) مش هيلاقوا مهامهم القديمة تلقائيًا.

---

## المرحلة 3: نسخة الـ Mac App Store

الـ Store بياخد `.pkg` موقّع مش DMG. Tauri v2 مش بيعمل ده أوتوماتيك بالكامل، فالخطوات:

```bash
# 1. ابني الـ .app بشهادة Apple Distribution
export APPLE_SIGNING_IDENTITY="Apple Distribution: YOUR NAME (TEAMID)"
npm run tauri build -- --target universal-apple-darwin --bundles app

APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/TASK FM.app"

# 2. حط الـ provisioning profile جوه الـ bundle
cp embedded.provisionprofile "$APP/Contents/embedded.provisionprofile"

# 3. أعد التوقيع بالـ entitlements (الملف موجود خلاص في src-tauri/Entitlements.plist)
codesign --deep --force --options runtime \
  --entitlements src-tauri/Entitlements.plist \
  --sign "Apple Distribution: YOUR NAME (TEAMID)" "$APP"

# 4. اعمل الـ .pkg
productbuild --component "$APP" /Applications \
  --sign "3rd Party Mac Developer Installer: YOUR NAME (TEAMID)" \
  TASK-FM-1.0.0.pkg

# 5. ارفع بـ Transporter (نزّله من الـ Mac App Store) أو:
xcrun altool --upload-app -f TASK-FM-1.0.0.pkg -t macos \
  -u "your@appleid.com" -p "app-specific-password"
```

---

## المرحلة 4: صفحة الـ App Store Connect

املا الحقول دي (كلها جاهزة تقريبًا):

| الحقل | القيمة |
|---|---|
| **Name** | TASK FM |
| **Subtitle** | A tiny checklist in your menu bar |
| **Category** | Productivity |
| **Description** | خد الوصف من `landing/index.html` أو `LANDING_PAGE_BRIEF.md` |
| **Keywords** | todo, checklist, menu bar, tasks, productivity, minimal |
| **Support URL** | `https://taskfm.shop/` |
| **Privacy Policy URL** | `https://taskfm.shop/privacy.html` (الصفحة جاهزة في `landing/privacy.html` — لازم تترفع على الموقع الأول) |
| **App Privacy** | "Data Not Collected" — التطبيق مش بيجمع أي حاجة |
| **Price** | Free |

- **سكرينشوتات**: مقاسات مقبولة: 1280×800 / 1440×900 / 2560×1600 / 2880×1800. صوّر التطبيق على خلفية نضيفة (⌘⇧5) واعمل resize
- **App Review Notes**: اكتب إن التطبيق menu bar app — المراجع يدوس على أيقونة الـ menu bar عشان يشوف الواجهة

---

## ✅ اللي اتعمل خلاص (ما يحتاجش إعادة)

- شيل `macOSPrivateApi` وميزة `macos-private-api` والشفافية → النافذة دلوقتي عادية بحواف native (كان هيترفض فورًا)
- شيل `tauri-plugin-autostart` بالكامل (كان بيستخدم LaunchAgent الممنوع في الـ Sandbox، ومكانش مستخدم في الواجهة أصلًا)
- استبدال `unzip` subprocess بمكتبة `zip` جوه التطبيق (الـ subprocess مش هيشتغل في الـ Sandbox)
- ملف `src-tauri/Entitlements.plist` بالـ App Sandbox + user-selected files، ومربوط في `tauri.conf.json`
- `Info.plist`: إضافة `ITSAppUsesNonExemptEncryption=false` + copyright + category
- CSP محكمة بدل `null`
- توحيد الإصدار على `1.0.0` في `tauri.conf.json` + `Cargo.toml` + `package.json`
- عنوان `index.html` من "Tick" لـ "TASK FM"
- فولدر `landing/` فيه نسخة مطابقة من موقع taskfm.shop الحالي (index.html + الصور) + صفحتين جداد بنفس الديزاين: `privacy.html` و`terms.html` (Apple بتشترط لينك privacy مستقل مش modal)
