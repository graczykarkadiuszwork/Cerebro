"use client"

import { useState } from "react"
import EmployeeApp from "@/components/EmployeeApp"
import TabletApp from "@/components/TabletApp"

export default function Home() {
  const [view, setView] = useState<"phone" | "tablet">("phone")

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "24px 16px" }}>
      {/* View switcher */}
      <div style={{
        display: "flex",
        gap: "8px",
        marginBottom: "24px",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "10px",
        padding: "4px",
        background: "rgba(255,255,255,0.03)"
      }}>
        <button
          onClick={() => setView("phone")}
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "8px 20px",
            borderRadius: "7px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s",
            background: view === "phone" ? "#ffffff" : "transparent",
            color: view === "phone" ? "#000000" : "rgba(255,255,255,0.40)",
          }}
        >
          Telefon
        </button>
        <button
          onClick={() => setView("tablet")}
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "8px 20px",
            borderRadius: "7px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s",
            background: view === "tablet" ? "#ffffff" : "transparent",
            color: view === "tablet" ? "#000000" : "rgba(255,255,255,0.40)",
          }}
        >
          Tablet
        </button>
      </div>

      <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "8px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "20px" }}>
        RCP v3 · Podgląd UI · We SMILE · Warszawa
      </div>

      {view === "phone" ? (
        <div style={{
          width: "390px",
          maxWidth: "100%",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "40px",
          overflow: "hidden",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
          minHeight: "844px",
          position: "relative",
          background: "#000"
        }}>
          <EmployeeApp />
        </div>
      ) : (
        <div style={{
          width: "100%",
          maxWidth: "960px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "16px",
          overflow: "hidden",
          minHeight: "600px",
          position: "relative",
          background: "#000"
        }}>
          <TabletApp />
        </div>
      )}
    </div>
  )
}
