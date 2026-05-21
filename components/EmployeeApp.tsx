"use client"

import { useState, useEffect, useRef, useCallback } from "react"

// ─── Types ───────────────────────────────────────────────────────────────────
interface Employee {
  id: string
  name: string
  year: string
  role: string
}

type Screen = "loading" | "select" | "main" | "confirm" | "success"
type Action = "arrive" | "leave"

// ─── Mock data (replaces google.script.run in preview) ───────────────────────
const MOCK_EMPLOYEES: Employee[] = [
  { id: "1", name: "Arkadiusz G.", year: "1991", role: "Lekarz dentysta" },
  { id: "2", name: "Monika W.", year: "1988", role: "Higienistka stomatologiczna" },
  { id: "3", name: "Patrycja K.", year: "1995", role: "Asystent stomatologiczny" },
  { id: "4", name: "Tomasz N.", year: "1983", role: "Ortodonta" },
  { id: "5", name: "Karolina B.", year: "1997", role: "Recepcja" },
]

const CLINIC = { nazwa: "We SMILE", miasto: "Warszawa" }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTimeSlot(ts: number) {
  return Math.floor(ts / 60000)
}

function mockToken(slot: number): string {
  // Deterministic fake hex token for preview
  const base = ((slot * 2654435761) >>> 0).toString(16).padStart(8, "0")
  const ext = ((slot * 1234567891 + 987654321) >>> 0).toString(16).padStart(8, "0")
  return (base + ext).substring(0, 16)
}

function formatToken(hex: string): string {
  return hex.replace(/(.{4})/g, "$1 · ").replace(/ · $/, "")
}

function saveEmployee(emp: Employee) {
  try {
    localStorage.setItem("rcp_employee", JSON.stringify(emp))
  } catch (_) {
    // Safari private mode
  }
}

function loadEmployee(): Employee | null {
  try {
    const s = localStorage.getItem("rcp_employee")
    return s ? JSON.parse(s) : null
  } catch (_) {
    return null
  }
}

function pad2(n: number) {
  return n.toString().padStart(2, "0")
}

function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function formatDate(d: Date) {
  const days = ["Niedz.", "Pon.", "Wt.", "Śr.", "Czw.", "Pt.", "Sob."]
  const months = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"]
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

// ─── Grid background style ────────────────────────────────────────────────────
const gridBg = {
  backgroundImage: `
    repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.04) 39px, rgba(255,255,255,0.04) 40px),
    repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.04) 39px, rgba(255,255,255,0.04) 40px)
  `,
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EmployeeApp() {
  const [screen, setScreen] = useState<Screen>("loading")
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [action, setAction] = useState<Action>("arrive")
  const [tokenInput, setTokenInput] = useState("")
  const [tokenError, setTokenError] = useState("")
  const [now, setNow] = useState(new Date())
  const [secsLeft, setSecsLeft] = useState(60)
  const [currentToken, setCurrentToken] = useState("")
  const [successTime, setSuccessTime] = useState("")
  const [successAction, setSuccessAction] = useState<Action>("arrive")
  const [successEmployee, setSuccessEmployee] = useState<Employee | null>(null)
  const [successProgress, setSuccessProgress] = useState(100)
  const successTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Clock + token ticker ────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setNow(n)
      const slot = getTimeSlot(n.getTime())
      const secsInSlot = Math.floor((n.getTime() % 60000) / 1000)
      setSecsLeft(60 - secsInSlot)
      setCurrentToken(mockToken(slot))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // ─── Init: load saved employee ───────────────────────────────────────────
  useEffect(() => {
    const saved = loadEmployee()
    if (saved) {
      setEmployee(saved)
      setScreen("main")
    } else {
      setScreen("select")
    }
  }, [])

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleSelectEmployee = (emp: Employee) => {
    setEmployee(emp)
    saveEmployee(emp)
    setScreen("main")
  }

  const handleActionClick = (a: Action) => {
    if (!tokenInput.trim()) {
      setTokenError("Wpisz token z tabletu")
      return
    }
    setTokenError("")
    setAction(a)
    setScreen("confirm")
  }

  const handleConfirm = () => {
    // In the real app: google.script.run.weryfikujIRejestruj(...)
    // For preview: verify token matches current or ±1 slot (first 4 chars)
    const now_ = new Date()
    const slot = getTimeSlot(now_.getTime())
    const validTokens = [
      mockToken(slot - 1).substring(0, 4),
      mockToken(slot).substring(0, 4),
      mockToken(slot + 1).substring(0, 4),
    ]
    const input = tokenInput.trim().toLowerCase().replace(/[^a-f0-9]/g, "")
    if (!validTokens.includes(input) && input !== mockToken(slot).substring(0, 16).replace(/\s/g, "")) {
      // In preview we'll be lenient — just accept anything 4+ chars
    }
    setSuccessTime(formatTime(now_))
    setSuccessAction(action)
    setSuccessEmployee(employee)
    setSuccessProgress(100)
    setScreen("success")

    // 3-second countdown
    let elapsed = 0
    if (successTimerRef.current) clearInterval(successTimerRef.current)
    successTimerRef.current = setInterval(() => {
      elapsed += 50
      setSuccessProgress(Math.max(0, 100 - (elapsed / 3000) * 100))
      if (elapsed >= 3000) {
        clearInterval(successTimerRef.current!)
        setTokenInput("")
        setScreen("main")
      }
    }, 50)
  }

  const handleCancel = () => {
    setScreen("main")
    setTokenError("")
  }

  const handleSwitchEmployee = () => {
    setScreen("select")
  }

  // ─── Token strip color ───────────────────────────────────────────────────
  const tokenBarFill = secsLeft < 12 ? "rgba(255,255,255,0.4)" : "#ffffff"
  const tokenProgress = (secsLeft / 60) * 100

  // ─── Render screens ──────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <div style={{ ...gridBg, minHeight: "844px", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
          Ładowanie...
        </div>
      </div>
    )
  }

  // ─── SELECT SCREEN ───────────────────────────────────────────────────────
  if (screen === "select") {
    return (
      <div style={{ ...gridBg, minHeight: "844px", background: "#000", display: "flex", flexDirection: "column", padding: "48px 24px 32px" }}>
        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "12px" }}>
            {CLINIC.nazwa} · {CLINIC.miasto}
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "28px", fontWeight: 700, letterSpacing: "-0.5px", color: "#fff" }}>
            Wybierz profil
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "rgba(255,255,255,0.30)", marginTop: "6px", letterSpacing: "0.1em" }}>
            Profil zostanie zapamiętany
          </div>
        </div>

        {/* Employee list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {MOCK_EMPLOYEES.map(emp => (
            <button
              key={emp.id}
              onClick={() => handleSelectEmployee(emp)}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "12px",
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "all 0.15s",
                textAlign: "left",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.35)"
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"
              }}
            >
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "17px", fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>
                  {emp.name}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "rgba(255,255,255,0.30)", marginTop: "3px", letterSpacing: "0.08em" }}>
                  {emp.role} · ur. {emp.year}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="rgba(255,255,255,0.20)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>

        <div style={{ marginTop: "auto", paddingTop: "32px", fontFamily: "'Space Mono', monospace", fontSize: "7px", letterSpacing: "0.15em", color: "rgba(255,255,255,0.12)", textTransform: "uppercase", textAlign: "center" }}>
          Art. 149 KP · Ewidencja Czasu Pracy
        </div>
      </div>
    )
  }

  // ─── CONFIRM SCREEN ──────────────────────────────────────────────────────
  if (screen === "confirm" && employee) {
    const now_ = new Date()
    const actionLabel = action === "arrive" ? "Przyjście" : "Wyjście"
    const tokenShort = (currentToken || "").substring(0, 8)

    return (
      <div style={{ ...gridBg, minHeight: "844px", background: "#000", display: "flex", flexDirection: "column", padding: "40px 24px 32px" }}>
        {/* Tag */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "6px 12px", alignSelf: "flex-start", marginBottom: "32px" }}>
          <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.25)" }}>◈</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)" }}>Weryfikacja obecności</span>
        </div>

        {/* Employee hero */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "54px", fontWeight: 700, letterSpacing: "-2px", color: "#fff", lineHeight: 1 }}>
            {employee.name}
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "rgba(255,255,255,0.30)", marginTop: "8px", letterSpacing: "0.12em" }}>
            {employee.role}
          </div>
        </div>

        {/* Action */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "6px" }}>
            Rejestrujesz
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff" }}>
            {actionLabel}
          </div>
        </div>

        {/* Metadata table */}
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: "12px", marginBottom: "28px", overflow: "hidden" }}>
          {[
            { key: "Godzina", val: formatTime(now_), highlight: true },
            { key: "Data", val: formatDate(now_), highlight: false },
            { key: "Rok urodzenia", val: `ur. ${employee.year}`, highlight: false },
            { key: "Token", val: tokenShort + "…", highlight: false },
            { key: "Klinika", val: `${CLINIC.nazwa}, ${CLINIC.miasto}`, highlight: false },
          ].map((row, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "11px 16px",
              borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
                {row.key}
              </div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: row.highlight ? "#ffffff" : "rgba(255,255,255,0.45)", letterSpacing: "0.05em" }}>
                {row.val}
              </div>
            </div>
          ))}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          style={{
            width: "100%",
            background: "#ffffff",
            color: "#000000",
            border: "none",
            borderRadius: "14px",
            padding: "20px",
            fontFamily: "'Space Mono', monospace",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
            marginBottom: "12px",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          Potwierdzam — to ja
        </button>

        {/* Cancel */}
        <button
          onClick={handleCancel}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.20)",
            fontFamily: "'Space Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
            padding: "8px",
            transition: "color 0.15s",
            textAlign: "center",
            width: "100%",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#ffffff")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.20)")}
        >
          Anuluj
        </button>
      </div>
    )
  }

  // ─── SUCCESS SCREEN ──────────────────────────────────────────────────────
  if (screen === "success" && successEmployee) {
    const actionLabel = successAction === "arrive" ? "Przyjście" : "Wyjście"
    const actionSublabel = successAction === "arrive" ? "Zarejestrowano wejście" : "Zarejestrowano wyjście"

    return (
      <div style={{ ...gridBg, minHeight: "844px", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        {/* Double ring checkmark */}
        <div style={{ position: "relative", width: "80px", height: "80px", marginBottom: "28px" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.06)" }} />
          <div style={{ position: "absolute", inset: "8px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10l4 4 8-8" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Name */}
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "44px", fontWeight: 700, letterSpacing: "-1.5px", color: "#fff", textAlign: "center", marginBottom: "6px" }}>
          {successEmployee.name}
        </div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)", marginBottom: "20px" }}>
          {actionSublabel}
        </div>

        {/* Time pill */}
        <div style={{
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "20px",
          padding: "8px 18px",
          fontFamily: "'Space Mono', monospace",
          fontSize: "14px",
          color: "#fff",
          letterSpacing: "0.08em",
          fontVariantNumeric: "tabular-nums",
          marginBottom: "32px",
        }}>
          {successTime}
        </div>

        {/* Progress bar */}
        <div style={{ width: "160px", height: "1px", background: "rgba(255,255,255,0.12)", borderRadius: "1px", overflow: "hidden", marginBottom: "12px" }}>
          <div style={{
            height: "1px",
            background: "#fff",
            width: `${successProgress}%`,
            transition: "width 50ms linear",
          }} />
        </div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.12em" }}>
          Powrót za 3s
        </div>
      </div>
    )
  }

  // ─── MAIN SCREEN ─────────────────────────────────────────────────────────
  if (screen === "main" && employee) {
    return (
      <div style={{ ...gridBg, minHeight: "844px", background: "#000", display: "flex", flexDirection: "column", padding: "20px 20px 24px" }}>

        {/* Status bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
            {CLINIC.nazwa} · {CLINIC.miasto}
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em", fontVariantNumeric: "tabular-nums" }}>
            {formatTime(now)}
          </div>
        </div>

        {/* Token HMAC strip */}
        <div style={{ marginTop: "16px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "11px 14px", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", color: "rgba(255,255,255,0.15)" }}>◈</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
                HMAC-SHA256 · Token aktywny
              </span>
            </div>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums" }}>
              {secsLeft}s
            </span>
          </div>

          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", letterSpacing: "0.15em", color: "rgba(255,255,255,0.50)", marginBottom: "8px" }}>
            {formatToken(currentToken)}
          </div>

          {/* Progress bar */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", borderRadius: "1px", overflow: "hidden", marginBottom: "6px" }}>
            <div style={{
              height: "1px",
              background: tokenBarFill,
              width: `${tokenProgress}%`,
              transition: "width 1s linear, background 0.3s",
            }} />
          </div>

          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "7px", letterSpacing: "0.15em", color: "rgba(255,255,255,0.15)" }}>
            Klucz rotuje co 60s · SHA-256 · Okno ±1
          </div>
        </div>

        {/* Separator */}
        <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", marginTop: "16px" }} />

        {/* Profile */}
        <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "6px" }}>
              Zalogowany jako
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "36px", fontWeight: 700, letterSpacing: "-1px", color: "#fff", lineHeight: 1.1 }}>
              {employee.name}
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "rgba(255,255,255,0.30)", marginTop: "5px", letterSpacing: "0.08em" }}>
              ur. {employee.year} · {employee.role}
            </div>
          </div>

          {/* Switch employee button */}
          <button
            onClick={handleSwitchEmployee}
            title="Zmień pracownika"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "border-color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.60)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="2.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
              <path d="M2.5 13.5C2.5 11 4.8 9 8 9s5.5 2 5.5 4.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Token input */}
        <div style={{ marginTop: "20px" }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "8px" }}>
            Token z tabletu (4 znaki)
          </div>
          <input
            type="text"
            value={tokenInput}
            onChange={e => { setTokenInput(e.target.value); setTokenError("") }}
            placeholder="np. a3f9"
            maxLength={16}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${tokenError ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.12)"}`,
              borderRadius: "10px",
              padding: "13px 14px",
              fontFamily: "'Space Mono', monospace",
              fontSize: "15px",
              letterSpacing: "0.15em",
              color: "#fff",
              outline: "none",
              textTransform: "lowercase",
              transition: "border-color 0.15s",
            }}
            onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.45)")}
            onBlur={e => (e.target.style.borderColor = tokenError ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.12)")}
          />
          {tokenError && (
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", color: "rgba(255,255,255,0.45)", marginTop: "6px", letterSpacing: "0.10em" }}>
              {tokenError}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {/* PRZYJŚCIE */}
          <button
            onClick={() => handleActionClick("arrive")}
            style={{
              height: "148px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "14px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "all 0.15s",
              textAlign: "left",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#ffffff"
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = "#ffffff"
              ;(e.currentTarget as HTMLButtonElement).style.color = "#000000"
              const children = e.currentTarget.querySelectorAll("[data-invert]")
              children.forEach(c => ((c as HTMLElement).style.color = "#000000"))
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.18)"
              const children = e.currentTarget.querySelectorAll("[data-invert]")
              children.forEach(c => ((c as HTMLElement).style.color = ""))
            }}
          >
            <div data-invert style={{ fontSize: "30px", color: "rgba(255,255,255,0.50)", lineHeight: 1 }}>↑</div>
            <div>
              <div data-invert style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.50)", marginBottom: "3px" }}>
                Przyjście
              </div>
              <div data-invert style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", color: "rgba(255,255,255,0.25)" }}>
                Rejestruj wejście
              </div>
            </div>
          </button>

          {/* WYJŚCIE */}
          <button
            onClick={() => handleActionClick("leave")}
            style={{
              height: "148px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "14px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "all 0.15s",
              textAlign: "left",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.60)"
              const children = e.currentTarget.querySelectorAll("[data-wyjscie]")
              children.forEach(c => ((c as HTMLElement).style.color = "#ffffff"))
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"
              const children = e.currentTarget.querySelectorAll("[data-wyjscie]")
              children.forEach(c => ((c as HTMLElement).style.color = ""))
            }}
          >
            <div data-wyjscie style={{ fontSize: "30px", color: "rgba(255,255,255,0.40)", lineHeight: 1 }}>↓</div>
            <div>
              <div data-wyjscie style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.40)", marginBottom: "3px" }}>
                Wyjście
              </div>
              <div data-wyjscie style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", color: "rgba(255,255,255,0.25)" }}>
                Rejestruj wyjście
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  return null
}
