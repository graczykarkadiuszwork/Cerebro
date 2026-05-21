"use client"

import { useState, useEffect } from "react"

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTimeSlot(ts: number) {
  return Math.floor(ts / 60000)
}

// Deterministic fake hex token matching EmployeeApp mock
function mockToken(slot: number): string {
  const base = ((slot * 2654435761) >>> 0).toString(16).padStart(8, "0")
  const ext = ((slot * 1234567891 + 987654321) >>> 0).toString(16).padStart(8, "0")
  return (base + ext).substring(0, 16).toUpperCase()
}

function formatTokenTablet(hex: string): string {
  // "A3F9 · 2E1C · 87B4 · F312"
  return hex.match(/.{1,4}/g)?.join(" · ") || hex
}

function pad2(n: number) {
  return n.toString().padStart(2, "0")
}

function formatClock(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function formatDateFull(d: Date) {
  const days = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"]
  const months = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"]
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

const gridBg = {
  backgroundImage: `
    repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.04) 39px, rgba(255,255,255,0.04) 40px),
    repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.04) 39px, rgba(255,255,255,0.04) 40px)
  `,
}

export default function TabletApp() {
  const [now, setNow] = useState(new Date())
  const [secsLeft, setSecsLeft] = useState(60)
  const [token, setToken] = useState("")
  const [prevToken, setPrevToken] = useState("")
  const [tokenProgress, setTokenProgress] = useState(100)

  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setNow(n)
      const slot = getTimeSlot(n.getTime())
      const secsIn = Math.floor((n.getTime() % 60000) / 1000)
      const left = 60 - secsIn

      setSecsLeft(left)
      setTokenProgress((left / 60) * 100)

      const t = mockToken(slot)
      const prev = mockToken(slot - 1)
      setToken(t)
      setPrevToken(prev)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const barFill = secsLeft < 12 ? "rgba(255,255,255,0.5)" : "#ffffff"

  return (
    <div style={{
      ...gridBg,
      minHeight: "600px",
      background: "#000",
      display: "flex",
      flexDirection: "column",
      padding: "32px 48px 36px",
    }}>
      {/* Top status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px", color: "rgba(255,255,255,0.20)" }}>◈</span>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
              We SMILE · Warszawa
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "7px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.12)", marginTop: "2px" }}>
              Klinika stomatologiczna · System RCP v3
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "32px", fontWeight: 700, letterSpacing: "-1px", color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
            {formatClock(now)}
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", marginTop: "2px" }}>
            {formatDateFull(now)}
          </div>
        </div>
      </div>

      {/* Separator */}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", marginBottom: "48px" }} />

      {/* Token display — main element */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.30em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)", marginBottom: "20px" }}>
          HMAC-SHA256 · Token wejściowy
        </div>

        {/* Giant token */}
        <div style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "clamp(52px, 7vw, 88px)",
          fontWeight: 700,
          letterSpacing: "0.10em",
          color: "#ffffff",
          textAlign: "center",
          lineHeight: 1,
          marginBottom: "32px",
          fontVariantNumeric: "tabular-nums",
        }}>
          {formatTokenTablet(token)}
        </div>

        {/* Progress bar */}
        <div style={{ width: "100%", maxWidth: "600px", marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "8px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.20)", textTransform: "uppercase" }}>
              Ważność tokenu
            </div>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              color: secsLeft < 12 ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.35)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.10em",
              transition: "color 0.3s",
            }}>
              {secsLeft}s
            </div>
          </div>
          <div style={{ height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{
              height: "3px",
              background: barFill,
              width: `${tokenProgress}%`,
              transition: "width 1s linear, background 0.3s",
              borderRadius: "2px",
            }} />
          </div>
        </div>

        {/* Instruction */}
        <div style={{
          marginTop: "20px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "14px 24px",
          fontFamily: "'Space Mono', monospace",
          fontSize: "11px",
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.25)",
          textAlign: "center",
        }}>
          Otwórz aplikację na telefonie · Wpisz pierwsze 4 znaki tokenu · Zarejestruj obecność
        </div>
      </div>

      {/* Bottom info */}
      <div style={{ marginTop: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "7px", letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.10)", marginBottom: "4px" }}>
            Poprzedni token
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.10em", color: "rgba(255,255,255,0.12)" }}>
            {formatTokenTablet(prevToken)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "7px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.10)", textTransform: "uppercase" }}>
            Okno weryfikacji ±1 · SHA-256 · RODO Art. 32
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "7px", letterSpacing: "0.15em", color: "rgba(255,255,255,0.08)", marginTop: "3px" }}>
            Art. 149 Kodeksu Pracy · Ewidencja Czasu Pracy
          </div>
        </div>
      </div>
    </div>
  )
}
