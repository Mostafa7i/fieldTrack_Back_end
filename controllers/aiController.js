const Student = require('../models/Student');
const Internship = require('../models/Internship');
const Application = require('../models/Application');

// ─── Configuration ─────────────────────────────────────────────────────────────
const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash'];
const TIMEOUT_MS = 25000;
const MAX_RETRIES = 2;

// ─── In-Memory Response Cache ──────────────────────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 150;
const responseCache = new Map();

const getCacheKey = (message, role) =>
  `${role}::${message.toLowerCase().trim().replace(/\s+/g, ' ')}`;

const getFromCache = (key) => {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { responseCache.delete(key); return null; }
  return entry.value;
};

const setToCache = (key, value) => {
  if (responseCache.size >= MAX_CACHE_SIZE) {
    responseCache.delete(responseCache.keys().next().value);
  }
  responseCache.set(key, { value, ts: Date.now() });
};

// ─── Knowledge Base ────────────────────────────────────────────────────────────
// Questions that are GUARANTEED to answer perfectly with no API call.
// Each entry has trigger keywords and a full polished answer in AR + EN.
const KNOWLEDGE_BASE = [
  {
    id: 'greeting',
    triggers: {
      ar: ['مرحبا', 'مرحباً', 'هلا', 'السلام', 'أهلا', 'اهلا', 'ازيك', 'كيفك', 'صباح', 'مساء'],
      en: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good evening', 'howdy']
    },
    answer: {
      ar: `مرحباً بك في **FieldTrack AI** 👋

أنا المساعد الذكي لمنصة إدارة التدريب الميداني. يمكنني مساعدتك في:

• **فهم النظام وأدواره** المختلفة
• **التعرف على المزايا** التي توفرها المنصة
• **الإجابة على أسئلتك** حول التدريب الميداني

ماذا تريد أن تعرف؟`,
      en: `Welcome to **FieldTrack AI** 👋

I'm the intelligent assistant for the Field Training Management System. I can help you with:

• **Understanding the system** and its roles
• **Exploring platform features** and capabilities
• **Answering your questions** about field training

What would you like to know?`
    }
  },
  {
    id: 'what_is_fieldtrack',
    triggers: {
      ar: ['ما هو', 'ايه ده', 'إيه ده', 'شرح', 'fieldtrack', 'فيلد تراك', 'المنصة دي', 'النظام ده', 'عن المنصة', 'عن النظام', 'يعمل ايه', 'يعمل إيه', 'الموقع بيعمل'],
      en: ['what is fieldtrack', 'what does fieldtrack', 'tell me about', 'explain the platform', 'about the system', 'what is this', 'what does this']
    },
    answer: {
      ar: `**FieldTrack** هي منصة متكاملة لإدارة التدريب الميداني 🎓

**الهدف:** ربط الطلاب بالشركات والمشرفين في منظومة واحدة ذكية وسلسة.

**كيف تعمل؟**
1. **الطالب** يتصفح الفرص التدريبية ويقدم طلبات
2. **الشركة** تنشر الفرص وتقيّم المتقدمين بمساعدة الذكاء الاصطناعي
3. **المشرف** يتابع تقدم الطلاب ويراجع تقاريرهم
4. **المسؤول** يدير المنصة بالكامل ويراقب الإحصائيات

**التقنيات المستخدمة:**
• Backend: Node.js + Express + MongoDB
• Frontend: Next.js (React)
• AI: Google Gemini API
• Auth: JWT`,
      en: `**FieldTrack** is a comprehensive Field Training Management Platform 🎓

**Goal:** Connect students, companies, and supervisors in one intelligent, seamless system.

**How it works:**
1. **Students** browse internship opportunities and submit applications
2. **Companies** post opportunities and evaluate applicants with AI assistance
3. **Supervisors** monitor student progress and review their reports
4. **Admins** manage the entire platform and monitor statistics

**Tech Stack:**
• Backend: Node.js + Express + MongoDB
• Frontend: Next.js (React)
• AI: Google Gemini API
• Auth: JWT`
    }
  },
  {
    id: 'system_roles',
    triggers: {
      ar: ['ادوار', 'أدوار', 'الدور', 'مستخدمين', 'طالب', 'شركة', 'مشرف', 'مسؤول', 'صلاحيات', 'انواع المستخدمين', 'أنواع'],
      en: ['roles', 'user roles', 'student', 'company', 'supervisor', 'admin', 'types of users', 'permissions', 'who can']
    },
    answer: {
      ar: `**أدوار النظام في FieldTrack** 👥

**🎓 الطالب (Student)**
• يتصفح ويقدم على فرص التدريب
• يرفع تقارير التدريب الأسبوعية
• يتابع حضوره وتقييماته
• يحصل على توصيات AI مخصصة

**🏢 الشركة (Company)**
• تنشر الفرص التدريبية
• تقبل أو ترفض طلبات الطلاب
• تقيّم الطلاب بمساعدة الذكاء الاصطناعي
• تصدر تقييمات الأداء

**👨‍🏫 المشرف (Supervisor)**
• يتابع مجموعة طلاب مخصصين له
• يراجع ويعتمد تقاريرهم
• يراقب سجل الحضور
• يكلّف الطلاب بمهام

**🛡️ المسؤول (Admin)**
• يدير جميع المستخدمين والحسابات
• يوافق على التحقق من الشركات
• يشاهد إحصائيات المنصة الكاملة
• يُعيّن المشرفين للطلاب`,
      en: `**System Roles in FieldTrack** 👥

**🎓 Student**
• Browses and applies for internship opportunities
• Submits weekly training reports
• Tracks attendance and evaluations
• Receives personalized AI recommendations

**🏢 Company**
• Posts internship opportunities
• Accepts or rejects student applications
• Evaluates applicants with AI assistance
• Issues performance evaluations

**👨‍🏫 Supervisor**
• Monitors an assigned group of students
• Reviews and approves their reports
• Monitors attendance records
• Assigns tasks to students

**🛡️ Admin**
• Manages all users and accounts
• Verifies and approves company accounts
• Views full platform statistics
• Assigns supervisors to students`
    }
  },
  {
    id: 'features',
    triggers: {
      ar: ['مزايا', 'خصائص', 'خاصية', 'ميزات', 'ميزة', 'يوفر', 'تقدر', 'امكانيات', 'إمكانيات', 'وظائف', 'قدرات'],
      en: ['features', 'capabilities', 'what can', 'offers', 'provide', 'functionalities', 'what does it do', 'abilities']
    },
    answer: {
      ar: `**مزايا منصة FieldTrack** ✨

🤖 **ذكاء اصطناعي متكامل**
• توصيات تدريب مخصصة للطلاب
• تقييم تطابق الطالب مع الفرصة (Match Score)
• مساعد ذكي على مدار الساعة

📋 **إدارة شاملة**
• إدارة الفرص التدريبية والطلبات
• متابعة التقارير الأسبوعية
• نظام تقييم متعدد المراحل

📊 **تتبع وإحصائيات**
• سجل الحضور والغياب
• لوحة تحكم بإحصائيات فورية
• تقارير PDF قابلة للتصدير

🔔 **إشعارات فورية**
• إشعار فوري عند قبول الطلب أو رفضه
• تنبيهات المهام والتقارير

🌍 **دعم متعدد اللغات**
• واجهة كاملة بالعربية والإنجليزية`,
      en: `**FieldTrack Platform Features** ✨

🤖 **Integrated AI**
• Personalized internship recommendations for students
• Student-opportunity match scoring
• 24/7 intelligent assistant

📋 **Comprehensive Management**
• Manage internship opportunities and applications
• Track weekly training reports
• Multi-stage evaluation system

📊 **Tracking & Analytics**
• Attendance and absence records
• Real-time statistics dashboard
• Exportable PDF reports

🔔 **Real-time Notifications**
• Instant alerts on application acceptance/rejection
• Task and report reminders

🌍 **Multi-language Support**
• Full Arabic and English interface`
    }
  },
  {
    id: 'how_help',
    triggers: {
      ar: ['تساعدني', 'تعمل ايه', 'تعمل إيه', 'تقدر', 'وظيفتك', 'دورك', 'ايه اللي', 'إيه اللي', 'كيف'],
      en: ['how can you help', 'what can you do', 'your role', 'your job', 'assist me', 'help me with']
    },
    answer: {
      ar: `**كيف يمكنني مساعدتك؟** 🤖

أنا **FieldTrack AI** — مساعدك الذكي داخل المنصة. إليك ما يمكنني فعله:

📌 **الإجابة على أسئلتك** حول النظام وكيفية استخدامه
👥 **شرح أدوار المستخدمين** ومسؤولياتهم
✨ **استعراض مزايا المنصة** وإمكانياتها
🎓 **إرشادك** خلال عملية التقديم على التدريب
📊 **شرح كيفية** رفع التقارير ومتابعة الحضور

فقط اكتب سؤالك وسأرد عليك فوراً! 💬`,
      en: `**How Can I Help You?** 🤖

I'm **FieldTrack AI** — your intelligent assistant inside the platform. Here's what I can do:

📌 **Answer your questions** about the system and how to use it
👥 **Explain user roles** and their responsibilities
✨ **Walk you through the platform features** and capabilities
🎓 **Guide you** through the internship application process
📊 **Explain how to** submit reports and track attendance

Just type your question and I'll reply instantly! 💬`
    }
  },
  {
    id: 'ai_features',
    triggers: {
      ar: ['ذكاء', 'ai', 'الذكاء الاصطناعي', 'توصيات', 'تقييم ذكي', 'match', 'جيمناي', 'gemini'],
      en: ['ai', 'artificial intelligence', 'smart', 'recommendations', 'ai evaluation', 'match score', 'gemini']
    },
    answer: {
      ar: `**ميزات الذكاء الاصطناعي في FieldTrack** 🤖

**1️⃣ التوصيات الشخصية (للطالب)**
• يحلل مهاراتك وتخصصك
• يرشح لك أفضل 5 فرص تدريبية تناسبك تلقائياً

**2️⃣ تقييم التطابق (للشركة)**
• يحسب **نسبة التطابق** بين الطالب والوظيفة (0-100%)
• يُبرز نقاط القوة والضعف لكل متقدم
• يوفر توصية مختصرة للمساعدة في اتخاذ القرار

**3️⃣ المساعد الذكي (لجميع الأدوار)**
• أنا! متاح لمساعدتك في أي وقت
• يفهم العربية والإنجليزية
• يحافظ على سياق المحادثة

كل هذا مدعوم بـ **Google Gemini** 🚀`,
      en: `**AI Features in FieldTrack** 🤖

**1️⃣ Personalized Recommendations (for Students)**
• Analyzes your skills and major
• Automatically suggests the top 5 best-matching internships

**2️⃣ Match Evaluation (for Companies)**
• Calculates a **match score** between student and role (0-100%)
• Highlights strengths and weaknesses of each applicant
• Provides a concise recommendation to aid decisions

**3️⃣ AI Assistant (for All Roles)**
• That's me! Available to help you anytime
• Understands Arabic and English
• Maintains conversation context

All powered by **Google Gemini** 🚀`
    }
  },
  {
    id: 'internship_apply',
    triggers: {
      ar: ['تقديم', 'تقدم', 'كيف اتقدم', 'طلب تدريب', 'فرص تدريب', 'internship', 'apply', 'طلبات'],
      en: ['apply', 'application', 'how to apply', 'internship', 'submit application', 'job application']
    },
    answer: {
      ar: `**كيفية التقديم على التدريب** 📋

**الخطوات:**
1. سجّل دخولك كـ **طالب**
2. انتقل إلى قسم **"الفرص التدريبية"**
3. تصفح الفرص المتاحة أو استخدم **توصيات AI** المخصصة
4. اضغط على فرصة لمشاهدة التفاصيل
5. اضغط **"تقدم الآن"** وأرسل طلبك

**ماذا يحدث بعدها؟**
• تصلك إشعار بحالة طلبك
• الشركة تراجع طلبك وتقرر القبول أو الرفض
• عند القبول، يبدأ مسار التدريب الرسمي 🎉`,
      en: `**How to Apply for an Internship** 📋

**Steps:**
1. Log in as a **Student**
2. Navigate to the **"Internships"** section
3. Browse available opportunities or use **AI Recommendations**
4. Click on an opportunity to view details
5. Press **"Apply Now"** and submit your application

**What happens next?**
• You receive a notification about your application status
• The company reviews your application and decides
• Upon acceptance, your official training journey begins 🎉`
    }
  },
  {
    id: 'reports_attendance',
    triggers: {
      ar: ['تقرير', 'تقارير', 'حضور', 'غياب', 'رفع تقرير', 'سجل'],
      en: ['report', 'reports', 'attendance', 'submit report', 'weekly report', 'log']
    },
    answer: {
      ar: `**التقارير والحضور في FieldTrack** 📊

**📝 التقارير الأسبوعية (الطالب)**
• يرفع الطالب تقريراً أسبوعياً يصف تقدمه
• المشرف يراجع التقرير ويضيف ملاحظاته
• يمكن تصدير التقارير كـ PDF

**📅 سجل الحضور**
• يُسجَّل حضور الطالب يومياً
• المشرف يراقب الالتزام بالحضور
• المسؤول يرى تقارير الحضور الإجمالية

**📈 لوحة التحكم**
• إحصائيات فورية لجميع المستخدمين
• تتبع التقدم عبر الزمن`,
      en: `**Reports & Attendance in FieldTrack** 📊

**📝 Weekly Reports (Student)**
• Student submits a weekly report describing their progress
• Supervisor reviews the report and adds feedback
• Reports can be exported as PDF

**📅 Attendance Records**
• Student attendance is logged daily
• Supervisor monitors attendance commitment
• Admin views overall attendance summaries

**📈 Dashboard**
• Real-time statistics for all users
• Progress tracking over time`
    }
  }
];

/**
 * Checks if a message matches a Knowledge Base entry.
 * Returns the answer if matched, or null if not.
 */
const getKBAnswer = (message, locale) => {
  const lang = locale === 'ar' ? 'ar' : 'en';
  const msgLower = message.toLowerCase().trim();

  for (const entry of KNOWLEDGE_BASE) {
    const triggers = [...(entry.triggers.ar || []), ...(entry.triggers.en || [])];
    for (const trigger of triggers) {
      if (msgLower.includes(trigger.toLowerCase())) {
        return entry.answer[lang];
      }
    }
  }
  return null;
};

/**
 * Generic fallback when both KB and AI fail.
 */
const getGenericFallback = (locale) => {
  if (locale === 'ar') {
    return `شكراً لسؤالك! منصة **FieldTrack** تُبسّط إدارة التدريب الميداني بربط الطلاب والشركات والمشرفين.

يمكنك سؤالي عن:
• أدوار النظام
• مزايا المنصة
• كيفية التقديم على التدريب
• ميزات الذكاء الاصطناعي`;
  }
  return `Thanks for your question! **FieldTrack** simplifies field training management by connecting students, companies, and supervisors.

You can ask me about:
• System roles
• Platform features
• How to apply for internships
• AI capabilities`;
};

// ─── Multi-Key API Keys ────────────────────────────────────────────────────────
const getApiKeys = () => {
  const keys = [];
  if (process.env.GEMINI_API_KEY)   keys.push(process.env.GEMINI_API_KEY);
  if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2);
  if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3);
  if (process.env.GEMINI_API_KEY_4) keys.push(process.env.GEMINI_API_KEY_4);
  return keys;
};

// ─── Core: Gemini API with Multi-Key Rotation + Model Fallback ────────────────
const generateContent = async (contents) => {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) throw new Error('GEMINI_API_KEY_MISSING');

  let lastError;

  for (const apiKey of apiKeys) {
    for (const model of MODELS) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents }),
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const status = response.status;

            if (status === 400 || status === 403) {
              throw new Error(errorData.error?.message || `API Error ${status}`);
            }
            if (status === 429) {
              console.warn(`[AI] Quota on key ...${apiKey.slice(-4)}, next key.`);
              lastError = new Error('QUOTA_EXCEEDED');
              break;
            }

            lastError = new Error(errorData.error?.message || `API Error ${status}`);
            if (attempt < MAX_RETRIES) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
            break;
          }

          const data = await response.json();
          const candidate = data.candidates?.[0];
          if (!candidate) throw new Error('AI_NO_CANDIDATE');
          if (candidate.finishReason === 'SAFETY') throw new Error('SAFETY_BLOCK');

          console.log(`[AI] OK — key ...${apiKey.slice(-4)}, model: ${model}`);
          return candidate.content.parts[0].text;

        } catch (err) {
          clearTimeout(timeoutId);
          if (['GEMINI_API_KEY_MISSING', 'SAFETY_BLOCK'].includes(err.message)) throw err;
          if (err.message === 'QUOTA_EXCEEDED') { lastError = err; break; }
          lastError = err.name === 'AbortError' ? new Error('REQUEST_TIMEOUT') : err;
          if (attempt < MAX_RETRIES) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
          break;
        }
      }
    }
  }

  throw lastError || new Error('AI_UNAVAILABLE');
};

// ─── Error Translator ──────────────────────────────────────────────────────────
const translateError = (err) => {
  const msg = err.message || '';
  if (msg === 'GEMINI_API_KEY_MISSING')
    return { status: 503, message: 'AI service is not configured. Please contact the administrator.' };
  if (msg === 'REQUEST_TIMEOUT')
    return { status: 504, message: 'The AI took too long to respond. Please try again.' };
  if (msg === 'SAFETY_BLOCK')
    return { status: 422, message: 'Your message was flagged by the content filter. Please rephrase.' };
  if (msg === 'QUOTA_EXCEEDED')
    return { status: 429, message: 'AI quota exhausted. Please try again in a few minutes.' };
  return { status: 503, message: 'AI service is temporarily unavailable. Please try again later.' };
};

// ─── 1. Health Check ───────────────────────────────────────────────────────────
exports.healthCheck = (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({
    status: hasKey ? 'ok' : 'kb-only',
    model: MODELS[0],
    kbEntries: KNOWLEDGE_BASE.length,
    cacheSize: responseCache.size,
  });
};

// ─── 2. Chat Assistant ─────────────────────────────────────────────────────────
// Flow: Cache → Knowledge Base → Gemini API → Generic Fallback
exports.chatAssistant = async (req, res) => {
  try {
    const { message, history = [], context } = req.body;
    const userRole = req.user.role;
    const locale = req.body.locale || 'en';

    if (!message?.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' });
    }

    // ── Step 1: Cache ──────────────────────────────────────────────────────────
    const cacheKey = getCacheKey(message, userRole);
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log(`[AI] Cache HIT`);
      return res.json({ reply: cached, source: 'cache' });
    }

    // ── Step 2: Knowledge Base ─────────────────────────────────────────────────
    const kbAnswer = getKBAnswer(message, locale);
    if (kbAnswer) {
      console.log(`[AI] KB HIT`);
      setToCache(cacheKey, kbAnswer);
      return res.json({ reply: kbAnswer, source: 'kb' });
    }

    // ── Step 3: Gemini API ─────────────────────────────────────────────────────
    const systemInstruction = `You are FieldTrack AI, an intelligent assistant for a Field Training Management System.
User role: "${userRole}". Page: ${context?.url || 'unknown'}.
- Reply in the same language as the user (Arabic → Arabic, English → English).
- Be helpful, concise, and professional. Under 200 words unless asked for more.
- Do not make up information about the system you are unsure of.`;

    const contents = [
      { role: 'user', parts: [{ text: systemInstruction }] },
      { role: 'model', parts: [{ text: 'Understood. I am FieldTrack AI, ready to assist.' }] },
      ...history.slice(-8).map(h => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: message }] },
    ];

    try {
      const reply = await generateContent(contents);
      setToCache(cacheKey, reply);
      return res.json({ reply, source: 'ai' });
    } catch (apiError) {
      // ── Step 4: Generic Fallback ─────────────────────────────────────────────
      console.warn(`[AI] API failed (${apiError.message}), using fallback.`);
      const fallback = getGenericFallback(locale);
      return res.json({ reply: fallback, source: 'fallback' });
    }

  } catch (error) {
    console.error(`[AI Chat] ${error.message}`);
    const { status, message } = translateError(error);
    res.status(status).json({ message });
  }
};

// ─── 3. Evaluate Applicant ────────────────────────────────────────────────────
exports.evaluateApplicant = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await Application.findById(applicationId)
      .populate('student', 'name email')
      .populate('internship');

    if (!application) return res.status(404).json({ message: 'Application not found' });
    
    // Check if student user was deleted
    if (!application.student || !application.student._id) {
       return res.status(404).json({ message: 'Student account was deleted or not found' });
    }

    const studentCustomData = await Student.findOne({ user: application.student._id });
    if (!studentCustomData) return res.status(404).json({ message: 'Student details not found' });

    const internshipDetails = application.internship;
    if (!internshipDetails) return res.status(404).json({ message: 'Internship details not found' });

    const prompt = `You are an expert HR AI evaluator for an internship portal.
Evaluate how well this student matches the internship requirements.

Internship: ${internshipDetails.title || 'Untitled'}
Description: ${internshipDetails.description || ''}
Requirements: ${internshipDetails.requirements || ''}
Skills: ${(internshipDetails.skills || []).join(', ')}

Student Major: ${studentCustomData.major || 'Not provided'} / ${studentCustomData.faculty || 'Not provided'}
GPA: ${studentCustomData.gpa || 'Not provided'}
Skills: ${(studentCustomData.skills || []).join(', ')}
Bio: ${studentCustomData.bio || 'Not provided'}

Respond ONLY with raw JSON (no markdown):
{"matchScore":<0-100>,"strengths":["..."],"weaknesses":["..."],"recommendation":"..."}`;

    try {
      const aiResultText = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
      const cleanText = aiResultText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let parsedResult;
      try { parsedResult = JSON.parse(cleanText); }
      catch { throw new Error('JSON_PARSE_FAIL'); }

      return res.json({ ...parsedResult, source: 'ai' });
    } catch (apiError) {
      console.warn(`[AI Evaluate] API failed (${apiError.message}), using local evaluation fallback.`);

      const studentSkillsArr = studentCustomData.skills || [];
      const internSkillsArr = internshipDetails.skills || [];

      const studentSkills = studentSkillsArr.map(s => (s || '').toString().toLowerCase());
      const internSkills = internSkillsArr.map(s => (s || '').toString().toLowerCase());

      const matchedSkills = internSkills.filter(sk => studentSkills.some(ss => ss.includes(sk) || sk.includes(ss)));
      const missingSkills = internSkills.filter(sk => !studentSkills.some(ss => ss.includes(sk) || sk.includes(ss)));

      let matchScore = 0;
      if (internSkills.length > 0) {
         matchScore += Math.round((matchedSkills.length / internSkills.length) * 80);
      } else {
         matchScore += 60; // Base score if no specific skills required
      }
      
      const gpa = Number(studentCustomData.gpa) || 0;
      if (gpa > 0) {
         matchScore += Math.round((gpa / 4) * 20); // GPA bonus up to 20 pts
      } else {
         matchScore += 10;
      }

      matchScore = Math.min(matchScore, 100);

      const isAr = req.query.locale === 'ar';
      const strengths = [];
      const weaknesses = [];

      if (matchedSkills.length > 0) strengths.push(isAr ? `يمتلك المهارات المطلوبة: ${matchedSkills.join('، ')}` : `Possesses required skills: ${matchedSkills.join(', ')}`);
      if (gpa >= 3.0) strengths.push(isAr ? `أداء أكاديمي قوي (المعدل: ${gpa})` : `Strong academic performance (GPA: ${gpa})`);
      if (studentCustomData.major) strengths.push(isAr ? `خلفية دراسية مناسبة في: ${studentCustomData.major}` : `Relevant background in ${studentCustomData.major}`);

      if (missingSkills.length > 0) weaknesses.push(isAr ? `يفتقر لبعض المهارات الأساسية: ${missingSkills.slice(0, 3).join('، ')}` : `Missing key skills: ${missingSkills.slice(0, 3).join(', ')}`);
      if (studentSkillsArr.length === 0) weaknesses.push(isAr ? `المرشح لم يقم بتحديد أي مهارات في ملفه الشخصي` : `Candidate has not provided any skills in their profile`);

      let recommendation;
      if (matchScore >= 75) recommendation = isAr ? 'يوصى به بشدة للمقابلة (Highly Recommended)' : 'Highly Recommended for Interview';
      else if (matchScore >= 50) recommendation = isAr ? 'مرشح محتمل، يتطلب المراجعة (Potential)' : 'Potential candidate, requires review';
      else recommendation = isAr ? 'لا يطابق المتطلبات الأساسية للفرصة' : 'Does not meet core requirements';

      if (strengths.length === 0) strengths.push(isAr ? 'لم يتم التعرف على نقاط قوة واضحة من البيانات المتاحة.' : 'No obvious strengths identified from limited profile data.');
      if (weaknesses.length === 0) weaknesses.push(isAr ? 'لم يتم تحديد نقاط ضعف رئيسية صريحة.' : 'No major weaknesses identified.');

      return res.json({
        matchScore,
        strengths,
        weaknesses,
        recommendation,
        source: 'local'
      });
    }
  } catch (error) {
    console.error(`[AI Evaluate] ${error.message}`);
    const { status, message } = translateError(error);
    res.status(status).json({ message });
  }
};

// ─── Local Matching Algorithm (guaranteed fallback, no API needed) ─────────────
const scoreInternship = (internship, student) => {
  let score = 0;

  const studentSkills  = (student.skills  || []).map(s => s.toLowerCase());
  const internSkills   = (internship.skills || []).map(s => s.toLowerCase());
  const prefCategories = (student.preferredCategories || []).map(s => s.toLowerCase());
  const prefTypes      = (student.preferredTypes      || []).map(s => s.toLowerCase());
  const prefLocations  = (student.preferredLocations  || []).map(s => s.toLowerCase());

  // 1. Skill overlap (up to 45 pts)
  const matched = internSkills.filter(sk => studentSkills.some(ss => ss.includes(sk) || sk.includes(ss)));
  if (internSkills.length > 0) {
    score += Math.round((matched.length / internSkills.length) * 45);
  }

  // 2. Preferred category match (20 pts)
  if (prefCategories.length > 0 && internship.category &&
      prefCategories.some(c => internship.category.toLowerCase().includes(c))) {
    score += 20;
  } else if (prefCategories.length === 0) {
    score += 10; // No preference → neutral bonus
  }

  // 3. Preferred work type match (15 pts)
  if (prefTypes.length > 0 && internship.type &&
      prefTypes.includes(internship.type.toLowerCase())) {
    score += 15;
  } else if (prefTypes.length === 0) {
    score += 7;
  }

  // 4. Location match (10 pts)
  if (prefLocations.length > 0 && internship.location) {
    const loc = internship.location.toLowerCase();
    if (prefLocations.some(pl => loc.includes(pl) || pl.includes('remote'))) {
      score += 10;
    }
  } else {
    score += 5;
  }

  // 5. GPA bonus (up to 10 pts) — higher GPA gets higher score
  if (student.gpa) {
    score += Math.round((student.gpa / 4) * 10);
  }

  return Math.min(score, 100);
};

const buildLocalReasoning = (internship, student, score, locale) => {
  const isAr = locale === 'ar';
  const studentSkills = (student.skills || []).map(s => s.toLowerCase());
  const internSkills  = (internship.skills || []).map(s => s.toLowerCase());
  const matched = internSkills.filter(sk => studentSkills.some(ss => ss.includes(sk) || sk.includes(ss)));

  const parts = [];

  if (matched.length > 0) {
    parts.push(isAr
      ? `${matched.length > 1 ? `مهاراتك في ${matched.slice(0, 2).join(' و')} تتوافق مع متطلبات هذه الفرصة` : `مهارتك في "${matched[0]}" مطلوبة هنا`}.`
      : `Your skills in ${matched.slice(0, 2).join(' and ')} match this role's requirements.`);
  }

  const prefCats = (student.preferredCategories || []).map(s => s.toLowerCase());
  if (prefCats.length > 0 && internship.category && prefCats.some(c => internship.category.toLowerCase().includes(c))) {
    parts.push(isAr
      ? `هذه الفرصة في مجال ${internship.category} الذي تفضله.`
      : `This is in ${internship.category}, one of your preferred categories.`);
  }

  const prefTypes = (student.preferredTypes || []).map(s => s.toLowerCase());
  if (prefTypes.length > 0 && internship.type && prefTypes.includes(internship.type.toLowerCase())) {
    parts.push(isAr
      ? `نوع العمل (${internship.type}) يتوافق مع تفضيلاتك.`
      : `The work type (${internship.type}) matches your preferences.`);
  }

  if (score >= 70) {
    parts.push(isAr ? 'توافق قوي مع ملفك الشخصي.' : 'Strong overall match with your profile.');
  }

  return parts.length > 0
    ? parts.join(' ')
    : (isAr ? 'فرصة جيدة تناسب ملفك الشخصي.' : 'A good opportunity matching your profile.');
};

// ─── 4. Internship Recommendations ────────────────────────────────────────────
exports.recommendInternships = async (req, res) => {
  try {
    const studentId = req.user.id;
    const locale = req.query.locale || 'en';

    const student = await Student.findOne({ user: studentId });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const openInternships = await Internship.find({ status: 'open' }).limit(40);
    if (openInternships.length === 0) return res.json([]);

    // ── Try Gemini AI first ────────────────────────────────────────────────────
    const miniInternships = openInternships.map(i => ({
      id: i._id,
      title: i.title,
      skills: i.skills,
      category: i.category,
      type: i.type,
      location: i.location,
      isPaid: i.isPaid,
    }));

    const prompt = `You are an AI career advisor specializing in internship matching.
Pick the top 5 most suitable internships for this student based on ALL available data.

STUDENT PROFILE:
- Major / Faculty: ${student.major} / ${student.faculty}
- University: ${student.university}
- GPA: ${student.gpa}
- Skills: ${(student.skills || []).join(', ') || 'Not specified'}
- Languages: ${(student.languages || []).join(', ') || 'Not specified'}
- Career Goals: ${student.careerGoals || 'Not specified'}
- Bio: ${student.bio || 'Not specified'}

STUDENT PREFERENCES:
- Preferred Categories: ${(student.preferredCategories || []).join(', ') || 'Any'}
- Preferred Work Types: ${(student.preferredTypes || []).join(', ') || 'Any'}
- Preferred Locations: ${(student.preferredLocations || []).join(', ') || 'Any'}
- Available From: ${student.availableFrom ? new Date(student.availableFrom).toLocaleDateString() : 'Immediately'}

AVAILABLE INTERNSHIPS:
${JSON.stringify(miniInternships)}

INSTRUCTIONS:
- Prioritize internships matching the student's preferred categories, types, and locations.
- Then match by skills alignment and career goals.
- Respond ONLY with raw JSON array (no markdown, no extra text):
[{"internshipId":"<id>","reasoning":"<1-2 sentences in ${locale === 'ar' ? 'ARABIC' : 'ENGLISH'} explaining why this is a great fit>"}]`;

    try {
      const aiResultText = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
      const cleanText = aiResultText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let recommendedList;
      try { recommendedList = JSON.parse(cleanText); }
      catch { throw new Error('JSON_PARSE_FAIL'); }

      const finalRecommendations = recommendedList
        .map(rec => ({ ...rec, internshipDetails: openInternships.find(i => i._id.toString() === rec.internshipId), source: 'ai' }))
        .filter(rec => rec.internshipDetails)
        .slice(0, 5);

      if (finalRecommendations.length > 0) {
        console.log('[AI Recommendations] Served by Gemini API ✓');
        return res.json(finalRecommendations);
      }
      // If AI returned empty, fall through to local
      throw new Error('AI_EMPTY_RESULT');

    } catch (apiError) {
      // ── Local matching fallback (always works) ─────────────────────────────
      console.warn(`[AI Recommendations] API failed (${apiError.message}), using local matching algorithm.`);

      const scored = openInternships.map(internship => ({
        internship,
        score: scoreInternship(internship, student),
      }));

      const top5 = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const localRecommendations = top5.map(({ internship, score }) => ({
        internshipId: internship._id.toString(),
        reasoning: buildLocalReasoning(internship, student, score, locale),
        matchScore: score,
        internshipDetails: internship,
        source: 'local',
      }));

      console.log('[AI Recommendations] Served by local matching algorithm ✓');
      return res.json(localRecommendations);
    }

  } catch (error) {
    console.error(`[AI Recommendations] Fatal: ${error.message}`);
    res.status(500).json({ message: 'Failed to generate recommendations. Please try again.' });
  }
};

