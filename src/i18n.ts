export const translations = {
  en: {
    // Header
    myTasks: 'My Tasks',
    settings: 'Settings',
    archive: 'Archive',
    trash: 'Trash',

    // Task list
    remaining: (n: number) => `${n} remaining`,
    tapToAdd: 'Tap + to add a task',
    taskNamePlaceholder: 'Task name…',
    newItemPlaceholder: 'New item…',
    addChecklist: '+ checklist',

    // Context menu
    archiveTask: 'Archive',
    deleteTask: 'Delete',

    // Confirmations
    confirmYes: '✓',
    confirmNo: '✕',

    // Archive view
    archiveTitle: 'Archive',
    archiveEmpty: 'Archive is empty',
    restore: 'Restore',

    // Trash view
    trashTitle: 'Trash',
    trashEmpty: 'Trash is empty',
    emptyTrash: 'Empty Trash',
    deleteForever: 'Delete forever',

    // Settings
    appearance: 'Appearance',
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    themeSystem: 'System',
    animations: 'Animations',

    tasks: 'Tasks',
    autoSortCompleted: 'Auto-sort completed',
    autoSortDesc: 'Move done items to bottom',

    sound: 'Sound',
    sounds: 'Sounds',
    volume: 'Volume',
    taskCreated: 'Task created',
    itemChecked: 'Item checked',
    taskCompleted: 'Task completed',

    soundPack: 'Sound Pack',

    elsisiPack: 'Elsisi Pack',
    elsisiSounds: 'Elsisi Sounds',
    elsisiReady: '✓ Ready',
    elsisiInstall: 'Install Elsisi Sounds',
    elsisiInstallDesc: 'Place "Elsisi sounds.zip" in Downloads',
    elsisiInstallBtn: 'Install from Downloads',
    elsisiInstalling: 'Installing…',

    ambientSound: 'Ambient Sound',
    randomIdle: 'Random idle sound',
    randomIdleDesc: 'Plays a sound during the day',
    frequency: 'Frequency',
    freqMany: 'Often',
    freqNormal: 'Normal',
    freqFew: 'Rarely',
    randomizeTiming: 'Randomize timing',
    randomizeDesc: 'Vary within the hour',
    activeHours: 'Active hours',

    customSounds: 'Custom Sounds',
    useCustomSounds: 'Use custom sounds',
    loaded: (n: number) => `Loaded: ${n} file${n !== 1 ? 's' : ''}`,
    soundsFolder: 'Sounds folder',
    reloadSounds: 'Reload sounds',

    system: 'System',
    launchAtStartup: 'Launch at startup',

    language: 'Language',

    trashSection: 'Trash',
    trashDesc: (n: number) => `${n} deleted item${n !== 1 ? 's' : ''}`,
    openTrash: 'Open Trash',

    // Onboarding
    onboardingTitle: 'Meet TASK FM.',
    onboardingSub: 'A tiny checklist that lives in your menu bar.',
    yourName: 'Your name',
    namePlaceholder: 'Enter your name…',
    yourEmail: 'Email (optional)',
    emailPlaceholder: 'your@email.com',
    pickYourSound: 'Pick your sound',
    tapToPreview: 'Tap to preview',
    enableSoundsLabel: 'Enable sounds',
    ambientSoundsLabel: 'Random idle sound',
    getStarted: 'Get Started',
    logout: 'Log Out',
    updateAvailable: 'Update available',
    updateNow: 'Update',
    updating: 'Updating…',
  },

  ar: {
    // Header
    myTasks: 'مهامي',
    settings: 'الإعدادات',
    archive: 'الأرشيف',
    trash: 'المهملات',

    // Task list
    remaining: (n: number) => `${n} متبقية`,
    tapToAdd: 'اضغط + لإضافة مهمة',
    taskNamePlaceholder: 'اسم المهمة…',
    newItemPlaceholder: 'عنصر جديد…',
    addChecklist: '+ قائمة',

    // Context menu
    archiveTask: 'أرشفة',
    deleteTask: 'حذف',

    // Confirmations
    confirmYes: '✓',
    confirmNo: '✕',

    // Archive view
    archiveTitle: 'الأرشيف',
    archiveEmpty: 'الأرشيف فارغ',
    restore: 'استعادة',

    // Trash view
    trashTitle: 'المهملات',
    trashEmpty: 'المهملات فارغة',
    emptyTrash: 'إفراغ المهملات',
    deleteForever: 'حذف نهائي',

    // Settings
    appearance: 'المظهر',
    theme: 'الثيم',
    themeDark: 'داكن',
    themeLight: 'فاتح',
    themeSystem: 'النظام',
    animations: 'الحركات',

    tasks: 'المهام',
    autoSortCompleted: 'ترتيب المنتهية تلقائياً',
    autoSortDesc: 'نقل المنجزة للأسفل',

    sound: 'الصوت',
    sounds: 'الأصوات',
    volume: 'مستوى الصوت',
    taskCreated: 'إنشاء مهمة',
    itemChecked: 'تحديد عنصر',
    taskCompleted: 'إنهاء مهمة',

    soundPack: 'حزمة الأصوات',

    elsisiPack: 'حزمة إلسيسي',
    elsisiSounds: 'أصوات إلسيسي',
    elsisiReady: '✓ جاهز',
    elsisiInstall: 'تثبيت أصوات إلسيسي',
    elsisiInstallDesc: 'ضع "Elsisi sounds.zip" في التنزيلات',
    elsisiInstallBtn: 'تثبيت من التنزيلات',
    elsisiInstalling: 'جارٍ التثبيت…',

    ambientSound: 'الصوت المحيطي',
    randomIdle: 'صوت عشوائي',
    randomIdleDesc: 'يعزف صوتاً خلال اليوم',
    frequency: 'التكرار',
    freqMany: 'كتير',
    freqNormal: 'عادي',
    freqFew: 'قليل',
    randomizeTiming: 'عشوائية التوقيت',
    randomizeDesc: 'التنويع داخل الساعة',
    activeHours: 'ساعات التفعيل',

    customSounds: 'أصوات مخصصة',
    useCustomSounds: 'استخدام أصوات مخصصة',
    loaded: (n: number) => `محمّل: ${n} ملف`,
    soundsFolder: 'مجلد الأصوات',
    reloadSounds: 'إعادة تحميل',

    system: 'النظام',
    launchAtStartup: 'تشغيل عند البدء',

    language: 'اللغة',

    trashSection: 'المهملات',
    trashDesc: (n: number) => `${n} عنصر محذوف`,
    openTrash: 'فتح المهملات',

    // Onboarding
    onboardingTitle: 'أهلاً بك في TASK FM.',
    onboardingSub: 'قائمة مهام صغيرة تعيش في شريط القوائم.',
    yourName: 'اسمك',
    namePlaceholder: 'أدخل اسمك…',
    yourEmail: 'البريد الإلكتروني (اختياري)',
    emailPlaceholder: 'بريدك@هنا.com',
    pickYourSound: 'اختر صوتك',
    tapToPreview: 'اضغط للاستماع',
    enableSoundsLabel: 'تفعيل الأصوات',
    ambientSoundsLabel: 'صوت عشوائي',
    getStarted: 'ابدأ الآن',
    logout: 'تسجيل الخروج',
    updateAvailable: 'تحديث جديد متاح',
    updateNow: 'تحديث',
    updating: 'جاري التحديث…',
  },
} as const;

export type Lang = keyof typeof translations;
export type T = typeof translations.en;
