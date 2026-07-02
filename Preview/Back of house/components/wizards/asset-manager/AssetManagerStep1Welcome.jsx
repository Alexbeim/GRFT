import React, { useState, useRef, useCallback } from "react";

/**
 * Asset Manager — Step 1: Welcome.
 * Hero intro, project timeline, "what we'll cover" checklist, and collaborator invites.
 * Fully standalone: no dependency on the other 7 steps or a surrounding wizard shell.
 * Drop this in wherever step 1 of the client asset-onboarding flow needs to live.
 */

const FONT_MONO = "var(--gp-font-mono, 'Space Mono', 'Courier New', monospace)";
const FONT_BODY = "var(--gp-font-body, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const FONT_DISPLAY = "var(--gp-font-display, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const YELLOW = "#FEBD17";
const INK = "#0A0B0C";
const HAIRLINE = "var(--gp-hairline-light, rgba(10,11,12,0.12))";
const MUTED = "#9A9A96";
const BODY_TXT = "#33333A";

const DEFAULT_MILESTONES = [
  { date: "May 20", label: "Briefing", sub: "Kickoff with your GRFT+ producer", state: "done" },
  { date: "Jun 01", label: "Build your assets", sub: "Logos, colors, cans, overlay — right here", state: "active" },
  { date: "Jun 06", label: "Final changes deadline", sub: "Locks at 5 PM — no changes after this", state: "deadline" },
  { date: "Jun 07", label: "Approve & lock", sub: "Assets freeze and flow to production", state: "todo" },
  { date: "Jun 08–12", label: "Production & QA", sub: "We build and test your wall", state: "todo" },
  { date: "Jun 14", label: "Event day", sub: "On-site setup and live wall", state: "todo" },
  { date: "Jun 16", label: "Recap delivery", sub: "Edited photos + 60s recap within 48h", state: "todo" },
];

const MILESTONE_COLORS = {
  done: { dot: "#16744B", subColor: "#6B6B70" },
  active: { dot: "#FEBD17", subColor: "#33333A" },
  deadline: { dot: "#C7402F", subColor: "#C7402F" },
  todo: { dot: "#ffffff", subColor: "#6B6B70" },
};

const COVERAGE_STEPS = [
  { idx: 2, n: "02", label: "Logo upload", desc: "Drop your logos, we check them" },
  { idx: 3, n: "03", label: "Colors", desc: "Your exact brand palette" },
  { idx: 4, n: "04", label: "Spray can label", desc: "Design the cans guests paint with" },
  { idx: 5, n: "05", label: "Stencils, stickers & backgrounds", desc: "Pick, upload, or generate" },
  { idx: 6, n: "06", label: "Wall overlay", desc: "Your logo on the live 4K wall" },
  { idx: 7, n: "07", label: "Test drive", desc: "Try it all before launch" },
  { idx: 8, n: "08", label: "Approve & lock", desc: "Freeze it and you're set" },
];

const DEFAULT_COLLABORATORS = [
  { name: "Dana Whitfield", email: "dana@stanleyparkbrewing.com", role: "Owner", pending: false },
  { name: "Marketing team", email: "marketing@stanleyparkbrewing.com", role: "Editor", pending: true },
];

function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const flash = useCallback((msg) => {
    setToast(msg);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 1900);
  }, []);
  return [toast, flash];
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 50, background: INK, color: "#F4F4F2", borderRadius: 4, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.28)" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: YELLOW, display: "inline-block", flex: "none" }} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", color: "#F4F4F2" }}>{message}</span>
    </div>
  );
}

function AskConey({ onAsk }) {
  return (
    <div onClick={onAsk} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: INK, borderRadius: 20, padding: "9px 16px", cursor: "pointer", boxShadow: "0 6px 16px rgba(0,0,0,0.18)" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: YELLOW, display: "inline-block" }} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#F4F4F2" }}>Ask Coney</span>
    </div>
  );
}

function StepFooter({ stepNumber, totalSteps, completed, onToggleComplete, onBack, onNext, nextLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${HAIRLINE}`, marginTop: 32, paddingTop: 20 }}>
      <span
        onClick={onBack}
        style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: onBack ? "#6B6B70" : "#c2bfb6", cursor: onBack ? "pointer" : "default" }}
      >
        ← Back
      </span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>
        Step {String(stepNumber).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          onClick={onToggleComplete}
          style={{
            border: `1px solid ${completed ? "#16744B" : INK}`, color: completed ? "#16744B" : INK,
            borderRadius: 2, padding: "11px 18px", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.08em",
            textTransform: "uppercase", fontWeight: completed ? 700 : 400, cursor: "pointer",
          }}
        >
          {completed ? "✓ Completed" : "Mark complete"}
        </span>
        <span onClick={onNext} style={{ background: YELLOW, color: INK, borderRadius: 2, padding: "12px 22px", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>
          {nextLabel || "Continue →"}
        </span>
      </div>
    </div>
  );
}

export function AssetManagerStep1Welcome({
  eventLabel = "the Brewery Launch Party",
  eventDate = "Jun 14, 2026",
  milestones = DEFAULT_MILESTONES,
  completedSteps = [],
  initialCollaborators = DEFAULT_COLLABORATORS,
  onChange,
  onInvite,
  onNavigateToStep,
  completed = false,
  onToggleComplete,
  onBack,
  onNext,
  stepNumber = 1,
  totalSteps = 8,
  showAssistant = true,
  onAskConey,
}) {
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Editor");
  const [toast, flash] = useToast();

  const invite = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      flash("Enter a valid email to invite");
      return;
    }
    const next = [...collaborators, { name: trimmed.split("@")[0], email: trimmed, role, pending: true }];
    setCollaborators(next);
    onChange?.(next);
    onInvite?.(trimmed, role);
    setEmail("");
    flash(`Invite sent to ${trimmed}`);
  };

  const askConey = () => { onAskConey ? onAskConey() : flash("Coney is a demo — no chat yet"); };

  const coverageItems = COVERAGE_STEPS.map((s) => ({ ...s, done: completedSteps.includes(s.idx) }));

  return (
    <div style={{ fontFamily: FONT_BODY, position: "relative", maxWidth: 760 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B07A00", marginBottom: 10, display: "flex", alignItems: "center", gap: "0.6em" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: YELLOW, display: "inline-block" }} />
        Step 01 · First time here
      </div>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 38, letterSpacing: "-0.02em", color: INK, margin: "0 0 16px", maxWidth: "20ch" }}>
        Welcome. Let's build your wall.
      </h2>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: BODY_TXT, margin: "0 0 14px", maxWidth: "64ch" }}>
        You're setting up the interactive graffiti wall for {eventLabel}. Everything your guests will paint with — your logo, your colors, your spray cans, your stencils — gets built right here, by you.
      </p>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: BODY_TXT, margin: "0 0 26px", maxWidth: "64ch" }}>
        Every step saves automatically, so you can stop any time and pick up right where you left off. Eight steps, in order. Nothing goes live until you approve it at the end, and you can jump back to any step before then. No design software, no back-and-forth — what you build is what lands on the wall.
      </p>

      <div style={{ maxWidth: 660, marginBottom: 26 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>Project timeline</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: "#6B6B70", marginBottom: 18 }}>
          Set from your event date — <span style={{ color: INK, fontWeight: 600 }}>{eventDate}</span>. Changes lock automatically before the event, so the earlier you build, the more time to refine.
        </div>
        {milestones.map((m, i) => {
          const c = MILESTONE_COLORS[m.state] || MILESTONE_COLORS.todo;
          return (
            <div key={i} style={{ display: "flex", gap: 16 }}>
              <div style={{ width: 84, flex: "none", textAlign: "right", fontFamily: FONT_MONO, fontSize: 12, color: INK, paddingTop: 1 }}>{m.date}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", paddingTop: 3 }}>
                <span style={{ width: 13, height: 13, borderRadius: "50%", background: c.dot, boxShadow: `0 0 0 1px ${c.dot}`, flex: "none" }} />
                {i < milestones.length - 1 && <span style={{ width: 2, flex: 1, background: HAIRLINE, minHeight: 20 }} />}
              </div>
              <div style={{ paddingBottom: 16 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em", color: INK }}>{m.label}</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.45, color: c.subColor }}>{m.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED, marginBottom: 12 }}>What we'll cover</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: HAIRLINE, border: `1px solid ${HAIRLINE}`, borderRadius: 2, maxWidth: 660, marginBottom: 26 }}>
        {coverageItems.map((item) => (
          <div
            key={item.idx}
            onClick={() => onNavigateToStep?.(item.idx)}
            style={{ background: "#fff", padding: "15px 18px", display: "flex", gap: 14, cursor: onNavigateToStep ? "pointer" : "default", alignItems: "flex-start" }}
          >
            {item.done ? (
              <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: "#16744B", flex: "none", marginTop: 1 }}>✓</span>
            ) : (
              <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: "#B07A00", flex: "none" }}>{item.n}</span>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: INK, marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.45, color: "#6B6B70" }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 660, marginBottom: 26 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>Invite collaborators</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: "#6B6B70", marginBottom: 14 }}>
          Working with a teammate? Delegate any step — invite them by email and they can build alongside you.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") invite(); }}
            placeholder="name@company.com"
            style={{ flex: 1, minWidth: 200, height: 42, border: `1px solid ${HAIRLINE}`, borderRadius: 2, background: "#fff", padding: "0 12px", fontFamily: FONT_MONO, fontSize: 13, color: INK }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ height: 42, border: `1px solid ${HAIRLINE}`, borderRadius: 2, background: "#FAF9F6", padding: "0 13px", fontFamily: FONT_MONO, fontSize: 11, color: INK, cursor: "pointer" }}
          >
            <option>Editor</option>
            <option>Viewer</option>
          </select>
          <div onClick={invite} style={{ height: 42, background: INK, color: "#fff", borderRadius: 2, display: "flex", alignItems: "center", padding: "0 20px", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>
            Invite
          </div>
        </div>
        {collaborators.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, borderTop: `1px solid ${HAIRLINE}`, padding: "11px 0" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#ECEAE4", flex: "none" }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, display: "block" }}>{c.name}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED }}>{c.email}</span>
            </span>
            {c.pending && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "#B07A00", background: "#FEF1CE", borderRadius: 2, padding: "4px 8px" }}>Pending</span>
            )}
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6B6B70" }}>{c.role}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, maxWidth: 660, background: "#FAF9F6", border: `1px solid ${HAIRLINE}`, borderRadius: 2, padding: "14px 16px" }}>
        <span style={{ width: 42, height: 42, borderRadius: "50%", background: INK, flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: YELLOW }} />
        </span>
        <span style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: BODY_TXT }}>
          Stuck on anything, ask Coney in the corner. Hit <span style={{ fontWeight: 700 }}>Continue</span> when you're ready.
        </span>
      </div>

      {showAssistant && (
        <div style={{ position: "fixed", right: 24, bottom: 90, zIndex: 5 }}>
          <AskConey onAsk={askConey} />
        </div>
      )}

      <StepFooter
        stepNumber={stepNumber}
        totalSteps={totalSteps}
        completed={completed}
        onToggleComplete={onToggleComplete}
        onBack={onBack}
        onNext={onNext}
      />
      <Toast message={toast} />
    </div>
  );
}

export default AssetManagerStep1Welcome;
