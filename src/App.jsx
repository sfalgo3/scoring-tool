import { useState, useMemo } from "react";

// ── SCORING FRAMEWORK ──────────────────────────────────────────────────────────
// Weight total = 100 points
const CRITERIA = [
  {
    id: "liability",
    label: "Statutory Liability Strength",
    weight: 25,
    description: "Clarity that referral program satisfies all three § 25A-37 elements; availability of controlling NC authority; absence of threshold legal hurdles (goods brief, preemption, choice-of-law).",
    scoringGuide: [
      { range: "9–10", desc: "All three elements facially satisfied; no threshold brief required; controlling NC authority favorable." },
      { range: "7–8", desc: "Strong liability but one threshold issue (e.g., goods-component brief) must be cleared before filing." },
      { range: "5–6", desc: "Viable claim but meaningful legal uncertainty or choice-of-law risk." },
      { range: "3–4", desc: "Significant threshold hurdle (e.g., adverse damages cap; conflicting authority)." },
      { range: "1–2", desc: "Speculative; major doctrinal obstacles." },
    ],
  },
  {
    id: "claimants",
    label: "NC Claimant Universe Size",
    weight: 20,
    description: "Estimated number of eligible NC residential consumers within the 3-year § 1-52(1) lookback period.",
    scoringGuide: [
      { range: "9–10", desc: ">1 million NC accounts." },
      { range: "7–8", desc: "250K–1 million NC accounts." },
      { range: "5–6", desc: "50K–250K NC accounts." },
      { range: "3–4", desc: "10K–50K NC accounts." },
      { range: "1–2", desc: "<10K NC accounts." },
    ],
  },
  {
    id: "perClaimant",
    label: "Per-Claimant Recovery Value",
    weight: 15,
    description: "Expected gross rescission/recovery per claimant under the statute (all consideration paid, tender of goods), before contingency fee. Baseline is aggregate contract payments within lookback period.",
    scoringGuide: [
      { range: "9–10", desc: ">$5,000 per claimant (premium services; long-term contracts)." },
      { range: "7–8", desc: "$2,000–$5,000 per claimant." },
      { range: "5–6", desc: "$800–$2,000 per claimant." },
      { range: "3–4", desc: "$300–$800 per claimant." },
      { range: "1–2", desc: "<$300 per claimant." },
    ],
  },
  {
    id: "arbProcedure",
    label: "Arbitration / Procedural Favorability",
    weight: 15,
    description: "Quality of arbitration clause from plaintiff's perspective: administrator (AAA vs. unknown), who pays fees, venue, mass arbitration mechanics, $$ minimum award provisions, pre-notice period length.",
    scoringGuide: [
      { range: "9–10", desc: "AAA/FAA; defendant pays all fees; $10K+ minimum award; claimant-county venue; accepts mass filings." },
      { range: "7–8", desc: "AAA/FAA; defendant pays fees <$75K; clean venue; standard mass arb rules." },
      { range: "5–6", desc: "AAA/FAA; each party pays own fees; no minimum award; manageable venue." },
      { range: "3–4", desc: "Non-AAA administrator or adverse venue; procedural obstacles." },
      { range: "1–2", desc: "Litigation required (no arb clause) or highly unfavorable arbitration terms." },
    ],
  },
  {
    id: "solvency",
    label: "Defendant Solvency & Collectibility",
    weight: 10,
    description: "Likelihood defendant can satisfy a mass arbitration/judgment. Public company, large revenue, investment-grade credit, or deep-pocket parent all favor collectibility.",
    scoringGuide: [
      { range: "9–10", desc: "S&P 500 / Fortune 500 public company; investment-grade; $1B+ annual revenue." },
      { range: "7–8", desc: "Large private or mid-cap public company; clearly solvent; substantial assets." },
      { range: "5–6", desc: "Solvent but more modest balance sheet; regional or specialty company." },
      { range: "3–4", desc: "Privately held; limited financial transparency; uncertain liquidity." },
      { range: "1–2", desc: "Financially distressed; insolvency risk; limited collectibility." },
    ],
  },
  {
    id: "classVsArb",
    label: "Class Action vs. Mass Arbitration Feasibility",
    weight: 8,
    description: "Whether the dispute is best pursued as a class action (no arb clause, or clause fails AAA registry) or mass arbitration. Class action opens Rule 23 leverage and injunctive relief; mass arb opens per-claimant fee pressure.",
    scoringGuide: [
      { range: "9–10", desc: "No valid arb clause or AAA registry failure → class action available; maximum leverage." },
      { range: "7–8", desc: "Mass arb with favorable economics (defendant pays fees; high per-claimant value)." },
      { range: "5–6", desc: "Mass arb with neutral economics (each party pays own fees; moderate per-claimant value)." },
      { range: "3–4", desc: "Mass arb with defendant-favorable terms; high procedural friction." },
      { range: "1–2", desc: "Forced individual arbitration in unfavorable forum; no class leverage." },
    ],
  },
  {
    id: "diligenceBurden",
    label: "Intake & Diligence Burden (Inverse)",
    weight: 4,
    description: "Ease of intake screening, client identification, and pre-filing diligence. High score = low burden. Scored inversely: clean intake with no screening complexity scores highest.",
    scoringGuide: [
      { range: "9–10", desc: "Single contract type; all accounts eligible; no dealer/sub-entity screening required." },
      { range: "7–8", desc: "Minor screening (e.g., within-3-year date check); no complex sub-entity issues." },
      { range: "5–6", desc: "Moderate burden: equipment purchase vs. lease screening; geographic eligibility check." },
      { range: "3–4", desc: "Heavy screening: dealer vs. direct accounts; prior settlement exclusions; corporate family questions." },
      { range: "1–2", desc: "Extreme complexity: foreign sub-entity law; individual inducement proof required; massive screening burden." },
    ],
  },
  {
    id: "settlementPressure",
    label: "Settlement Pressure on Defendant",
    weight: 3,
    description: "Reputational, regulatory, and financial pressure points that make defendant want to settle early. Consumer-facing brand, regulatory oversight, and public company disclosure obligations all increase pressure.",
    scoringGuide: [
      { range: "9–10", desc: "High-profile consumer brand; SEC disclosure obligations; active state regulatory oversight; reputational vulnerability." },
      { range: "7–8", desc: "Known consumer brand; some regulatory exposure; moderate press sensitivity." },
      { range: "5–6", desc: "B2C but lower profile; limited regulatory pressure." },
      { range: "3–4", desc: "Mostly B2B or low-profile brand; limited reputational leverage." },
      { range: "1–2", desc: "No reputational leverage; private entity with no public profile." },
    ],
  },
];

// ── TARGET DATA ────────────────────────────────────────────────────────────────
const INITIAL_TARGETS = [
  {
    id: 1,
    name: "CPI Security Systems",
    category: "Security",
    notes: "Charlotte-based; AAA/FAA/NC law; no damages cap; no threshold brief required; cleanest vehicle in portfolio.",
    scores: { liability: 10, claimants: 5, perClaimant: 6, arbProcedure: 10, solvency: 7, classVsArb: 7, diligenceBurden: 9, settlementPressure: 6 },
  },
  {
    id: 2,
    name: "ADT Security Services",
    category: "Security",
    notes: "ADT pays all AAA fees; $500 contractual cap and 1-year limitation clause require preemption brief; 40–50% dealer account screening burden.",
    scores: { liability: 9, claimants: 6, perClaimant: 5, arbProcedure: 7, solvency: 9, classVsArb: 7, diligenceBurden: 4, settlementPressure: 8 },
  },
  {
    id: 3,
    name: "AT&T Fiber (BellSouth)",
    category: "Telecom",
    notes: "Best arb terms of any target: AT&T pays all AAA fees <$75K; $10K minimum award if claimant wins; double attorneys' fees; 60-day pre-notice required; goods brief gates intake.",
    scores: { liability: 8, claimants: 6, perClaimant: 9, arbProcedure: 10, solvency: 10, classVsArb: 8, diligenceBurden: 6, settlementPressure: 9 },
  },
  {
    id: 4,
    name: "Spectrum (Charter Communications)",
    category: "Telecom",
    notes: "Largest NC subscriber base (~1.4M–2.0M); Manhattan venue clause requires challenge; each party pays own AAA fees; goods brief required.",
    scores: { liability: 8, claimants: 10, perClaimant: 5, arbProcedure: 6, solvency: 9, classVsArb: 5, diligenceBurden: 6, settlementPressure: 8 },
  },
  {
    id: 5,
    name: "Xfinity (Comcast)",
    category: "Telecom",
    notes: "Comcast pays all AAA fees <$75K; clean venue; 30-day pre-notice; goods brief required; 900K–1.4M NC accounts.",
    scores: { liability: 8, claimants: 8, perClaimant: 5, arbProcedure: 8, solvency: 10, classVsArb: 7, diligenceBurden: 6, settlementPressure: 9 },
  },
  {
    id: 6,
    name: "Vivint Smart Home",
    category: "Security",
    notes: "Strong liability; 60-month contracts = highest per-claimant contract value; BUT: ASI arbitration (not AAA), FAA excluded/Utah law governs, $2K damages cap — do not file without ASI review and Utah law opinion.",
    scores: { liability: 9, claimants: 5, perClaimant: 7, arbProcedure: 4, solvency: 7, classVsArb: 3, diligenceBurden: 5, settlementPressure: 6 },
  },
  {
    id: 7,
    name: "Brinks Home Security",
    category: "Security",
    notes: "Referral program confirmed active. Smaller NC footprint than ADT/CPI. AAA/FAA clause. Monitoring + equipment sale structure mirrors CPI/ADT liability theory.",
    scores: { liability: 8, claimants: 4, perClaimant: 5, arbProcedure: 7, solvency: 7, classVsArb: 7, diligenceBurden: 7, settlementPressure: 6 },
  },
  {
    id: 8,
    name: "Security Finance Corp.",
    category: "Finance/Installment",
    notes: "Possible § 25A-37 extension to personal installment loan + referral; threshold brief needed on whether loan is 'sale of services'; smaller per-claimant value; regional footprint.",
    scores: { liability: 5, claimants: 4, perClaimant: 3, arbProcedure: 5, solvency: 6, classVsArb: 5, diligenceBurden: 6, settlementPressure: 4 },
  },
  {
    id: 9,
    name: "Ring (Amazon) Home Security",
    category: "Security",
    notes: "Amazon subsidiary; large NC user base; referral program pays Amazon gift cards contingent on new subscriber activation. Equipment (cameras, doorbells) clearly constitutes tangible goods. AAA consumer arbitration. High brand/reputational sensitivity.",
    scores: { liability: 8, claimants: 7, perClaimant: 4, arbProcedure: 7, solvency: 10, classVsArb: 7, diligenceBurden: 7, settlementPressure: 9 },
  },
  {
    id: 10,
    name: "SimpliSafe Home Security",
    category: "Security",
    notes: "Direct-to-consumer model; equipment purchased outright by customer (clean goods argument); referral rewards paid via Amazon gift card contingent on new subscription. AAA consumer rules. Mid-size NC footprint; strong goods basis.",
    scores: { liability: 9, claimants: 4, perClaimant: 5, arbProcedure: 7, solvency: 7, classVsArb: 7, diligenceBurden: 8, settlementPressure: 6 },
  },
  {
    id: 11,
    name: "T-Mobile Home Internet",
    category: "Telecom",
    notes: "Fixed wireless internet; provides physical gateway device (purchased or leased); referral rewards paid as statement credits contingent on activation. FAA/AAA. Large NC fixed wireless footprint growing rapidly.",
    scores: { liability: 7, claimants: 7, perClaimant: 4, arbProcedure: 7, solvency: 10, classVsArb: 7, diligenceBurden: 6, settlementPressure: 8 },
  },
  {
    id: 12,
    name: "Verizon Fios / Home Internet",
    category: "Telecom",
    notes: "Limited NC Fios footprint (minimal fiber build-out in NC); Verizon 5G Home Internet growing. Referral rewards paid as prepaid cards contingent on activation. Goods argument requires brief. Smaller NC universe than Spectrum/Comcast.",
    scores: { liability: 7, claimants: 4, perClaimant: 5, arbProcedure: 7, solvency: 10, classVsArb: 7, diligenceBurden: 6, settlementPressure: 8 },
  },
];

// ── HELPERS ────────────────────────────────────────────────────────────────────
function calcWeightedScore(scores) {
  return CRITERIA.reduce((sum, c) => sum + (scores[c.id] || 0) * (c.weight / 10), 0);
}

function getRankColor(rank) {
  if (rank === 1) return "#FFD700";
  if (rank === 2) return "#C0C0C0";
  if (rank === 3) return "#CD7F32";
  return "#4A5568";
}

function getScoreColor(score) {
  if (score >= 8) return "#10B981";
  if (score >= 6) return "#F59E0B";
  if (score >= 4) return "#F97316";
  return "#EF4444";
}

function ScoreBar({ score, max = 10 }) {
  const pct = (score / max) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: "#2D3748", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: getScoreColor(score), borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontFamily: "monospace", fontSize: 12, color: getScoreColor(score), minWidth: 18, textAlign: "right" }}>{score}</span>
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function App() {
  const [targets, setTargets] = useState(INITIAL_TARGETS);
  const [weights, setWeights] = useState(Object.fromEntries(CRITERIA.map(c => [c.id, c.weight])));
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [activeTab, setActiveTab] = useState("rankings"); // rankings | criteria | edit
  const [editingTarget, setEditingTarget] = useState(null);
  const [showWeightEditor, setShowWeightEditor] = useState(false);

  const totalWeight = useMemo(() => Object.values(weights).reduce((a, b) => a + b, 0), [weights]);

  const rankedTargets = useMemo(() => {
    return [...targets]
      .map(t => ({
        ...t,
        weightedScore: CRITERIA.reduce((sum, c) => sum + (t.scores[c.id] || 0) * (weights[c.id] / 10), 0),
        rawScore: calcWeightedScore(t.scores),
      }))
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .map((t, i) => ({ ...t, rank: i + 1 }));
  }, [targets, weights]);

  const selectedRanked = selectedTarget ? rankedTargets.find(t => t.id === selectedTarget) : null;

  function updateWeight(id, val) {
    setWeights(w => ({ ...w, [id]: Math.max(0, Math.min(40, Number(val))) }));
  }

  function updateScore(targetId, criterionId, val) {
    setTargets(ts => ts.map(t => t.id === targetId
      ? { ...t, scores: { ...t.scores, [criterionId]: Math.max(1, Math.min(10, Number(val))) } }
      : t));
  }

  const categoryColors = { Security: "#7C3AED", Telecom: "#0EA5E9", "Finance/Installment": "#10B981" };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0E1A",
      color: "#E2E8F0",
      fontFamily: "'Georgia', serif",
      padding: "0 0 60px",
    }}>
      {/* HEADER */}
      <div style={{
        background: "linear-gradient(135deg, #0F1729 0%, #1A2240 100%)",
        borderBottom: "1px solid #1E2D4A",
        padding: "28px 32px 20px",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, color: "#4A7FA5", textTransform: "uppercase", marginBottom: 6, fontFamily: "monospace" }}>
                PLAINTIFF CLASS ACTION INTELLIGENCE TOOL
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#E8F4FD", letterSpacing: -0.5 }}>
                § 25A-37 Target Scoring Matrix
              </h1>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                N.C.G.S. § 25A-37 Referral Sales Act · North Carolina · 3-Year Lookback
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {totalWeight !== 100 && (
                <div style={{ background: "#7F1D1D", border: "1px solid #EF4444", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#FCA5A5" }}>
                  ⚠ Weights sum to {totalWeight} (should be 100)
                </div>
              )}
              <button
                onClick={() => setShowWeightEditor(!showWeightEditor)}
                style={{
                  background: showWeightEditor ? "#1E3A5F" : "#152238",
                  border: "1px solid #2D4A6A",
                  borderRadius: 6, color: "#7EB3D4", fontSize: 12,
                  padding: "6px 14px", cursor: "pointer", fontFamily: "Georgia, serif",
                }}
              >
                {showWeightEditor ? "▲ Close Weights" : "⚙ Adjust Weights"}
              </button>
            </div>
          </div>

          {/* WEIGHT EDITOR */}
          {showWeightEditor && (
            <div style={{
              marginTop: 16, padding: 16,
              background: "#0D1829", borderRadius: 8, border: "1px solid #1E2D4A",
            }}>
              <div style={{ fontSize: 11, color: "#4A7FA5", letterSpacing: 2, marginBottom: 12, fontFamily: "monospace" }}>
                WEIGHT EDITOR — TOTAL MUST EQUAL 100
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                {CRITERIA.map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, fontSize: 12, color: "#94A3B8" }}>{c.label}</div>
                    <input
                      type="number" min={0} max={40} value={weights[c.id]}
                      onChange={e => updateWeight(c.id, e.target.value)}
                      style={{
                        width: 52, padding: "3px 6px", background: "#152238",
                        border: "1px solid #2D4A6A", borderRadius: 4,
                        color: "#E2E8F0", fontSize: 13, textAlign: "center",
                        fontFamily: "monospace",
                      }}
                    />
                    <span style={{ fontSize: 11, color: "#4A7FA5" }}>pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TABS */}
          <div style={{ display: "flex", gap: 4, marginTop: 16 }}>
            {[
              { id: "rankings", label: "▦ Rankings" },
              { id: "criteria", label: "⊞ Scoring Criteria" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: "6px 16px", borderRadius: "6px 6px 0 0",
                background: activeTab === tab.id ? "#1A2F4A" : "transparent",
                border: activeTab === tab.id ? "1px solid #2D4A6A" : "1px solid transparent",
                borderBottom: activeTab === tab.id ? "1px solid #1A2F4A" : "1px solid #1E2D4A",
                color: activeTab === tab.id ? "#7EB3D4" : "#4A6280",
                fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif",
              }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>

        {/* ── TAB: RANKINGS ── */}
        {activeTab === "rankings" && (
          <div style={{ display: "grid", gridTemplateColumns: selectedTarget ? "1fr 380px" : "1fr", gap: 20, transition: "all 0.3s" }}>

            {/* LEFT: RANKED LIST */}
            <div>
              <div style={{ fontSize: 11, color: "#4A7FA5", letterSpacing: 3, marginBottom: 14, fontFamily: "monospace" }}>
                RANKED BY WEIGHTED FEE-RECOVERY POTENTIAL · {rankedTargets.length} TARGETS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rankedTargets.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTarget(selectedTarget === t.id ? null : t.id)}
                    style={{
                      background: selectedTarget === t.id ? "#132135" : "#0F1829",
                      border: selectedTarget === t.id ? "1px solid #2D5A8A" : "1px solid #1A2740",
                      borderRadius: 10, padding: "14px 18px", cursor: "pointer",
                      transition: "all 0.2s",
                      borderLeft: `4px solid ${getRankColor(t.rank)}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      {/* Rank */}
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: `${getRankColor(t.rank)}22`,
                        border: `2px solid ${getRankColor(t.rank)}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700, color: getRankColor(t.rank),
                        flexShrink: 0,
                      }}>
                        {t.rank}
                      </div>

                      {/* Name + Category */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0" }}>{t.name}</span>
                          <span style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 20,
                            background: `${categoryColors[t.category]}22`,
                            border: `1px solid ${categoryColors[t.category]}55`,
                            color: categoryColors[t.category], letterSpacing: 1,
                            fontFamily: "monospace",
                          }}>
                            {t.category.toUpperCase()}
                          </span>
                        </div>
                        {/* Mini score bars */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px 12px", marginTop: 8 }}>
                          {CRITERIA.slice(0, 4).map(c => (
                            <div key={c.id}>
                              <div style={{ fontSize: 9, color: "#4A6280", marginBottom: 2, fontFamily: "monospace", letterSpacing: 0.5 }}>
                                {c.label.split(" ").slice(0, 2).join(" ").toUpperCase().slice(0, 10)}
                              </div>
                              <ScoreBar score={t.scores[c.id]} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Total Score */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{
                          fontSize: 28, fontWeight: 700,
                          color: t.weightedScore >= 65 ? "#10B981" : t.weightedScore >= 50 ? "#F59E0B" : "#EF4444",
                          lineHeight: 1,
                        }}>
                          {t.weightedScore.toFixed(1)}
                        </div>
                        <div style={{ fontSize: 10, color: "#4A6280", fontFamily: "monospace" }}>/ 100 pts</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: DETAIL PANEL */}
            {selectedRanked && (
              <div style={{
                background: "#0F1829", border: "1px solid #1E3050",
                borderRadius: 12, padding: 20, height: "fit-content",
                position: "sticky", top: 140,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#4A7FA5", letterSpacing: 2, fontFamily: "monospace" }}>TARGET DETAIL</div>
                    <h3 style={{ margin: "4px 0 0", fontSize: 17, color: "#E8F4FD" }}>{selectedRanked.name}</h3>
                  </div>
                  <button onClick={() => setSelectedTarget(null)} style={{
                    background: "none", border: "none", color: "#4A6280",
                    fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1,
                  }}>✕</button>
                </div>

                <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.6, marginBottom: 16, padding: "10px 12px", background: "#0A1220", borderRadius: 6 }}>
                  {selectedRanked.notes}
                </div>

                {/* Score breakdown */}
                <div style={{ fontSize: 10, color: "#4A7FA5", letterSpacing: 2, fontFamily: "monospace", marginBottom: 10 }}>
                  CRITERION BREAKDOWN
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {CRITERIA.map(c => {
                    const rawScore = selectedRanked.scores[c.id];
                    const contribution = rawScore * (weights[c.id] / 10);
                    return (
                      <div key={c.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: "#94A3B8" }}>{c.label}</span>
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#4A7FA5" }}>
                            {rawScore}/10 × {weights[c.id]}% = <span style={{ color: getScoreColor(rawScore) }}>{contribution.toFixed(1)}</span>
                          </span>
                        </div>
                        <ScoreBar score={rawScore} />
                      </div>
                    );
                  })}
                </div>

                <div style={{
                  marginTop: 16, padding: "10px 14px",
                  background: "#0A1220", borderRadius: 8,
                  border: "1px solid #1E3050",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "monospace" }}>WEIGHTED TOTAL</span>
                  <span style={{
                    fontSize: 24, fontWeight: 700,
                    color: selectedRanked.weightedScore >= 65 ? "#10B981" : selectedRanked.weightedScore >= 50 ? "#F59E0B" : "#EF4444",
                  }}>
                    {selectedRanked.weightedScore.toFixed(1)}<span style={{ fontSize: 13, color: "#4A6280" }}>/100</span>
                  </span>
                </div>

                {/* Edit scores */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10, color: "#4A7FA5", letterSpacing: 2, fontFamily: "monospace", marginBottom: 8 }}>
                    ADJUST SCORES
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {CRITERIA.map(c => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "#64748B", flex: 1 }}>{c.label.split(" ").slice(0, 2).join(" ")}</span>
                        <input
                          type="number" min={1} max={10}
                          value={selectedRanked.scores[c.id]}
                          onChange={e => updateScore(selectedRanked.id, c.id, e.target.value)}
                          style={{
                            width: 40, padding: "2px 4px", background: "#152238",
                            border: "1px solid #2D4A6A", borderRadius: 4,
                            color: "#E2E8F0", fontSize: 12, textAlign: "center",
                            fontFamily: "monospace",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: SCORING CRITERIA ── */}
        {activeTab === "criteria" && (
          <div>
            <div style={{ fontSize: 11, color: "#4A7FA5", letterSpacing: 3, marginBottom: 20, fontFamily: "monospace" }}>
              WEIGHTED SCORING FRAMEWORK — 8 CRITERIA · 100 TOTAL POINTS
            </div>

            {/* Summary bar */}
            <div style={{ display: "flex", marginBottom: 24, background: "#0F1829", borderRadius: 10, overflow: "hidden", border: "1px solid #1A2740" }}>
              {CRITERIA.map((c, i) => (
                <div key={c.id} style={{
                  flex: weights[c.id], padding: "10px 8px", textAlign: "center",
                  background: i % 2 === 0 ? "#0F1829" : "#111E35",
                  borderRight: i < CRITERIA.length - 1 ? "1px solid #1A2740" : "none",
                  minWidth: 0,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#4A9FD4" }}>{weights[c.id]}</div>
                  <div style={{ fontSize: 9, color: "#4A6280", fontFamily: "monospace", letterSpacing: 0.5 }}>pts</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: 16 }}>
              {CRITERIA.map((c, idx) => (
                <div key={c.id} style={{
                  background: "#0F1829", border: "1px solid #1A2740",
                  borderRadius: 10, padding: 18,
                  borderTop: `3px solid ${["#10B981","#0EA5E9","#7C3AED","#F59E0B","#EF4444","#EC4899","#14B8A6","#F97316"][idx]}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 14, color: "#E2E8F0", fontWeight: 600, lineHeight: 1.3 }}>{c.label}</h3>
                    <div style={{
                      background: "#1A2F4A", borderRadius: 20,
                      padding: "3px 12px", fontSize: 13, fontWeight: 700,
                      color: "#4A9FD4", fontFamily: "monospace", flexShrink: 0, marginLeft: 12,
                    }}>
                      {weights[c.id]} pts
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 12px", lineHeight: 1.6 }}>{c.description}</p>
                  <div style={{ borderTop: "1px solid #1A2740", paddingTop: 10 }}>
                    <div style={{ fontSize: 10, color: "#4A7FA5", letterSpacing: 2, fontFamily: "monospace", marginBottom: 8 }}>SCORING GUIDE</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {c.scoringGuide.map(g => (
                        <div key={g.range} style={{ display: "flex", gap: 10 }}>
                          <span style={{
                            fontFamily: "monospace", fontSize: 11,
                            color: g.range.startsWith("9") ? "#10B981" : g.range.startsWith("7") ? "#F59E0B" : g.range.startsWith("5") ? "#F97316" : "#EF4444",
                            minWidth: 36, flexShrink: 0,
                          }}>{g.range}</span>
                          <span style={{ fontSize: 11, color: "#64748B", lineHeight: 1.4 }}>{g.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
