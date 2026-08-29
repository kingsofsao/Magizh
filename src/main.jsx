import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Brain,
  AlertTriangle,
  Apple,
  ArrowRight,
  Baby,
  Bell,
  BookOpen,
  Calendar,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Edit2,
  Footprints,
  Globe,
  Heart,
  Home,
  Moon,
  Pill,
  Search,
  Stethoscope,
  Landmark,
  MessageCircle,
  Mic,
  Square,
  Volume2,
  Phone,
  PhoneCall,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Users,
  X
} from "lucide-react";
import "./styles.css";
import trimesterContent from "./pregnancy_trimester_content.json";


/* ============================================================
   BACKEND API / AUTH
   ============================================================ */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const API = {
  token: () => localStorage.getItem("magizh-token"),
  async request(path, options = {}) {
    const headers = { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) };
    const token = API.token();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }
};

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const data = await API.request(endpoint, {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      });
      localStorage.setItem("magizh-token", data.token);
      localStorage.setItem("magizh-user", JSON.stringify(data.user));
      onAuthenticated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo-wrap">
            <img src="/magizh-logo.png" alt="Magizh" />
          </div>
          <h1>Magizh</h1>
          <p>Joy, for every motherhood</p>
        </div>

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>
            Log in
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>
            Sign up
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && (
            <Input label="Full name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
          )}
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {error && <div className="auth-error">{error}</div>}
          <Button disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            {!busy && <ArrowRight size={17} />}
          </Button>
        </form>

        <p className="auth-note">
          Your account and Magizh profile are securely stored by the Magizh backend.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   MAGIZH
   Maternal & Child Healthcare Companion
   ============================================================ */

const C = {
  bg: "#FDF6F0",
  card: "#FFFFFF",
  primary: "#7A4A52",
  primaryDark: "#5C3640",
  accent: "#C97D60",
  sage: "#3D5A4C",
  sageLight: "#E7EEE9",
  ink: "#2B2522",
  soft: "#6B5F5A",
  line: "#EDE2D8",
  warn: "#B3473B",
  warnBg: "#FBEAE7"
};

/* ============================================================
   LANGUAGES
   ============================================================ */

const LANGS = [
  ["en", "English"],
  ["ta", "தமிழ்"],
  ["hi", "हिन्दी"],
  ["te", "తెలుగు"],
  ["kn", "ಕನ್ನಡ"],
  ["ml", "മലയാളം"]
];

const T = {
  en: {
    home: "Home",
    learn: "Learn",
    ai: "Magizh AI",
    community: "Community",
    profile: "Profile",
    reminders: "Reminders",
    add: "Add",
    contacts: "Emergency Contacts",
    settings: "Settings"
  },

  ta: {
    home: "முகப்பு",
    learn: "கற்க",
    ai: "மகிழ் AI",
    community: "சமூகம்",
    profile: "சுயவிவரம்",
    reminders: "நினைவூட்டல்கள்",
    add: "சேர்க்க",
    contacts: "அவசர தொடர்புகள்",
    settings: "அமைப்புகள்"
  },

  hi: {
    home: "होम",
    learn: "सीखें",
    ai: "मगिझ़ AI",
    community: "समुदाय",
    profile: "प्रोफ़ाइल",
    reminders: "रिमाइंडर",
    add: "जोड़ें",
    contacts: "आपातकालीन संपर्क",
    settings: "सेटिंग्स"
  },

  te: {
    home: "హోమ్",
    learn: "నేర్చుకోండి",
    ai: "మగిఝ్ AI",
    community: "సంఘం",
    profile: "ప్రొఫైల్",
    reminders: "రిమైండర్‌లు",
    add: "జోడించండి",
    contacts: "అత్యవసర పరిచయాలు",
    settings: "సెట్టింగ్‌లు"
  },

  kn: {
    home: "ಮುಖಪುಟ",
    learn: "ಕಲಿಯಿರಿ",
    ai: "ಮಗಿಝ್ AI",
    community: "ಸಮುದಾಯ",
    profile: "ಪ್ರೊಫೈಲ್",
    reminders: "ಜ್ಞಾಪನೆಗಳು",
    add: "ಸೇರಿಸಿ",
    contacts: "ತುರ್ತು ಸಂಪರ್ಕಗಳು",
    settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು"
  },

  ml: {
    home: "ഹോം",
    learn: "പഠിക്കുക",
    ai: "മഗിഴ് AI",
    community: "കമ്മ്യൂണിറ്റി",
    profile: "പ്രൊഫൈൽ",
    reminders: "റിമൈൻഡറുകൾ",
    add: "ചേർക്കുക",
    contacts: "എമർജൻസി കോൺടാക്റ്റുകൾ",
    settings: "സെറ്റിംഗ്സ്"
  }
};

/* ============================================================
   GENERAL DATA
   ============================================================ */

const tips = [
  {
    icon: Apple,
    title: "Nutrition",
    body:
      "Build meals around protein, iron-rich foods, vegetables, fruit and adequate fluids. Follow your clinician's supplement advice."
  },
  {
    icon: Droplet,
    title: "Hydration",
    body:
      "Keep water accessible and drink regularly. If vomiting, severe thirst or reduced urination occurs, seek medical advice."
  },
  {
    icon: Footprints,
    title: "Gentle movement",
    body:
      "Walking and clinician-approved prenatal activity can support wellbeing. Stop and seek advice for concerning symptoms."
  },
  {
    icon: Moon,
    title: "Rest",
    body:
      "Protect sleep and recovery time. Extra support with household tasks can make a meaningful difference."
  }
];

/* ============================================================
   DATE / PREGNANCY ENGINE
   ============================================================ */

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function resolveLmp(profile) {
  if (!profile) return null;

  if (profile.method === "lmp" && profile.lmp) {
    return new Date(profile.lmp);
  }

  if (profile.method === "edd" && profile.edd) {
    return addDays(new Date(profile.edd), -280);
  }

  if (profile.method === "week" && profile.manualWeek) {
    return addDays(
      new Date(profile.weekEntryDate || Date.now()),
      -Number(profile.manualWeek) * 7
    );
  }

  return null;
}

function pregnancyInfo(profile) {
  if (!profile) {
    return { mode: "unknown" };
  }

  if (profile.babyDelivered && profile.babyDOB) {
    const dob = new Date(profile.babyDOB);
    const today = new Date();

    const ageDays = Math.max(0, daysBetween(dob, today));
    const ageWeeks = Math.floor(ageDays / 7);
    const ageMonths = Math.floor(ageDays / 30.44);

    return {
      mode: "postnatal",
      ageDays,
      ageWeeks,
      ageMonths
    };
  }

  const lmp = resolveLmp(profile);

  if (!lmp) {
    return { mode: "unknown" };
  }

  const today = new Date();

  let week = Math.floor(daysBetween(lmp, today) / 7);

  week = Math.max(1, Math.min(42, week));

  const trimester =
    week <= 13
      ? 1
      : week <= 27
      ? 2
      : 3;

  const edd = addDays(lmp, 280);

  const daysLeft = Math.max(0, daysBetween(today, edd));

  return {
    mode: "pregnancy",
    week,
    trimester,
    edd,
    daysLeft
  };
}

function babySize(week) {
  const sizes = [
    [8, "raspberry", "1.6 cm"],
    [12, "lime", "5.4 cm"],
    [16, "avocado", "11.6 cm"],
    [20, "banana", "16.4 cm"],
    [24, "cantaloupe", "30 cm"],
    [28, "eggplant", "37.6 cm"],
    [32, "squash", "42.4 cm"],
    [36, "honeydew melon", "47.4 cm"],
    [40, "small pumpkin", "51.2 cm"]
  ];

  const result = sizes.find(item => week <= item[0]);

  return {
    label: result ? result[1] : "newborn",
    length: result ? result[2] : "~50 cm"
  };
}

function postnatalPhase(ageWeeks) {
  if (ageWeeks < 2) return "early";
  if (ageWeeks < 6) return "recovery";
  if (ageWeeks < 12) return "adjustment";
  return "established";
}

function healthScore(profile, reminders) {
  const preg = pregnancyInfo(profile);

  let score = 68;

  if (
    preg.mode === "pregnancy" ||
    preg.mode === "postnatal"
  ) {
    score += 10;
  }

  score += Math.min(reminders.length * 3, 15);

  if (profile?.doctorName) {
    score += 4;
  }

  if (profile?.bloodGroup) {
    score += 3;
  }

  return Math.min(100, score);
}

/* ============================================================
   UI COMPONENTS
   ============================================================ */

function Button({
  children,
  onClick,
  disabled = false,
  secondary = false
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={secondary ? "btn secondary" : "btn"}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`card ${className}`}>
      {children}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="overlay"
      onClick={onClose}
    >
      <div
        className="sheet"
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h3>{title}</h3>

          <button
            className="icon-btn"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

/* ============================================================
   SPLASH
   ============================================================ */

function Splash({ done }) {
  useEffect(() => {
    const timer = setTimeout(done, 1100);

    return () => clearTimeout(timer);
  }, [done]);

  return (
    <div className="splash">
      <div className="logo-circle">
        <img
          src="/magizh-logo.png"
          alt="Magizh"
          className="splash-logo"
        />
      </div>

      <h1>Magizh</h1>

      <p>
        மகிழ் · joy, for every motherhood
      </p>
    </div>
  );
}

/* ============================================================
   ONBOARDING
   ============================================================ */

function StepDots({ step }) {
  return (
    <div className="stepdots">
      {[0, 1, 2, 3].map(i => (
        <span
          key={i}
          className={i <= step ? "on" : ""}
        />
      ))}
    </div>
  );
}

function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);

  const [lang, setLang] = useState("en");

  const [form, setForm] = useState({
    name: "",
    dob: "",
    bloodGroup: "",
    method: "lmp",
    lmp: "",
    edd: "",
    manualWeek: "",
    doctorName: "",
    hospitalName: ""
  });

  const update = (key, value) => {
    setForm(current => ({
      ...current,
      [key]: value
    }));
  };

  /*
   * ==========================================================
   * IMPORTANT FIX
   * ==========================================================
   *
   * The original implementation disabled the Step 1 button
   * using:
   *
   *   !form.name.trim()
   *
   * Chrome can visually autofill the input without React
   * receiving an onChange event. Therefore the field can look
   * filled while form.name is still empty.
   *
   * We now read the actual DOM value when Next is clicked.
   */

  const nextFromPersonal = () => {
    const input = document.getElementById("magizh-name");

    const name = (
      form.name ||
      input?.value ||
      ""
    ).trim();

    if (!name) {
      input?.focus();
      return;
    }

    if (name !== form.name) {
      update("name", name);
    }

    setStep(2);
  };

  const trackingValid =
    (
      form.method === "lmp" &&
      Boolean(form.lmp)
    ) ||
    (
      form.method === "edd" &&
      Boolean(form.edd)
    ) ||
    (
      form.method === "week" &&
      Boolean(form.manualWeek)
    );

  const finish = () => {
    onComplete({
      ...form,

      manualWeek:
        form.manualWeek
          ? Number(form.manualWeek)
          : null,

      weekEntryDate:
        new Date().toISOString(),

      babyDelivered: false,

      babyDOB: null,

      babyName: "",

      language: lang
    });
  };

  /* ==========================================================
     STEP 0
     ========================================================== */

  if (step === 0) {
    return (
      <div className="onboard">

        <div className="brand-mark">
          <Heart size={32} />
        </div>

        <h1>
          Care that walks with you.
        </h1>

        <p>
          Personalized maternal and child health guidance,
          reminders and support in one place.
        </p>

        <div className="language-grid">
          {LANGS.map(([key, label]) => (
            <button
              key={key}
              className={
                "lang " +
                (lang === key ? "active" : "")
              }
              onClick={() => setLang(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grow" />

        <Button
          onClick={() => setStep(1)}
        >
          Continue
          <ArrowRight size={17} />
        </Button>

      </div>
    );
  }

  /* ==========================================================
     STEP 1
     ========================================================== */

  if (step === 1) {
    return (
      <div className="onboard">

        <StepDots step={1} />

        <h2>
          Tell us about you
        </h2>

        <p className="muted">
          Only the information needed to personalize
          your dashboard.
        </p>

        <label className="field">
          <span>Full name</span>

          <input
            id="magizh-name"
            name="name"
            autoComplete="name"
            placeholder="Enter your name"
            value={form.name}
            onChange={e =>
              update("name", e.target.value)
            }
          />
        </label>

        <Input
          label="Date of birth"
          type="date"
          value={form.dob}
          onChange={e =>
            update("dob", e.target.value)
          }
        />

        <span className="label">
          Blood group
        </span>

        <div className="pills">
          {[
            "A+",
            "B+",
            "O+",
            "AB+",
            "A-",
            "B-",
            "O-",
            "AB-"
          ].map(group => (
            <button
              key={group}
              className={
                "pill " +
                (
                  form.bloodGroup === group
                    ? "active"
                    : ""
                )
              }
              onClick={() =>
                update("bloodGroup", group)
              }
            >
              {group}
            </button>
          ))}
        </div>

        <div className="grow" />

        {/*
          FIX:
          No disabled={!form.name.trim()} here.

          The click handler checks the actual input.
        */}

        <Button
          onClick={nextFromPersonal}
        >
          Next
          <ArrowRight size={17} />
        </Button>

      </div>
    );
  }

  /* ==========================================================
     STEP 2
     ========================================================== */

  if (step === 2) {
    return (
      <div className="onboard">

        <StepDots step={2} />

        <h2>
          Pregnancy tracking
        </h2>

        <p className="muted">
          We'll derive your pregnancy week,
          trimester and due date from this input.
        </p>

        <div className="pills">

          <button
            className={
              "pill " +
              (
                form.method === "lmp"
                  ? "active"
                  : ""
              )
            }
            onClick={() =>
              update("method", "lmp")
            }
          >
            LMP
          </button>

          <button
            className={
              "pill " +
              (
                form.method === "edd"
                  ? "active"
                  : ""
              )
            }
            onClick={() =>
              update("method", "edd")
            }
          >
            Due date
          </button>

          <button
            className={
              "pill " +
              (
                form.method === "week"
                  ? "active"
                  : ""
              )
            }
            onClick={() =>
              update("method", "week")
            }
          >
            Current week
          </button>

        </div>

        {form.method === "lmp" && (
          <Input
            label="First day of last menstrual period"
            type="date"
            value={form.lmp}
            onChange={e =>
              update("lmp", e.target.value)
            }
          />
        )}

        {form.method === "edd" && (
          <Input
            label="Expected delivery date"
            type="date"
            value={form.edd}
            onChange={e =>
              update("edd", e.target.value)
            }
          />
        )}

        {form.method === "week" && (
          <Input
            label="Current week"
            type="number"
            min="1"
            max="42"
            placeholder="e.g. 24"
            value={form.manualWeek}
            onChange={e =>
              update(
                "manualWeek",
                e.target.value
              )
            }
          />
        )}

        <div className="grow" />

        <div className="two-buttons">

          <button
            className="back-button"
            onClick={() =>
              setStep(1)
            }
          >
            <ChevronLeft size={18} />
          </button>

          <Button
            disabled={!trackingValid}
            onClick={() =>
              setStep(3)
            }
          >
            Next
            <ArrowRight size={17} />
          </Button>

        </div>

      </div>
    );
  }

  /* ==========================================================
     STEP 3
     ========================================================== */

  return (
    <div className="onboard">

      <StepDots step={3} />

      <h2>
        Your care team
      </h2>

      <p className="muted">
        Optional, but useful for a more contextual dashboard.
      </p>

      <Input
        label="Doctor's name"
        placeholder="e.g. Dr. Kalaiselvi"
        value={form.doctorName}
        onChange={e =>
          update(
            "doctorName",
            e.target.value
          )
        }
      />

      <Input
        label="Hospital / clinic"
        placeholder="e.g. Government Maternity Hospital"
        value={form.hospitalName}
        onChange={e =>
          update(
            "hospitalName",
            e.target.value
          )
        }
      />

      <div className="grow" />

      <div className="two-buttons">

        <button
          className="back-button"
          onClick={() =>
            setStep(2)
          }
        >
          <ChevronLeft size={18} />
        </button>

        <Button
          onClick={finish}
        >
          Finish setup
          <Check size={17} />
        </Button>

      </div>

    </div>
  );
}

/* ============================================================
   HOME
   ============================================================ */

function HomePage({
  p,
  preg,
  reminders,
  openReminder,
  openVitals,
  goToLearn,
  t
}) {
  const score = healthScore(
    p,
    reminders
  );

  const post =
    preg.mode === "postnatal";

  if (preg.mode === "unknown") {
    return (
      <div className="page">

        <Card>
          <div className="empty">

            <Baby size={42} />

            <h2>
              Complete your profile
            </h2>

            <p>
              Add pregnancy tracking details
              in Profile to activate your
              personalized dashboard.
            </p>

          </div>
        </Card>

      </div>
    );
  }

  const size =
    post
      ? null
      : babySize(preg.week);

  return (
    <div className="page">

      <div className="topline">

        <div>
          <span className="muted">
            Good morning,
          </span>

          <h1>
            {p.name} 🌸
          </h1>
        </div>

        <div className="avatar">
          {p.name?.[0]?.toUpperCase()}
        </div>

      </div>

      <Card
        className={
          "hero " +
          (post ? "post" : "")
        }
      >

        <div>

          <span className="eyebrow">
            {post
              ? "POSTNATAL"
              : `TRIMESTER ${preg.trimester}`
            }
            {" · HEALTH "}
            {score}
          </span>

          <h2>
            {post
              ? `${p.babyName || "Your baby"} · ${preg.ageWeeks}w old`
              : `Week ${preg.week}`
            }
          </h2>

          <p>
            {post
              ? `${preg.ageDays} days since delivery. Recovery and baby care in focus.`
              : `Baby is about the size of a ${size.label}. ${preg.daysLeft} days to your estimated due date.`
            }
          </p>

        </div>

        <div className="progress-ring">

          <strong>
            {post
              ? `${preg.ageMonths}mo`
              : `${Math.round(
                  (preg.week / 40) * 100
                )}%`
            }
          </strong>

          <small>
            {post
              ? "old"
              : "to term"
            }
          </small>

        </div>

      </Card>

      <div className="section-head">

        <h2>
          Today's Health Tips
        </h2>

        <button
          className="text-btn"
          onClick={goToLearn}
        >
          View all
        </button>

      </div>

      <div className="tip-grid">

        {tips.map(item => {

          const Icon = item.icon;

          return (
            <Card key={item.title}>

              <Icon
                size={20}
                color={C.accent}
              />

              <h3>
                {item.title}
              </h3>

              <p>
                {item.body}
              </p>

            </Card>
          );
        })}

      </div>

      <div className="section-head">

        <h2>
          {t.reminders}
        </h2>

        <button
          className="text-btn"
          onClick={openReminder}
        >
          + {t.add}
        </button>

      </div>

      {reminders.length > 0 ? (

        <div className="list">

          {reminders
            .slice(0, 3)
            .map(reminder => (

              <Card key={reminder.id}>

                <div className="row">

                  <div className="mini-icon">
                    <Bell size={18} />
                  </div>

                  <div className="grow">

                    <b>
                      {reminder.title}
                    </b>

                    <span className="muted">
                      {reminder.date}
                      {" · "}
                      {reminder.time}
                      {" · "}
                      {reminder.repeat}
                    </span>

                  </div>

                  <Check
                    size={18}
                    color={C.sage}
                  />

                </div>

              </Card>

            ))}

        </div>

      ) : (

        <Card>
          <p className="muted">
            No reminders yet. Add medication,
            appointments, scans, hydration or
            exercise reminders.
          </p>
        </Card>

      )}

      <Card className="insight">

        <Sparkles size={22} />

        <div>

          <b>
            This week's AI insight
          </b>

          <p>
            Keep your care plan grounded in
            your clinician's advice. Magizh can
            organize your questions, reminders
            and learning material around your stage.
          </p>

        </div>

      </Card>

      <Button
        secondary
        onClick={openVitals}
      >
        <Activity size={17} />
        Log a vital
      </Button>

    </div>
  );
}

/* ============================================================
   LEARN
   ============================================================ */

function labelize(key) {
  return key
    .split("_")
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function TrimesterDetail({ trimester, onBack }) {
  const expectSections = Object.entries(
    trimester.what_to_expect || {}
  );

  return (
    <div className="page">

      <button
        className="back-btn"
        onClick={onBack}
      >
        <ChevronLeft size={17} />
        Back to Learn
      </button>

      <div className="page-title">

        <BookOpen />

        <div>
          <h1>{trimester.label}</h1>

          <p className="muted">
            Weeks {trimester.weeks}
          </p>
        </div>

      </div>

      <Card className="learn-intro">
        <p>{trimester.what_is_it}</p>
      </Card>

      {expectSections.map(([key, items]) => (
        <div className="learn-section" key={key}>
          <h3>{labelize(key)}</h3>
          <ul>
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}

      {trimester.baby_growth && (
        <div className="learn-section">
          <h3>Baby's growth</h3>
          <ul>
            {trimester.baby_growth.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {trimester.checkpoints && (
        <Card className="insight">
          <Check size={22} color={C.sage} />
          <div>
            <b>Checkpoints for this stage</b>
            <ul>
              {trimester.checkpoints.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <Card className="warning">
        <AlertTriangle size={21} />
        <div>
          <b>When to seek urgent care</b>
          <p>
            Severe bleeding, severe abdominal
            pain, fainting, difficulty breathing,
            seizures, or other serious symptoms
            warrant urgent medical evaluation.
          </p>
        </div>
      </Card>

    </div>
  );
}

function Learn() {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");

  const trimesterData = [
    { id: "first_trimester", label: "First Trimester", weeks: "0–13" },
    { id: "second_trimester", label: "Second Trimester", weeks: "14–27" },
    { id: "third_trimester", label: "Third Trimester", weeks: "28–40" },
    { id: "fourth_trimester", label: "Fourth Trimester", weeks: "41–52 · postpartum" }
  ];

  const topics = [
    {
      id: "pregnancy",
      title: "Pregnancy",
      description: "Trimester guides, symptoms, checkups and preparing for birth.",
      icon: Baby,
      tone: "pink",
      detail: "Explore stage-aware pregnancy education from the first trimester through postpartum recovery."
    },
    {
      id: "nutrition",
      title: "Nutrition",
      description: "Everyday nutrition, hydration and healthy meal guidance.",
      icon: Apple,
      tone: "green",
      detail: "Focus on balanced meals, protein, iron-rich foods, fruit, vegetables and adequate fluids."
    },
    {
      id: "exercise",
      title: "Exercise",
      description: "Gentle movement and activity ideas for pregnancy.",
      icon: Footprints,
      tone: "orange",
      detail: "Walking and clinician-approved activity can support wellbeing. Follow your provider's advice."
    },
    {
      id: "medicines",
      title: "Medicines",
      description: "Learn how to discuss medicines and supplements safely.",
      icon: Pill,
      tone: "blue",
      detail: "Always check medicines, supplements and dose changes with your clinician or pharmacist."
    },
    {
      id: "monitoring",
      title: "Health Monitoring",
      description: "Track appointments, symptoms, vitals and important changes.",
      icon: Stethoscope,
      tone: "teal",
      detail: "Keep your appointments and record information your care team asks you to monitor."
    },
    {
      id: "mental",
      title: "Mental Wellness",
      description: "Emotional wellbeing, rest and support during your journey.",
      icon: Brain,
      tone: "purple",
      detail: "Rest, social support and talking with a trusted professional can help when emotions feel difficult."
    },
    {
      id: "baby",
      title: "Baby Development",
      description: "Milestones, growth, feeding and newborn care basics.",
      icon: Baby,
      tone: "yellow",
      detail: "Learn about baby growth, feeding, safe sleep, hygiene and common newborn routines."
    },
    {
      id: "schemes",
      title: "Government Schemes",
      description: "A hub for maternal and child health schemes and benefits.",
      icon: Landmark,
      tone: "brown",
      badge: "NEW",
      detail: "Explore government health-support resources and verify current eligibility with official sources."
    }
  ];

  const current = selected
    ? pregnancyContent.trimesters.find(x => x.id === selected)
    : null;

  const selectedTopic = topics.find(x => x.id === selected);

  const visibleTopics = topics.filter(topic =>
    `${topic.title} ${topic.description}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );

  const section = (title, items) =>
    items?.length ? (
      <section className="learn-section" key={title}>
        <h3>{title}</h3>
        <ul>
          {items.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </section>
    ) : null;

  if (current) {
    return (
      <div className="page">
        <button className="back-btn" onClick={() => setSelected("pregnancy")}>
          <ChevronLeft size={17} /> Back to Pregnancy
        </button>

        <div className="page-title">
          <Baby />
          <div>
            <h1>{current.label}</h1>
            <p className="muted">Weeks {current.weeks}</p>
          </div>
        </div>

        <Card className="learn-intro">
          <p>{current.what_is_it}</p>
        </Card>

        {section("What to expect", current.what_to_expect?.symptoms || current.what_to_expect?.symptoms_and_changes || current.what_to_expect?.symptoms_and_body_changes)}
        {section("Self-care", current.what_to_expect?.self_care_tips)}
        {section("Prenatal care", current.what_to_expect?.prenatal_care || current.what_to_expect?.prenatal_care_schedule)}
        {section("Planning ahead", current.what_to_expect?.planning_ahead || current.what_to_expect?.getting_ready)}
        {section("Feeding & care", current.what_to_expect?.feeding_and_care)}
        {section("Checkup schedule", current.what_to_expect?.checkup_schedule)}
        {section("Baby growth", current.baby_growth)}
        {section("Key checkpoints", current.checkpoints)}

        <Card className="warning">
          <AlertTriangle size={21} />
          <div>
            <b>When to seek urgent care</b>
            <p>
              Severe bleeding, severe abdominal pain, fainting, difficulty breathing,
              seizures, or other serious symptoms warrant urgent medical evaluation.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (selectedTopic) {
    return (
      <div className="page">
        <button className="back-btn" onClick={() => setSelected(null)}>
          <ChevronLeft size={17} /> Back to Learn
        </button>

        <div className="learn-detail-hero">
          <div className={`learn-topic-icon ${selectedTopic.tone}`}>
            <selectedTopic.icon size={30} strokeWidth={1.9} />
          </div>
          <div>
            <span className="eyebrow dark">LEARN</span>
            <h1>{selectedTopic.title}</h1>
            <p>{selectedTopic.detail}</p>
          </div>
        </div>

        {selectedTopic.id === "pregnancy" && (
          <>
            <div className="section-head">
              <h2>Pregnancy guides</h2>
            </div>
            <div className="learn-guide-grid">
              {trimesterData.map(item => {
                const content = pregnancyContent.trimesters.find(x => x.id === item.id);
                return (
                  <Card
                    key={item.id}
                    className="learn-guide-card clickable"
                    onClick={() => setSelected(item.id)}
                  >
                    <span className="eyebrow dark">{item.weeks}</span>
                    <h3>{item.label}</h3>
                    <p>{content?.what_is_it}</p>
                    <span className="text-btn">Explore <ChevronRight size={14} /></span>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {selectedTopic.id !== "pregnancy" && (
          <>
            <Card className="learn-intro">
              <p>{selectedTopic.detail}</p>
            </Card>
            <div className="learn-section">
              <h3>Helpful reminders</h3>
              <ul>
                <li>Use information here as general education, not as a diagnosis.</li>
                <li>Bring questions and changes you notice to your healthcare provider.</li>
                <li>For severe or urgent symptoms, seek medical care promptly.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="page learn-home">
      <div className="learn-brand-row">
        <div className="learn-brand">
          <div className="learn-brand-mark"><Heart size={22} fill="currentColor" /></div>
          <strong>Learn</strong>
        </div>
        <div className="language-chip"><Globe size={16} /> EN</div>
      </div>

      <div className="learn-heading">
        <h1>Learn</h1>
        <p>Explore topics curated for your journey</p>
      </div>

      <label className="learn-search">
        <Search size={20} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search topics, schemes, tips..."
          aria-label="Search learning topics"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
            <X size={17} />
          </button>
        )}
      </label>

      <div className="learn-topic-grid">
        {visibleTopics.map(topic => {
          const Icon = topic.icon;
          return (
            <button
              type="button"
              className="learn-topic-card"
              key={topic.id}
              onClick={() => setSelected(topic.id)}
            >
              <div className={`learn-topic-icon ${topic.tone}`}>
                <Icon size={29} strokeWidth={1.9} />
              </div>
              <span className="learn-topic-title">{topic.title}</span>
              {topic.badge && <span className="learn-new-badge">{topic.badge}</span>}
            </button>
          );
        })}
      </div>

      {!visibleTopics.length && (
        <Card className="learn-empty">
          <Search size={28} />
          <h3>No topics found</h3>
          <p>Try searching for nutrition, pregnancy, exercise or schemes.</p>
        </Card>
      )}

      <Card className="warning learn-safety">
        <AlertTriangle size={19} />
        <div>
          <b>Medical safety</b>
          <p>Learning content is for general information. Use your clinician's assessment for diagnosis and treatment decisions.</p>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   AI
   ============================================================ */

function AIPage({ profile }) {

  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "I'm Magizh AI. Ask me anything about pregnancy, nutrition, exercise, medicines, baby development, newborn care, or general health. I'll explain the topic clearly and help you decide what questions to discuss with your clinician."
    }
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const mediaRef = React.useRef(null);
  const chunksRef = React.useRef([]);
  const streamRef = React.useRef(null);

  async function sendText(textOverride) {
    const userText = String(textOverride ?? question).trim();
    if (!userText || loading) return;

    setQuestion("");
    setVoiceError("");
    setMessages(current => [...current, { role: "user", text: userText }]);
    setLoading(true);

    try {
      const data = await API.request("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          question: userText,
          profile,
          history: messages.slice(-8).map(message => ({ role: message.role, text: message.text }))
        })
      });
      setMessages(current => [...current, { role: "ai", text: data.answer }]);
    } catch (error) {
      setMessages(current => [...current, {
        role: "ai",
        text: `I couldn't reach Ollama right now. ${error.message} Start Ollama and make sure the model in .env is available.`
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function speak(text) {
    setVoiceError("");
    setVoiceBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API.token()}` },
        body: JSON.stringify({ text })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "ElevenLabs voice is unavailable");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (error) {
      setVoiceError(error.message);
    } finally {
      setVoiceBusy(false);
    }
  }

  async function startListening() {
    if (listening) return;
    setVoiceError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError("This browser does not support microphone recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRef.current = recorder;

      recorder.ondataavailable = e => {
        if (e.data.size) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setListening(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceBusy(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "magizh-question.webm");
          const data = await API.request("/api/voice/transcribe", { method: "POST", body: form });
          if (data.text?.trim()) {
            setQuestion(data.text.trim());
            await sendText(data.text.trim());
          } else {
            setVoiceError("I couldn't understand the recording. Please try again.");
          }
        } catch (error) {
          setVoiceError(error.message);
        } finally {
          setVoiceBusy(false);
        }
      };

      recorder.start();
      setListening(true);
    } catch (error) {
      setVoiceError(error.name === "NotAllowedError" ? "Microphone permission was denied." : error.message);
    }
  }

  function stopListening() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  return (
    <div className="page ai-page">
      <div className="page-title">
        <Sparkles />
        <div>
          <h1>Magizh AI</h1>
          <p className="muted">Powered by Ollama · voice by ElevenLabs</p>
        </div>
      </div>

      <div className="chat">
        {messages.map((message, index) => (
          <div key={index} className={`bubble ${message.role}`}>
            <div>{message.text}</div>
            {message.role === "ai" && (
              <button className="voice-replay" onClick={() => speak(message.text)} disabled={voiceBusy} title="Listen to this answer">
                <Volume2 size={15} /> Listen
              </button>
            )}
          </div>
        ))}
        {loading && <div className="bubble ai">Thinking with Ollama…</div>}
      </div>

      {voiceError && <div className="voice-error">{voiceError}</div>}

      <div className="composer">
        <button
          className={`mic-btn ${listening ? "recording" : ""}`}
          onClick={listening ? stopListening : startListening}
          disabled={loading || voiceBusy}
          aria-label={listening ? "Stop listening" : "Start listening"}
          title={listening ? "Stop listening" : "Speak to Magizh AI"}
        >
          {listening ? <Square size={17} /> : <Mic size={18} />}
        </button>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") sendText(); }}
          placeholder={listening ? "Listening…" : "Ask Magizh AI…"}
          disabled={loading || listening}
        />
        <button onClick={() => sendText()} disabled={!question.trim() || loading} aria-label="Send">
          <Send size={17} />
        </button>
      </div>
      <p className="voice-hint">
        {listening ? "Recording… tap the microphone again to send." : "Tap the microphone to speak. Magizh uses ElevenLabs Scribe for transcription and ElevenLabs for spoken answers."}
      </p>
    </div>
  );
}

/* ============================================================
   COMMUNITY
   ============================================================

function Community({ profileName = "You" }) {
  const defaultPosts = [
    {
      id: 1,
      name: "Ananya",
      time: "2h",
      text: "What helped you stay hydrated during the third trimester?",
      likes: 12,
      liked: false,
      comments: [
        { id: 11, name: "Meena", text: "Keeping a bottle with me all day really helped.", time: "1h" },
        { id: 12, name: "Kavya", text: "I also set small reminders to drink water regularly.", time: "45m" }
      ]
    },
    {
      id: 2,
      name: "Meena",
      time: "5h",
      text: "I made a checklist for my hospital bag. Happy to share the categories if anyone needs it.",
      likes: 21,
      liked: false,
      comments: [
        { id: 21, name: "Ananya", text: "Yes please! That would be really helpful.", time: "3h" }
      ]
    }
  ];

  const [posts, setPosts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("magizh-community-posts") || "null");
      return Array.isArray(saved) && saved.length ? saved : defaultPosts;
    } catch {
      return defaultPosts;
    }
  });

  const [newPost, setNewPost] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [openComments, setOpenComments] = useState(
    () => Object.fromEntries(defaultPosts.map(post => [post.id, true]))
  );

  useEffect(() => {
    localStorage.setItem("magizh-community-posts", JSON.stringify(posts));
  }, [posts]);

  function createPost() {
    const text = newPost.trim();
    if (!text) return;

    setPosts(current => [
      {
        id: Date.now(),
        name: profileName || "You",
        time: "now",
        text,
        likes: 0,
        liked: false,
        comments: []
      },
      ...current
    ]);
    setNewPost("");
  }

  function toggleLike(postId) {
    setPosts(current =>
      current.map(post =>
        post.id === postId
          ? {
              ...post,
              liked: !post.liked,
              likes: Math.max(0, post.likes + (post.liked ? -1 : 1))
            }
          : post
      )
    );
  }

  function addComment(postId) {
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;

    setPosts(current =>
      current.map(post =>
        post.id === postId
          ? {
              ...post,
              comments: [
                ...(post.comments || []),
                {
                  id: Date.now(),
                  name: profileName || "You",
                  text,
                  time: "now"
                }
              ]
            }
          : post
      )
    );

    setCommentDrafts(current => ({ ...current, [postId]: "" }));
    setOpenComments(current => ({ ...current, [postId]: true }));
  }

  function toggleComments(postId) {
    setOpenComments(current => ({
      ...current,
      [postId]: !current[postId]
    }));
  }

  return (
    <div className="page community-page">
      <div className="page-title">
        <Users />
        <div>
          <h1>Community</h1>
          <p className="muted">Ask questions, share experiences and support one another.</p>
        </div>
      </div>

      <Card className="community-composer">
        <textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          placeholder="Share a question or experience…"
          maxLength={500}
        />
        <div className="community-compose-footer">
          <span>{newPost.length}/500</span>
          <Button disabled={!newPost.trim()} onClick={createPost}>
            Post
          </Button>
        </div>
      </Card>

      <div className="community-feed">
        {posts.map(post => {
          const comments = post.comments || [];
          const isOpen = Boolean(openComments[post.id]);

          return (
            <Card key={post.id} className="community-post">
              <div className="post-head">
                <div className="avatar small">{post.name?.[0]?.toUpperCase() || "U"}</div>
                <div>
                  <b>{post.name}</b>
                  <span className="muted">{post.time}</span>
                </div>
              </div>

              <p className="community-post-text">{post.text}</p>

              <div className="post-actions community-actions">
                <button
                  type="button"
                  className={post.liked ? "action-btn liked" : "action-btn"}
                  onClick={() => toggleLike(post.id)}
                >
                  <Heart size={17} fill={post.liked ? "currentColor" : "none"} />
                  {post.likes}
                </button>

                <button
                  type="button"
                  className="action-btn"
                  onClick={() => toggleComments(post.id)}
                >
                  <MessageCircle size={17} />
                  {comments.length} {comments.length === 1 ? "comment" : "comments"}
                </button>
              </div>

              <div className="comments-panel">
                <div className="comments-heading">
                  <b>Comments</b>
                  <span>{comments.length}</span>
                </div>

                {isOpen && (
                  <>
                    {comments.length > 0 ? (
                      <div className="comment-list">
                        {comments.map(comment => (
                          <div className="comment" key={comment.id}>
                            <div className="comment-avatar">
                              {comment.name?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div className="comment-body">
                              <div className="comment-meta">
                                <b>{comment.name}</b>
                                <span>{comment.time}</span>
                              </div>
                              <p>{comment.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-comments">No comments yet. Be the first to reply.</p>
                    )}

                    <div className="comment-composer">
                      <input
                        value={commentDrafts[post.id] || ""}
                        onChange={e =>
                          setCommentDrafts(current => ({
                            ...current,
                            [post.id]: e.target.value
                          }))
                        }
                        onKeyDown={e => {
                          if (e.key === "Enter") addComment(post.id);
                        }}
                        placeholder="Write a comment..."
                        maxLength={300}
                        aria-label={`Comment on ${post.name}'s post`}
                      />
                      <button
                        type="button"
                        onClick={() => addComment(post.id)}
                        disabled={!(commentDrafts[post.id] || "").trim()}
                        aria-label="Add comment"
                      >
                        <Send size={17} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="privacy">
        <ShieldCheck size={19} />
        <span>
          Keep personal medical details private. Community posts are peer support and not a substitute for emergency or clinical care.
        </span>
      </Card>
    </div>
  );
}

/* ============================================================
   PROFILE
   ============================================================ */

function Profile({
  p,
  setP,
  lang,
  setLang,
  onReset,
  openContacts
}) {

  const [editing, setEditing] =
    useState(false);

  const [draft, setDraft] =
    useState(p);

  function save() {
    setP(draft);
    setEditing(false);
  }

  return (
    <div className="page">

      <div className="profile-head">

        <div className="avatar large">
          {p.name?.[0]}
        </div>

        <h1>
          {p.name}
        </h1>

        <span className="muted">
          {p.bloodGroup ||
            "Blood group not set"}
        </span>

      </div>

      <Card>

        <div className="section-head">

          <h2>
            Profile
          </h2>

          <button
            className="icon-btn"
            onClick={() => {
              setDraft(p);
              setEditing(true);
            }}
          >
            <Edit2 size={18} />
          </button>

        </div>

        <Info
          k="Tracking"
          v={p.method?.toUpperCase()}
        />

        <Info
          k="Doctor"
          v={
            p.doctorName ||
            "Not added"
          }
        />

        <Info
          k="Hospital"
          v={
            p.hospitalName ||
            "Not added"
          }
        />

      </Card>

      <Card>

        <div className="section-head">

          <h2>
            Language
          </h2>

          <Globe size={18} />

        </div>

        <div className="pills">

          {LANGS.map(
            ([key, label]) => (

              <button
                key={key}
                className={
                  "pill " +
                  (
                    lang === key
                      ? "active"
                      : ""
                  )
                }
                onClick={() =>
                  setLang(key)
                }
              >
                {label}
              </button>

            )
          )}

        </div>

      </Card>

      <Card>

        <div className="section-head">

          <h2>
            Emergency Contacts
          </h2>

          <PhoneCall size={18} />

        </div>

        <p className="muted">
          Keep trusted people one tap away.
        </p>

        <Button
          secondary
          onClick={openContacts}
        >
          Manage emergency contacts
          <ChevronRight size={17} />
        </Button>

      </Card>

      <Card>

        <h2>
          Safety & privacy
        </h2>

        <p className="muted">
          This prototype stores demo data in your
          browser. It is not a clinical record and
          has no real healthcare-provider integration.
        </p>

      </Card>

      <button
        className="danger-btn"
        onClick={onReset}
      >
        Reset local demo
      </button>

      {editing && (

        <Modal
          title="Edit profile"
          onClose={() =>
            setEditing(false)
          }
        >

          <Input
            label="Name"
            value={draft.name || ""}
            onChange={e =>
              setDraft({
                ...draft,
                name: e.target.value
              })
            }
          />

          <Input
            label="Doctor"
            value={
              draft.doctorName || ""
            }
            onChange={e =>
              setDraft({
                ...draft,
                doctorName: e.target.value
              })
            }
          />

          <Input
            label="Hospital"
            value={
              draft.hospitalName || ""
            }
            onChange={e =>
              setDraft({
                ...draft,
                hospitalName: e.target.value
              })
            }
          />

          <span className="label">
            Baby delivered?
          </span>

          <div className="pills">

            <button
              className={
                "pill " +
                (!draft.babyDelivered ? "active" : "")
              }
              onClick={() =>
                setDraft({
                  ...draft,
                  babyDelivered: false
                })
              }
            >
              Not yet
            </button>

            <button
              className={
                "pill " +
                (draft.babyDelivered ? "active" : "")
              }
              onClick={() =>
                setDraft({
                  ...draft,
                  babyDelivered: true,
                  babyDOB:
                    draft.babyDOB ||
                    new Date().toISOString().slice(0, 10)
                })
              }
            >
              Yes
            </button>

          </div>

          {draft.babyDelivered && (
            <>

              <Input
                label="Baby's date of birth"
                type="date"
                value={draft.babyDOB || ""}
                onChange={e =>
                  setDraft({
                    ...draft,
                    babyDOB: e.target.value
                  })
                }
              />

              <Input
                label="Baby's name (optional)"
                placeholder="e.g. Amara"
                value={draft.babyName || ""}
                onChange={e =>
                  setDraft({
                    ...draft,
                    babyName: e.target.value
                  })
                }
              />

            </>
          )}

          <Button onClick={save}>
            Save changes
          </Button>

        </Modal>

      )}

    </div>
  );
}

function Info({ k, v }) {
  return (
    <div className="info">
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

/* ============================================================
   REMINDERS
   ============================================================ */

function ReminderModal({
  onClose,
  onSave
}) {

  const [reminder, setReminder] =
    useState({
      type: "medication",
      title: "",
      date:
        new Date()
          .toISOString()
          .slice(0, 10),
      time: "09:00",
      repeat: "Once"
    });

  const valid =
    reminder.title &&
    reminder.date &&
    reminder.time;

  return (
    <Modal
      title="New Reminder"
      onClose={onClose}
    >

      <div className="pills">

        {[
          "medication",
          "appointment",
          "scan",
          "hydration",
          "exercise"
        ].map(type => (

          <button
            key={type}
            className={
              "pill " +
              (
                reminder.type === type
                  ? "active"
                  : ""
              )
            }
            onClick={() =>
              setReminder({
                ...reminder,
                type
              })
            }
          >
            {type}
          </button>

        ))}

      </div>

      <Input
        label="Title"
        placeholder="e.g. Folic acid tablet"
        value={reminder.title}
        onChange={e =>
          setReminder({
            ...reminder,
            title: e.target.value
          })
        }
      />

      <div className="two">

        <Input
          label="Date"
          type="date"
          value={reminder.date}
          onChange={e =>
            setReminder({
              ...reminder,
              date: e.target.value
            })
          }
        />

        <Input
          label="Time"
          type="time"
          value={reminder.time}
          onChange={e =>
            setReminder({
              ...reminder,
              time: e.target.value
            })
          }
        />

      </div>

      <span className="label">
        Repeat
      </span>

      <div className="pills">

        {[
          "Once",
          "Daily",
          "Weekly"
        ].map(repeat => (

          <button
            key={repeat}
            className={
              "pill " +
              (
                reminder.repeat === repeat
                  ? "active"
                  : ""
              )
            }
            onClick={() =>
              setReminder({
                ...reminder,
                repeat
              })
            }
          >
            {repeat}
          </button>

        ))}

      </div>

      <Button
        disabled={!valid}
        onClick={() =>
          onSave({
            ...reminder,
            id: Date.now()
          })
        }
      >
        Save reminder
        <CalendarCheck size={17} />
      </Button>

    </Modal>
  );
}

/* ============================================================
   VITAL MODAL
   ============================================================ */

function VitalModal({
  onClose,
  onSave
}) {

  const [vital, setVital] =
    useState({
      type: "Blood pressure",
      value: "",
      note: ""
    });

  return (
    <Modal
      title="Log a vital"
      onClose={onClose}
    >

      <div className="pills">

        {[
          "Blood pressure",
          "Weight",
          "Heart rate",
          "Temperature"
        ].map(type => (

          <button
            key={type}
            className={
              "pill " +
              (
                vital.type === type
                  ? "active"
                  : ""
              )
            }
            onClick={() =>
              setVital({
                ...vital,
                type
              })
            }
          >
            {type}
          </button>

        ))}

      </div>

      <Input
        label="Reading"
        placeholder="e.g. 120/80"
        value={vital.value}
        onChange={e =>
          setVital({
            ...vital,
            value: e.target.value
          })
        }
      />

      <Input
        label="Note (optional)"
        placeholder="How are you feeling?"
        value={vital.note}
        onChange={e =>
          setVital({
            ...vital,
            note: e.target.value
          })
        }
      />

      <Button
        disabled={!vital.value}
        onClick={() => {
          onSave({
            ...vital,
            id: Date.now()
          });

          alert(
            "Vital saved locally for this demo."
          );
        }}
      >
        Save reading
      </Button>

    </Modal>
  );
}

/* ============================================================
   EMERGENCY CONTACTS
   ============================================================ */

function Contacts({
  contacts,
  setContacts,
  onBack
}) {

  const [open, setOpen] =
    useState(false);

  const [contact, setContact] =
    useState({
      name: "",
      phone: "",
      relation: ""
    });

  function saveContact() {

    if (
      !contact.name ||
      !contact.phone
    ) {
      return;
    }

    setContacts([
      ...contacts,
      {
        ...contact,
        id: Date.now()
      }
    ]);

    setContact({
      name: "",
      phone: "",
      relation: ""
    });

    setOpen(false);
  }

  return (
    <div className="page">

      <button
        className="back-btn"
        onClick={onBack}
      >
        <ChevronLeft size={17} />
        Back to Profile
      </button>

      <div className="page-title">

        <PhoneCall />

        <div>

          <h1>
            Emergency Contacts
          </h1>

          <p className="muted">
            Quick access to trusted people.
            For emergencies, use local emergency services.
          </p>

        </div>

      </div>

      <Button
        onClick={() =>
          setOpen(true)
        }
      >
        <Plus size={17} />
        Add contact
      </Button>

      {contacts.map(contact => (

        <Card key={contact.id}>

          <div className="row">

            <div className="mini-icon">
              <Phone size={18} />
            </div>

            <div className="grow">

              <b>
                {contact.name}
              </b>

              <span className="muted">
                {contact.relation}
                {" · "}
                {contact.phone}
              </span>

            </div>

            <a
              className="call"
              href={`tel:${contact.phone}`}
            >
              Call
            </a>

            <button
              className="icon-btn"
              onClick={() =>
                setContacts(
                  contacts.filter(
                    item =>
                      item.id !== contact.id
                  )
                )
              }
            >
              <Trash2 size={17} />
            </button>

          </div>

        </Card>

      ))}

      {open && (

        <Modal
          title="Add emergency contact"
          onClose={() =>
            setOpen(false)
          }
        >

          <Input
            label="Name"
            value={contact.name}
            onChange={e =>
              setContact({
                ...contact,
                name: e.target.value
              })
            }
          />

          <Input
            label="Phone"
            value={contact.phone}
            onChange={e =>
              setContact({
                ...contact,
                phone: e.target.value
              })
            }
          />

          <Input
            label="Relationship"
            value={contact.relation}
            onChange={e =>
              setContact({
                ...contact,
                relation: e.target.value
              })
            }
          />

          <Button
            disabled={
              !contact.name ||
              !contact.phone
            }
            onClick={saveContact}
          >
            Save contact
          </Button>

        </Modal>

      )}

    </div>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */

function App() {
  const [splash, setSplash] = useState(true);
  const [auth, setAuth] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [profile, setProfile] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [language, setLanguage] = useState(() => localStorage.getItem("magizh-lang") || "en");
  const [tab, setTab] = useState("home");
  const [modal, setModal] = useState(null);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem("magizh-token");
      if (!token) {
        setAuthChecking(false);
        return;
      }
      try {
        const data = await API.request("/api/auth/me");
        setAuth(data.user);
        setProfile(data.profile);
        if (data.profile?.language) setLanguage(data.profile.language);
        const [r, c] = await Promise.all([
          API.request("/api/reminders"),
          API.request("/api/contacts")
        ]);
        setReminders(r.reminders || []);
        setContacts(c.contacts || []);
        setDataReady(true);
      } catch {
        localStorage.removeItem("magizh-token");
        localStorage.removeItem("magizh-user");
        localStorage.removeItem("magizh-profile");
      } finally {
        setAuthChecking(false);
      }
    }
    restoreSession();
  }, []);

  async function authenticated(data) {
    setAuth(data.user);
    setProfile(data.profile);
    if (data.profile?.language) setLanguage(data.profile.language);
    try {
      const [r, c] = await Promise.all([
        API.request("/api/reminders"),
        API.request("/api/contacts")
      ]);
      setReminders(r.reminders || []);
      setContacts(c.contacts || []);
    } catch {}
    setDataReady(true);
  }

  async function saveProfile(next) {
    setProfile(next);
    localStorage.setItem("magizh-profile", JSON.stringify(next));
    try { await API.request("/api/profile", { method: "PUT", body: JSON.stringify({ profile: next }) }); }
    catch (error) { console.error("Profile sync failed:", error); }
  }

  useEffect(() => {
    if (!dataReady || !auth) return;
    API.request("/api/reminders", { method: "PUT", body: JSON.stringify({ reminders }) }).catch(() => {});
  }, [reminders, dataReady, auth]);

  useEffect(() => {
    if (!dataReady || !auth) return;
    API.request("/api/contacts", { method: "PUT", body: JSON.stringify({ contacts }) }).catch(() => {});
  }, [contacts, dataReady, auth]);

  useEffect(() => {
    localStorage.setItem("magizh-lang", language);
  }, [language]);

  useEffect(() => {
    if (profile?.language !== language) {
      const next = { ...profile, language };
      if (profile) saveProfile(next);
    }
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  function logout() {
    localStorage.removeItem("magizh-token");
    localStorage.removeItem("magizh-user");
    localStorage.removeItem("magizh-profile");
    setAuth(null);
    setProfile(null);
    setDataReady(false);
    setTab("home");
  }

  if (splash) {
    return <Splash done={() => setSplash(false)} />;
  }

  if (authChecking) {
    return (
      <div className="auth-shell">
        <div className="auth-loading">
          <img src="/magizh-logo.png" alt="Magizh" />
          <p>Restoring your secure session…</p>
        </div>
      </div>
    );
  }

  if (!auth) {
    return <AuthScreen onAuthenticated={authenticated} />;
  }

  if (!profile) {
    return <Onboarding onComplete={saveProfile} />;
  }

  const pregnancy = pregnancyInfo(profile);
  const text = T[language] || T.en;
  let page = null;

  if (tab === "home") {
    page = (
      <HomePage p={profile} preg={pregnancy} reminders={reminders}
        openReminder={() => setModal("reminder")}
        openVitals={() => setModal("vital")}
        goToLearn={() => setTab("learn")} t={text} />
    );
  }
  if (tab === "learn") page = <Learn />;
  if (tab === "ai") page = <AIPage profile={profile} />;
  if (tab === "community") page = <Community profileName={profile.name || "You"} />;
  if (tab === "profile") {
    page = (
      <Profile
        p={profile}
        setP={saveProfile}
        lang={language}
        setLang={setLanguage}
        onReset={logout}
        openContacts={() => setTab("contacts")}
      />
    );
  }
  if (tab === "contacts") {
    page = <Contacts contacts={contacts} setContacts={setContacts} onBack={() => setTab("profile")} />;
  }

  return (
    <div className="app">
      <main>{page}</main>
      <nav>
        {[
          [Home, "home", text.home],
          [BookOpen, "learn", text.learn],
          [Sparkles, "ai", text.ai],
          [Users, "community", text.community],
          [User, "profile", text.profile]
        ].map(([Icon, key, label]) => (
          <button key={key} className={tab === key ? "selected" : ""} onClick={() => setTab(key)}>
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {modal === "reminder" && (
        <ReminderModal
          onClose={() => setModal(null)}
          onSave={reminder => { setReminders(current => [...current, reminder]); setModal(null); }}
        />
      )}
      {modal === "vital" && (
        <VitalModal onClose={() => setModal(null)} onSave={() => setModal(null)} />
      )}
    </div>
  );
}

/* ============================================================
   START REACT
   ============================================================ */

createRoot(
  document.getElementById("root")
).render(
  <App />
);