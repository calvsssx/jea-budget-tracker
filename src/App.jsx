import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import {
  collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, updateDoc
} from "firebase/firestore";

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: "💵", color: "#f472b6" },
  { id: "maribank", label: "MariBank", icon: "🏦", color: "#c084fc" },
  { id: "chinabank", label: "ChinaBank", icon: "🏛️", color: "#fb7185" },
  { id: "unionbank", label: "UnionBank", icon: "🔶", color: "#f9a8d4" },
  { id: "bdo-savings", label: "BDO Savings", icon: "💰", color: "#a78bfa" },
  { id: "bdo-credit", label: "BDO Credit", icon: "💳", color: "#e879f9" },
  { id: "gcash", label: "GCash", icon: "📱", color: "#2dd4bf" },
];

const CATEGORIES = [
  { id: "food", label: "Food & Dining", emoji: "🍜", color: "#f97316" },
  { id: "transport", label: "Transport", emoji: "🚌", color: "#3b82f6" },
  { id: "shopping", label: "Shopping", emoji: "🛍️", color: "#ec4899" },
  { id: "bills", label: "Bills & Utilities", emoji: "📄", color: "#8b5cf6" },
  { id: "health", label: "Health", emoji: "💊", color: "#10b981" },
  { id: "beauty", label: "Beauty & Self-care", emoji: "💅", color: "#f472b6" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬", color: "#6366f1" },
  { id: "groceries", label: "Groceries", emoji: "🛒", color: "#22c55e" },
  { id: "gifts", label: "Gifts", emoji: "🎁", color: "#e879f9" },
  { id: "savings", label: "Savings", emoji: "🐷", color: "#14b8a6" },
  { id: "other", label: "Other", emoji: "📌", color: "#a1a1aa" },
];

const DEFAULT_CAT_LIMITS = {
  food: 5000, transport: 2000, shopping: 3000, bills: 5000, health: 1500,
  beauty: 2000, entertainment: 1500, groceries: 3000, gifts: 1000, savings: 2000, other: 1500,
};

const fmt = (n) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => n >= 1000 ? "₱" + (n / 1000).toFixed(1) + "k" : "₱" + n;
const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayStr = () => dateStr(new Date());
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Firebase helpers ───
const EXPENSES_COL = "expenses";
const SETTINGS_DOC = "settings/budget";

async function fbAddExpense(expense) {
  await setDoc(doc(db, EXPENSES_COL, String(expense.id)), expense);
}
async function fbUpdateExpense(expense) {
  await setDoc(doc(db, EXPENSES_COL, String(expense.id)), expense);
}
async function fbDeleteExpense(id) {
  await deleteDoc(doc(db, EXPENSES_COL, String(id)));
}
async function fbSaveSettings(settings) {
  await setDoc(doc(db, "settings", "budget"), settings);
}

// ─── Components ───
function Dropdown({ value, onChange, options, renderOption, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const selected = options.find((o) => o.id === value);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(!open)} style={{
        width: "100%", padding: "11px 14px", border: "2px solid #fce4ec", borderRadius: 14,
        background: "#fff0f5", textAlign: "left", cursor: "pointer", fontSize: 14,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: "inherit", color: selected ? "#9c2460" : "#d4a0b9",
      }}>
        <span>{selected ? renderOption(selected) : placeholder}</span>
        <span style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "0.2s", fontSize: 11, color: "#e191b4" }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff7fa", border: "2px solid #fce4ec", borderRadius: 14,
          boxShadow: "0 8px 32px rgba(200,100,150,0.15)", zIndex: 50, maxHeight: 200,
          overflowY: "auto", padding: 4,
        }}>
          {options.map((opt) => (
            <button key={opt.id} type="button" onClick={() => { onChange(opt.id); setOpen(false); }} style={{
              width: "100%", padding: "9px 12px", border: "none",
              background: value === opt.id ? "#fde4ef" : "transparent", textAlign: "left",
              cursor: "pointer", borderRadius: 10, fontSize: 14, fontFamily: "inherit",
              color: "#9c2460", display: "flex", alignItems: "center", gap: 8,
            }}
              onMouseEnter={(e) => (e.target.style.background = "#fde4ef")}
              onMouseLeave={(e) => (e.target.style.background = value === opt.id ? "#fde4ef" : "transparent")}
            >{renderOption(opt)}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentBadge({ methodId }) {
  const m = PAYMENT_METHODS.find((p) => p.id === methodId);
  if (!m) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      background: m.color + "20", color: m.color, fontWeight: 600,
      fontSize: 11, padding: "2px 8px", borderRadius: 20, border: `1.5px solid ${m.color}35`,
    }}>{m.icon} {m.label}</span>
  );
}

function FloatingHearts() {
  const hearts = Array.from({ length: 10 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 8,
    size: 10 + Math.random() * 14, duration: 6 + Math.random() * 6,
    opacity: 0.05 + Math.random() * 0.07,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      <style>{`@keyframes floatUp { 0% { transform: translateY(100vh) rotate(0deg); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-80px) rotate(25deg); opacity: 0; } }`}</style>
      {hearts.map((h) => (
        <div key={h.id} style={{ position: "absolute", left: `${h.left}%`, bottom: -40, fontSize: h.size, opacity: h.opacity, animation: `floatUp ${h.duration}s ease-in-out ${h.delay}s infinite` }}>💗</div>
      ))}
    </div>
  );
}

function BudgetBar({ spent, limit, color, label, icon }) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const over = spent > limit && limit > 0;
  const remaining = limit - spent;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#9c2460", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
          {icon} {label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: over ? "#ef4444" : "#e879a8" }}>{fmt(spent)} / {fmt(limit)}</span>
      </div>
      <div style={{ height: 10, background: "#fde4ef", borderRadius: 8, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 8, transition: "width 0.5s ease", width: `${pct}%`,
          background: over ? "linear-gradient(90deg, #ef4444, #f87171)" : pct > 75 ? "linear-gradient(90deg, #fbbf24, #f59e0b)" : `linear-gradient(90deg, ${color}, ${color}cc)`,
        }} />
      </div>
      <div style={{ fontSize: 10, marginTop: 3, fontWeight: 600, color: over ? "#ef4444" : "#d4a0b9", textAlign: "right" }}>
        {over ? `⚠️ Over by ${fmt(Math.abs(remaining))}!` : `${fmt(remaining)} left`}
      </div>
    </div>
  );
}

function CalendarView({ expenses, selectedDate, onSelectDate, calMonth, calYear, onChangeMonth }) {
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();
  const isToday = (d) => d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
  const dayTotals = {};
  expenses.forEach((e) => { const [y, m, d] = e.date.split("-").map(Number); if (y === calYear && m - 1 === calMonth) dayTotals[d] = (dayTotals[d] || 0) + Number(e.amount); });
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dateStr(new Date(calYear, calMonth, d));
    const isSel = ds === selectedDate; const has = dayTotals[d] > 0;
    cells.push(
      <button key={d} onClick={() => onSelectDate(ds)} style={{
        border: "none", borderRadius: 12, padding: "4px 2px", cursor: "pointer",
        background: isSel ? "linear-gradient(135deg, #ec4899, #e879f9)" : isToday(d) ? "#fde4ef" : "transparent",
        color: isSel ? "white" : isToday(d) ? "#db2777" : "#9c2460",
        fontFamily: "inherit", fontSize: 13, fontWeight: isSel || isToday(d) ? 700 : 500,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
        transition: "all 0.15s", minHeight: 44, justifyContent: "center",
        boxShadow: isSel ? "0 3px 12px rgba(236,72,153,0.3)" : "none",
      }}>
        <span>{d}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: isSel ? "rgba(255,255,255,0.85)" : "#e879a8", lineHeight: 1, marginTop: 1, opacity: has ? 1 : 0 }}>{has ? fmtShort(dayTotals[d]) : "-"}</span>
      </button>
    );
  }
  return (
    <div style={{ background: "rgba(255,255,255,0.8)", borderRadius: 20, boxShadow: "0 2px 16px rgba(236,72,153,0.08)", border: "1.5px solid #fce4ec", padding: "16px 14px", backdropFilter: "blur(8px)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => onChangeMonth(-1)} style={{ border: "none", background: "#fde4ef", borderRadius: 10, width: 34, height: 34, cursor: "pointer", fontSize: 16, color: "#db2777", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#9c2460" }}>{MONTH_NAMES[calMonth]} {calYear} 🌸</div>
        <button onClick={() => onChangeMonth(1)} style={{ border: "none", background: "#fde4ef", borderRadius: 10, width: 34, height: 34, cursor: "pointer", fontSize: 16, color: "#db2777", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAY_LABELS.map((d) => (<div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#e191b4", padding: "4px 0" }}>{d}</div>))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>{cells}</div>
      <div style={{ marginTop: 12, padding: "10px 14px", background: "linear-gradient(135deg, #fdf2f8, #fce7f3)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#e879a8" }}>🌷 Month Total</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#be185d" }}>{fmt(Object.values(dayTotals).reduce((a, b) => a + b, 0))}</span>
      </div>
    </div>
  );
}

// ─── Main App ───
function BudgetApp() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [catLimits, setCatLimits] = useState({ ...DEFAULT_CAT_LIMITS });
  const [monthlyBudget, setMonthlyBudget] = useState(27500);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [form, setForm] = useState({ description: "", amount: "", category: "", method: "" });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tab, setTab] = useState("calendar");
  const [editingLimit, setEditingLimit] = useState(null);
  const [limitInput, setLimitInput] = useState("");
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [saving, setSaving] = useState(false);
  const nextId = useRef(Date.now());

  // Real-time listener for expenses
  useEffect(() => {
    const unsub = onSnapshot(collection(db, EXPENSES_COL), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
      // Convert id back to number for consistency
      const parsed = data.map((e) => ({ ...e, id: isNaN(Number(e.id)) ? e.id : Number(e.id), amount: Number(e.amount) }));
      setExpenses(parsed);
      if (parsed.length > 0) {
        const maxId = Math.max(...parsed.map((e) => (typeof e.id === "number" ? e.id : 0)));
        nextId.current = Math.max(nextId.current, maxId + 1);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore listen error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Real-time listener for settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "budget"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.catLimits) setCatLimits(data.catLimits);
        if (data.monthlyBudget !== undefined) setMonthlyBudget(data.monthlyBudget);
      }
    });
    return () => unsub();
  }, []);

  const saveSettings = useCallback((newCatLimits, newBudget) => {
    fbSaveSettings({ catLimits: newCatLimits, monthlyBudget: newBudget });
  }, []);

  // Monthly spend per category
  const catSpend = {};
  CATEGORIES.forEach((c) => { catSpend[c.id] = 0; });
  expenses.forEach((e) => {
    const [y, mo] = e.date.split("-").map(Number);
    if (y === calYear && mo - 1 === calMonth) catSpend[e.category] = (catSpend[e.category] || 0) + Number(e.amount);
  });
  const monthTotalSpent = Object.values(catSpend).reduce((a, b) => a + b, 0);

  const changeMonth = (dir) => { let m = calMonth + dir, y = calYear; if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; } setCalMonth(m); setCalYear(y); };

  const dayExpenses = expenses.filter((e) => e.date === selectedDate);
  const dayTotal = dayExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const selDateObj = new Date(selectedDate + "T00:00:00");
  const friendlyDate = selDateObj.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });

  const getWarning = (catId, amount) => {
    if (!catId || !amount || !catLimits[catId]) return null;
    const editAmt = editId ? (expenses.find(e => String(e.id) === String(editId))?.category === catId ? Number(expenses.find(e => String(e.id) === String(editId))?.amount || 0) : 0) : 0;
    const newTotal = catSpend[catId] - editAmt + Number(amount);
    if (newTotal > catLimits[catId]) {
      const cat = CATEGORIES.find(c => c.id === catId);
      return `This will exceed your ${cat?.label} limit by ${fmt(newTotal - catLimits[catId])}!`;
    }
    return null;
  };
  const warning = getWarning(form.category, form.amount);

  const handleSubmit = async () => {
    if (!form.description || !form.amount || !form.category || !form.method) return;
    setSaving(true);
    try {
      if (editId !== null) {
        const updated = { ...form, amount: Number(form.amount), date: selectedDate, id: editId };
        await fbUpdateExpense(updated);
        setEditId(null);
      } else {
        const id = nextId.current++;
        const newExp = { id, ...form, amount: Number(form.amount), date: selectedDate };
        await fbAddExpense(newExp);
      }
      setForm({ description: "", amount: "", category: "", method: "" });
      setShowForm(false);
    } catch (e) { console.error("Save error:", e); }
    setSaving(false);
  };

  const handleEdit = (exp) => { setForm({ description: exp.description, amount: String(exp.amount), category: exp.category, method: exp.method }); setEditId(exp.id); setShowForm(true); };
  const handleDelete = async (id) => { await fbDeleteExpense(id); };

  const saveLimitEdit = (catId) => {
    const val = parseFloat(limitInput);
    if (!isNaN(val) && val >= 0) {
      const newLimits = { ...catLimits, [catId]: val };
      setCatLimits(newLimits);
      saveSettings(newLimits, monthlyBudget);
    }
    setEditingLimit(null); setLimitInput("");
  };

  const saveBudgetEdit = () => {
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val >= 0) {
      setMonthlyBudget(val);
      saveSettings(catLimits, val);
    }
    setEditingBudget(false); setBudgetInput("");
  };

  const allByDate = {}; expenses.forEach((e) => { if (!allByDate[e.date]) allByDate[e.date] = []; allByDate[e.date].push(e); });
  const sortedDates = Object.keys(allByDate).sort((a, b) => b.localeCompare(a));

  const inputStyle = { width: "100%", padding: "11px 14px", border: "2px solid #fce4ec", borderRadius: 14, background: "#fff0f5", fontSize: 14, fontFamily: "inherit", color: "#9c2460", outline: "none", boxSizing: "border-box" };
  const overBudgetCats = CATEGORIES.filter((c) => catLimits[c.id] > 0 && catSpend[c.id] > catLimits[c.id]);
  const overMonthly = monthTotalSpent > monthlyBudget;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(170deg, #fff0f6, #fbcfe8)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center", color: "#db2777" }}><div style={{ fontSize: 48, marginBottom: 12 }}>🌸</div><div style={{ fontSize: 16, fontWeight: 700 }}>Loading your budget...</div></div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(170deg, #fff0f6 0%, #fdf2f8 30%, #fce7f3 60%, #fbcfe8 100%)", fontFamily: "'Nunito', 'DM Sans', sans-serif", color: "#831843", padding: "0 0 80px 0", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet" />
      <FloatingHearts />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #ec4899 0%, #f472b6 40%, #e879f9 100%)", padding: "28px 24px 24px", color: "white", position: "relative", overflow: "hidden", borderRadius: "0 0 32px 32px", boxShadow: "0 8px 32px rgba(236,72,153,0.3)" }}>
        <div style={{ position: "absolute", top: -30, right: -20, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
        <div style={{ position: "absolute", bottom: -30, left: 20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <div style={{ position: "absolute", top: 18, right: 30, fontSize: 18, opacity: 0.5 }}>✨</div>
        <div style={{ position: "absolute", bottom: 16, right: 80, fontSize: 14, opacity: 0.4 }}>💖</div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: 16, opacity: 0.9, marginBottom: 2 }}>Jea's ✿</div>
          <div style={{ fontSize: 12, opacity: 0.8, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Budget Tracker</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
            <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1, textShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>{fmt(monthTotalSpent)}</div>
            <div style={{ fontSize: 14, opacity: 0.8, fontWeight: 600 }}>/ {fmt(monthlyBudget)}</div>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.25)", borderRadius: 6, overflow: "hidden", marginTop: 6, marginBottom: 4, maxWidth: 280 }}>
            <div style={{ height: "100%", borderRadius: 6, transition: "width 0.5s", width: `${Math.min((monthTotalSpent / monthlyBudget) * 100, 100)}%`, background: overMonthly ? "#fbbf24" : "rgba(255,255,255,0.8)" }} />
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 500 }}>
            {overMonthly ? `⚠️ Over budget by ${fmt(monthTotalSpent - monthlyBudget)}` : `${fmt(monthlyBudget - monthTotalSpent)} remaining`} · {MONTH_NAMES[calMonth]} 🌸
          </div>
          {overBudgetCats.length > 0 && (
            <div style={{ marginTop: 6, background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "5px 12px", fontSize: 11, fontWeight: 700 }}>⚠️ Over limit: {overBudgetCats.map((c) => c.label).join(", ")}</div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px", position: "relative", zIndex: 1 }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, margin: "16px 0 14px", background: "#fde4ef", borderRadius: 16, padding: 3 }}>
          {[{ id: "calendar", label: "📅 Calendar" }, { id: "categories", label: "🏷️ Categories" }, { id: "list", label: "📋 All" }].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "10px 0", border: "none", borderRadius: 13, cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 700, transition: "all 0.2s",
              background: tab === t.id ? "white" : "transparent", color: tab === t.id ? "#db2777" : "#e191b4",
              boxShadow: tab === t.id ? "0 2px 8px rgba(236,72,153,0.12)" : "none",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ═══ CATEGORIES TAB ═══ */}
        {tab === "categories" && (
          <div style={{ background: "rgba(255,255,255,0.8)", borderRadius: 20, boxShadow: "0 2px 16px rgba(236,72,153,0.08)", border: "1.5px solid #fce4ec", padding: "18px 16px", backdropFilter: "blur(8px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <button onClick={() => changeMonth(-1)} style={{ border: "none", background: "#fde4ef", borderRadius: 10, width: 32, height: 32, cursor: "pointer", fontSize: 15, color: "#db2777", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#9c2460" }}>🏷️ {MONTH_NAMES[calMonth]} {calYear}</div>
              <button onClick={() => changeMonth(1)} style={{ border: "none", background: "#fde4ef", borderRadius: 10, width: 32, height: 32, cursor: "pointer", fontSize: 15, color: "#db2777", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
            </div>

            {/* Monthly budget */}
            <div style={{ marginBottom: 16, padding: "14px 16px", background: "linear-gradient(135deg, #fdf2f8, #fce7f3)", borderRadius: 16, border: "1.5px solid #fce4ec" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#9c2460" }}>🌸 Monthly Budget</span>
                {!editingBudget && <button onClick={() => { setEditingBudget(true); setBudgetInput(String(monthlyBudget)); }} style={{ border: "1px solid #fce4ec", background: "#fff0f5", borderRadius: 8, padding: "3px 10px", fontSize: 11, cursor: "pointer", color: "#db2777", fontWeight: 600, fontFamily: "inherit" }}>✏️ edit</button>}
              </div>
              {editingBudget ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#e879a8", fontWeight: 700, pointerEvents: "none" }}>₱</span>
                    <input type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveBudgetEdit()} autoFocus style={{ ...inputStyle, padding: "9px 12px 9px 28px", fontSize: 13 }} />
                  </div>
                  <button onClick={saveBudgetEdit} style={{ border: "none", borderRadius: 12, padding: "0 16px", background: "linear-gradient(135deg, #ec4899, #e879f9)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
                  <button onClick={() => { setEditingBudget(false); setBudgetInput(""); }} style={{ border: "1px solid #fce4ec", borderRadius: 12, padding: "0 12px", background: "#fff0f5", color: "#db2777", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#be185d", marginBottom: 6 }}>{fmt(monthlyBudget)}</div>
                  <div style={{ height: 10, background: "#fde4ef", borderRadius: 8, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{ height: "100%", borderRadius: 8, transition: "width 0.5s", width: `${Math.min((monthTotalSpent / monthlyBudget) * 100, 100)}%`, background: overMonthly ? "linear-gradient(90deg, #ef4444, #f87171)" : monthTotalSpent / monthlyBudget > 0.75 ? "linear-gradient(90deg, #fbbf24, #f59e0b)" : "linear-gradient(90deg, #ec4899, #f472b6)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                    <span style={{ color: "#e879a8" }}>Spent: {fmt(monthTotalSpent)}</span>
                    <span style={{ color: overMonthly ? "#ef4444" : "#2dd4bf" }}>{overMonthly ? `Over by ${fmt(monthTotalSpent - monthlyBudget)}` : `Left: ${fmt(monthlyBudget - monthTotalSpent)}`}</span>
                  </div>
                </>
              )}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: "#e879a8", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Category Limits</div>

            {CATEGORIES.map((c) => {
              const spent = catSpend[c.id] || 0; const limit = catLimits[c.id] || 0; const isEditing = editingLimit === c.id;
              return (
                <div key={c.id}>
                  {isEditing ? (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#9c2460", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, display: "inline-block" }} />{c.emoji} {c.label} — monthly limit
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <div style={{ position: "relative", flex: 1 }}>
                          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#e879a8", fontWeight: 700, pointerEvents: "none" }}>₱</span>
                          <input type="number" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveLimitEdit(c.id)} autoFocus placeholder="0" style={{ ...inputStyle, padding: "9px 12px 9px 28px", fontSize: 13 }} />
                        </div>
                        <button onClick={() => saveLimitEdit(c.id)} style={{ border: "none", borderRadius: 12, padding: "0 16px", background: "linear-gradient(135deg, #ec4899, #e879f9)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
                        <button onClick={() => { setEditingLimit(null); setLimitInput(""); }} style={{ border: "1px solid #fce4ec", borderRadius: 12, padding: "0 12px", background: "#fff0f5", color: "#db2777", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ position: "relative" }}>
                      <button onClick={() => { setEditingLimit(c.id); setLimitInput(String(limit)); }} style={{ position: "absolute", top: 0, right: 0, border: "1px solid #fce4ec", background: "#fdf2f8", borderRadius: 8, padding: "2px 8px", fontSize: 10, cursor: "pointer", color: "#db2777", fontWeight: 600, fontFamily: "inherit", zIndex: 2 }}>✏️ edit</button>
                      <BudgetBar spent={spent} limit={limit} color={c.color} label={c.label} icon={c.emoji} />
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ marginTop: 8, padding: "10px 14px", background: "#fdf2f8", borderRadius: 12, border: "1px solid #fce4ec" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#d4a0b9" }}><span>Sum of category limits</span><span>{fmt(Object.values(catLimits).reduce((a, b) => a + b, 0))}</span></div>
            </div>
          </div>
        )}

        {/* ═══ CALENDAR TAB ═══ */}
        {tab === "calendar" && (
          <>
            <CalendarView expenses={expenses} selectedDate={selectedDate} onSelectDate={setSelectedDate} calMonth={calMonth} calYear={calYear} onChangeMonth={changeMonth} />
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#9c2460" }}>{friendlyDate}</div>
                  <div style={{ fontSize: 12, color: "#e191b4", fontWeight: 600 }}>{dayExpenses.length} expense{dayExpenses.length !== 1 ? "s" : ""} · {fmt(dayTotal)}</div>
                </div>
                <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ description: "", amount: "", category: "", method: "" }); }} style={{ padding: "8px 16px", border: "2px dashed #f9a8d4", borderRadius: 14, background: showForm ? "#fdf2f8" : "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#db2777", fontFamily: "inherit" }}>{showForm ? "✕" : "＋ Add ✿"}</button>
              </div>
              {showForm && (
                <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 18, padding: "16px", boxShadow: "0 4px 20px rgba(236,72,153,0.1)", border: "1.5px solid #fce4ec", marginBottom: 12, animation: "slideDown 0.25s ease", backdropFilter: "blur(8px)" }}>
                  <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input placeholder="What did you spend on? 🛒" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} />
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#e879a8", fontWeight: 700, pointerEvents: "none" }}>₱</span>
                      <input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, paddingLeft: 30 }} />
                    </div>
                    <Dropdown value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={CATEGORIES} placeholder="Pick a category 🌷"
                      renderOption={(o) => (
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {o.emoji} {o.label}
                          {catLimits[o.id] > 0 && <span style={{ fontSize: 10, color: catSpend[o.id] > catLimits[o.id] ? "#ef4444" : "#d4a0b9", marginLeft: 4 }}>({fmtShort(catSpend[o.id])}/{fmtShort(catLimits[o.id])})</span>}
                        </span>
                      )} />
                    <Dropdown value={form.method} onChange={(v) => setForm({ ...form, method: v })} options={PAYMENT_METHODS} placeholder="Payment method 💳"
                      renderOption={(o) => (
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: o.color, display: "inline-block", flexShrink: 0 }} />
                          {o.icon} {o.label}
                        </span>
                      )} />
                    {warning && <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>⚠️ {warning}</div>}
                    <button onClick={handleSubmit} disabled={!form.description || !form.amount || !form.category || !form.method || saving} style={{
                      padding: "12px", border: "none", borderRadius: 14,
                      background: (!form.description || !form.amount || !form.category || !form.method) ? "#f3d5e4" : "linear-gradient(135deg, #ec4899, #e879f9)",
                      color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(236,72,153,0.3)",
                      opacity: saving ? 0.7 : 1,
                    }}>{saving ? "Saving..." : editId !== null ? "✓ Update" : "✓ Add Expense"} 💖</button>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dayExpenses.length === 0 && !showForm && (
                  <div style={{ textAlign: "center", padding: "30px 20px", color: "#e879a8", fontSize: 13 }}><div style={{ fontSize: 36, marginBottom: 6 }}>🌷</div>No expenses on this day!<br />Tap "＋ Add" to log something 💕</div>
                )}
                {dayExpenses.map((exp) => {
                  const cat = CATEGORIES.find((c) => c.id === exp.category);
                  return (
                    <div key={exp.id} style={{ background: "rgba(255,255,255,0.8)", borderRadius: 16, padding: "12px 14px", boxShadow: "0 2px 10px rgba(236,72,153,0.06)", border: "1.5px solid #fce4ec", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #fdf2f8, #fce7f3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, border: "1px solid #fce4ec" }}>{cat?.emoji || "📌"}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#9c2460", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.description}</div>
                        <PaymentBadge methodId={exp.method} />
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#be185d" }}>{fmt(exp.amount)}</div>
                        <div style={{ display: "flex", gap: 4, marginTop: 3, justifyContent: "flex-end" }}>
                          <button onClick={() => handleEdit(exp)} style={{ border: "1px solid #fce4ec", background: "#fdf2f8", borderRadius: 7, padding: "2px 7px", fontSize: 11, cursor: "pointer", color: "#db2777" }}>✏️</button>
                          <button onClick={() => handleDelete(exp.id)} style={{ border: "1px solid #ffe4e9", background: "#fff0f3", borderRadius: 7, padding: "2px 7px", fontSize: 11, cursor: "pointer", color: "#f43f5e" }}>🗑️</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ═══ LIST TAB ═══ */}
        {tab === "list" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {sortedDates.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: "#e879a8", fontSize: 14 }}><div style={{ fontSize: 44, marginBottom: 8 }}>🌷</div>No expenses yet! 💕</div>}
            {sortedDates.map((date) => {
              const d = new Date(date + "T00:00:00");
              const dayLabel = d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
              const dayItems = allByDate[date]; const daySum = dayItems.reduce((s, e) => s + Number(e.amount), 0);
              return (
                <div key={date}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#db2777" }}>📅 {dayLabel}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#e879a8" }}>{fmt(daySum)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {dayItems.map((exp) => {
                      const cat = CATEGORIES.find((c) => c.id === exp.category);
                      return (
                        <div key={exp.id} style={{ background: "rgba(255,255,255,0.8)", borderRadius: 16, padding: "12px 14px", boxShadow: "0 2px 10px rgba(236,72,153,0.06)", border: "1.5px solid #fce4ec", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #fdf2f8, #fce7f3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, border: "1px solid #fce4ec" }}>{cat?.emoji || "📌"}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#9c2460", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.description}</div>
                            <PaymentBadge methodId={exp.method} />
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: "#be185d" }}>{fmt(exp.amount)}</div>
                            <div style={{ display: "flex", gap: 4, marginTop: 3, justifyContent: "flex-end" }}>
                              <button onClick={() => handleEdit(exp)} style={{ border: "1px solid #fce4ec", background: "#fdf2f8", borderRadius: 7, padding: "2px 7px", fontSize: 11, cursor: "pointer", color: "#db2777" }}>✏️</button>
                              <button onClick={() => handleDelete(exp.id)} style={{ border: "1px solid #ffe4e9", background: "#fff0f3", borderRadius: 7, padding: "2px 7px", fontSize: 11, cursor: "pointer", color: "#f43f5e" }}>🗑️</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default BudgetApp;
