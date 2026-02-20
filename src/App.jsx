import { useState, useMemo, useEffect, useRef } from "react";

const CRITERIA = [
  {
    id: "liability", label: "Statutory Liability Strength", weight: 25, emoji: "⚖️", shortLabel: "Liability",
    researchTip: "Pull the referral program T&C page. Confirm: (1) existing NC residential customer gets paid, (2) payment is contingent on new customer signing a contract, (3) no obvious legal hurdles like a damages cap or choice-of-law problem.",
    sourceLabel: "Referral Program URL", sourcePlaceholder: "https://company.com/refer-a-friend",
    scoringGuide: [
      { range: "9–10", color: "#10B981", desc: "All 3 elements crystal clear on face of program terms. No threshold brief needed. Controlling NC authority." },
      { range: "7–8",  color: "#84CC16", desc: "Strong claim but one brief required (e.g., goods-component) before filing." },
      { range: "5–6",  color: "#F59E0B", desc: "Viable but meaningful legal uncertainty or adverse choice-of-law risk." },
      { range: "3–4",  color: "#F97316", desc: "Significant hurdle — damages cap, conflicting authority, or complex threshold issue." },
      { range: "1–2",  color: "#EF4444", desc: "Speculative. Major doctrinal obstacles." },
    ],
  },
  {
    id: "claimants", label: "NC Claimant Universe", weight: 20, emoji: "👥", shortLabel: "Claimants",
    researchTip: "Find NC-specific customer count. Check the company's 10-K or earnings calls for regional breakdowns. Rule of thumb: NC ≈ 3% of national US customers. Search '[Company] annual report' or '[Company] 10-K SEC filing'.",
    sourceLabel: "Source (10-K, earnings call, etc.)", sourcePlaceholder: "e.g., 2024 Annual Report p. 14",
    scoringGuide: [
      { range: "9–10", color: "#10B981", desc: "Over 1 million NC residential accounts." },
      { range: "7–8",  color: "#84CC16", desc: "250,000 – 1 million NC accounts." },
      { range: "5–6",  color: "#F59E0B", desc: "50,000 – 250,000 NC accounts." },
      { range: "3–4",  color: "#F97316", desc: "10,000 – 50,000 NC accounts." },
      { range: "1–2",  color: "#EF4444", desc: "Under 10,000 NC accounts." },
    ],
  },
  {
    id: "perClaimant", label: "Per-Claimant Recovery Value", weight: 15, emoji: "💰", shortLabel: "Per-Claimant $",
    researchTip: "Find the average monthly bill on their pricing page. Multiply by typical contract length (12, 24, or 36 months). Example: $95/mo × 30 months = $2,850. Check if there's a contractual damages cap that would compress this.",
    sourceLabel: "Pricing Page URL", sourcePlaceholder: "https://company.com/pricing",
    scoringGuide: [
      { range: "9–10", color: "#10B981", desc: "Over $5,000 per claimant (premium service + long contracts)." },
      { range: "7–8",  color: "#84CC16", desc: "$2,000 – $5,000 per claimant." },
      { range: "5–6",  color: "#F59E0B", desc: "$800 – $2,000 per claimant." },
      { range: "3–4",  color: "#F97316", desc: "$300 – $800 per claimant." },
      { range: "1–2",  color: "#EF4444", desc: "Under $300 per claimant." },
    ],
  },
  {
    id: "arbProcedure", label: "Arbitration Favorability", weight: 15, emoji: "🏛️", shortLabel: "Arb Terms",
    researchTip: "Find the customer agreement under 'Legal' or 'Terms of Service' on their website. Key questions: Is it AAA? Who pays fees? Is venue in NC? Any minimum award or fee-shifting? Also verify registration at adr.org Consumer Clause Registry.",
    sourceLabel: "Customer Agreement / TOS URL", sourcePlaceholder: "https://company.com/legal/terms",
    scoringGuide: [
      { range: "9–10", color: "#10B981", desc: "AAA/FAA; defendant pays ALL fees; $10K+ minimum award; NC venue; accepts mass filings." },
      { range: "7–8",  color: "#84CC16", desc: "AAA/FAA; defendant pays fees under $75K; clean NC venue; no unusual obstacles." },
      { range: "5–6",  color: "#F59E0B", desc: "AAA/FAA; each party pays own fees; no minimum award; manageable venue." },
      { range: "3–4",  color: "#F97316", desc: "Non-AAA administrator or adverse out-of-state venue." },
      { range: "1–2",  color: "#EF4444", desc: "Litigation required or highly unfavorable arbitration terms." },
    ],
  },
  {
    id: "solvency", label: "Defendant Solvency", weight: 10, emoji: "🏦", shortLabel: "Solvency",
    researchTip: "Is it publicly traded? Check NYSE/NASDAQ. S&P 500 or Fortune 500 = 9–10. Large private with known revenue = 7–8. Smaller or uncertain = lower. Search recent news for any restructuring or financial distress.",
    sourceLabel: "Company / Ticker Info", sourcePlaceholder: "e.g., NASDAQ: CHTR — Charter Communications",
    scoringGuide: [
      { range: "9–10", color: "#10B981", desc: "S&P 500 / Fortune 500. Investment-grade. $1B+ annual revenue." },
      { range: "7–8",  color: "#84CC16", desc: "Large private or mid-cap public. Clearly solvent. Substantial assets." },
      { range: "5–6",  color: "#F59E0B", desc: "Solvent but modest balance sheet. Regional or specialty company." },
      { range: "3–4",  color: "#F97316", desc: "Private with limited transparency. Uncertain liquidity." },
      { range: "1–2",  color: "#EF4444", desc: "Financially distressed. Insolvency or bankruptcy risk." },
    ],
  },
  {
    id: "classVsArb", label: "Class / Mass Arb Leverage", weight: 8, emoji: "⚡", shortLabel: "Leverage",
    researchTip: "Check adr.org Consumer Clause Registry. If the clause is NOT registered, class action may be available — maximum leverage. Otherwise assess: does defendant pay AAA fees? Is per-claimant value high enough to generate real mass-arb pressure?",
    sourceLabel: "AAA Registry Check / Notes", sourcePlaceholder: "e.g., Registered ✓ verified adr.org 2/2026",
    scoringGuide: [
      { range: "9–10", color: "#10B981", desc: "No valid arb clause or AAA registry failure → class action available. Maximum leverage." },
      { range: "7–8",  color: "#84CC16", desc: "Mass arb with favorable economics — defendant pays fees, high per-claimant value." },
      { range: "5–6",  color: "#F59E0B", desc: "Mass arb with neutral economics — each party pays own fees." },
      { range: "3–4",  color: "#F97316", desc: "Mass arb with defendant-favorable terms or high procedural friction." },
      { range: "1–2",  color: "#EF4444", desc: "Forced individual arbitration in unfavorable forum. No class leverage." },
    ],
  },
  {
    id: "diligenceBurden", label: "Intake Ease (higher = easier)", weight: 4, emoji: "📋", shortLabel: "Intake Ease",
    researchTip: "How complex is screening claimants? Simple = one contract type, all NC residential accounts eligible, easy date check. Complex = dealer vs. direct accounts, prior settlement exclusions, geographic eligibility issues. Score HIGHER for EASIER intake.",
    sourceLabel: "Notes on Complexity", sourcePlaceholder: "e.g., Direct-only contracts, no dealer accounts",
    scoringGuide: [
      { range: "9–10", color: "#10B981", desc: "One contract type. All accounts eligible. Simple 3-year date check only." },
      { range: "7–8",  color: "#84CC16", desc: "Minor screening needed (equipment purchase vs. lease; geography check)." },
      { range: "5–6",  color: "#F59E0B", desc: "Moderate: equipment or sub-entity filtering required." },
      { range: "3–4",  color: "#F97316", desc: "Heavy: dealer vs. direct accounts; prior settlement exclusions." },
      { range: "1–2",  color: "#EF4444", desc: "Extreme complexity. Individual proof or massive screening burden." },
    ],
  },
  {
    id: "settlementPressure", label: "Settlement Pressure", weight: 3, emoji: "🎯", shortLabel: "Pressure",
    researchTip: "Is this a well-known consumer brand? Publicly traded with SEC disclosure obligations? Regulated by the NC Utilities Commission or similar? High brand visibility and regulatory oversight creates strong early-settlement incentive.",
    sourceLabel: "Brand / Regulatory Notes", sourcePlaceholder: "e.g., NYSE-listed, NCUC regulated, high consumer brand",
    scoringGuide: [
      { range: "9–10", color: "#10B981", desc: "High-profile consumer brand. SEC reporting. Active state regulatory oversight." },
      { range: "7–8",  color: "#84CC16", desc: "Known consumer brand. Some regulatory exposure. Moderate press sensitivity." },
      { range: "5–6",  color: "#F59E0B", desc: "B2C but lower profile. Limited regulatory pressure." },
      { range: "3–4",  color: "#F97316", desc: "Mostly B2B or low-profile. Limited reputational leverage." },
      { range: "1–2",  color: "#EF4444", desc: "No reputational leverage. Private with no public profile." },
    ],
  },
];

const INITIAL_TARGETS = [
  { id: 1,  name: "CPI Security Systems",    category: "Security",  notes: "Charlotte-based; AAA/FAA/NC law; no damages cap; no threshold brief required; cleanest vehicle in portfolio.",                                                                         sources: {}, scores: { liability:10, claimants:5, perClaimant:6, arbProcedure:10, solvency:7,  classVsArb:7, diligenceBurden:9, settlementPressure:6 } },
  { id: 2,  name: "ADT Security Services",   category: "Security",  notes: "ADT pays all AAA fees; $500 contractual cap and 1-year limitation clause require preemption brief; 40–50% dealer account screening burden.",                                             sources: {}, scores: { liability:9,  claimants:6, perClaimant:5, arbProcedure:7,  solvency:9,  classVsArb:7, diligenceBurden:4, settlementPressure:8 } },
  { id: 3,  name: "AT&T Fiber (BellSouth)",  category: "Telecom",   notes: "Best arb terms: pays all AAA fees <$75K; $10K min award if claimant wins; double attorneys' fees; 60-day pre-notice; goods brief gates intake.",                                        sources: {}, scores: { liability:8,  claimants:6, perClaimant:9, arbProcedure:10, solvency:10, classVsArb:8, diligenceBurden:6, settlementPressure:9 } },
  { id: 4,  name: "Spectrum (Charter)",      category: "Telecom",   notes: "Largest NC subscriber base (~1.4M–2.0M); Manhattan venue clause requires challenge; each party pays own AAA fees; goods brief required.",                                                 sources: {}, scores: { liability:8,  claimants:10,perClaimant:5, arbProcedure:6,  solvency:9,  classVsArb:5, diligenceBurden:6, settlementPressure:8 } },
  { id: 5,  name: "Xfinity (Comcast)",       category: "Telecom",   notes: "Comcast pays all AAA fees <$75K; clean NC venue; 30-day pre-notice; goods brief required; 900K–1.4M NC accounts.",                                                                        sources: {}, scores: { liability:8,  claimants:8, perClaimant:5, arbProcedure:8,  solvency:10, classVsArb:7, diligenceBurden:6, settlementPressure:9 } },
  { id: 6,  name: "Vivint Smart Home",       category: "Security",  notes: "Strong liability; 60-month contracts; BUT ASI arbitration (not AAA), FAA excluded, Utah law governs, $2K damages cap — do not file without ASI review and Utah law opinion.",              sources: {}, scores: { liability:9,  claimants:5, perClaimant:7, arbProcedure:4,  solvency:7,  classVsArb:3, diligenceBurden:5, settlementPressure:6 } },
  { id: 7,  name: "Brinks Home Security",    category: "Security",  notes: "Active referral program. Smaller NC footprint. AAA/FAA. Monitoring + equipment sale mirrors CPI/ADT theory.",                                                                             sources: {}, scores: { liability:8,  claimants:4, perClaimant:5, arbProcedure:7,  solvency:7,  classVsArb:7, diligenceBurden:7, settlementPressure:6 } },
  { id: 8,  name: "Ring (Amazon)",           category: "Security",  notes: "Amazon parent = 10/10 solvency; equipment purchased outright (clean goods argument); gift card referral rewards contingent on activation; extreme brand sensitivity.",                      sources: {}, scores: { liability:8,  claimants:7, perClaimant:4, arbProcedure:7,  solvency:10, classVsArb:7, diligenceBurden:7, settlementPressure:9 } },
  { id: 9,  name: "SimpliSafe",              category: "Security",  notes: "Direct-to-consumer; equipment purchased outright (clean goods); referral pays Amazon gift card contingent on subscription. AAA. Mid-size NC footprint.",                                   sources: {}, scores: { liability:9,  claimants:4, perClaimant:5, arbProcedure:7,  solvency:7,  classVsArb:7, diligenceBurden:8, settlementPressure:6 } },
  { id: 10, name: "T-Mobile Home Internet",  category: "Telecom",   notes: "Fixed wireless; physical gateway device; referral rewards as statement credits contingent on activation. FAA/AAA. Large and growing NC footprint.",                                         sources: {}, scores: { liability:7,  claimants:7, perClaimant:4, arbProcedure:7,  solvency:10, classVsArb:7, diligenceBurden:6, settlementPressure:8 } },
  { id: 11, name: "Verizon Home Internet",   category: "Telecom",   notes: "Limited NC Fios footprint; 5G Home Internet growing. Referral rewards as prepaid cards. Goods brief required. Smaller NC universe.",                                                       sources: {}, scores: { liability:7,  claimants:4, perClaimant:5, arbProcedure:7,  solvency:10, classVsArb:7, diligenceBurden:6, settlementPressure:8 } },
  { id: 12, name: "Security Finance Corp.",  category: "Finance",   notes: "Possible § 25A-37 extension to personal installment loan + referral; threshold brief needed; smaller per-claimant value; regional footprint.",                                             sources: {}, scores: { liability:5,  claimants:4, perClaimant:3, arbProcedure:5,  solvency:6,  classVsArb:5, diligenceBurden:6, settlementPressure:4 } },
];

const STORAGE_KEY = "nc25a37_targets_v3";
const CATEGORIES = ["Security","Telecom","Finance","Retail","Insurance","Healthcare","Utilities","Other"];
const CAT_COLORS = { Security:"#7C3AED", Telecom:"#0EA5E9", Finance:"#10B981", Retail:"#F59E0B", Insurance:"#EC4899", Healthcare:"#14B8A6", Utilities:"#60A5FA", Other:"#64748B" };

function scoreColor(s) {
  if (s === "" || s === null || s === undefined) return "#3A4A5A";
  const n = Number(s);
  if (n >= 8) return "#10B981";
  if (n >= 6) return "#84CC16";
  if (n >= 4) return "#F59E0B";
  return "#EF4444";
}
function rankColor(r) {
  if (r === 1) return "#FFD700";
  if (r === 2) return "#C0C0C0";
  if (r === 3) return "#CD7F32";
  return "#3A5070";
}
function hasVal(v) { return v !== "" && v !== null && v !== undefined; }

function ScoreBar({ score }) {
  const ok = hasVal(score);
  const n = ok ? Number(score) : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
      <div style={{ flex:1, height:5, background:"#1A2740", borderRadius:3, overflow:"hidden" }}>
        {ok && <div style={{ width:`${n*10}%`, height:"100%", background:scoreColor(n), borderRadius:3 }} />}
      </div>
      <span style={{ fontFamily:"monospace", fontSize:10, color:ok?scoreColor(n):"#2A3A4A", minWidth:16, textAlign:"right" }}>{ok?n:"—"}</span>
    </div>
  );
}

function Tooltip({ children, content }) {
  const [vis, setVis] = useState(false);
  return (
    <span style={{ position:"relative", display:"inline-block" }}
      onMouseEnter={()=>setVis(true)} onMouseLeave={()=>setVis(false)}>
      {children}
      {vis && (
        <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:"50%", transform:"translateX(-50%)", zIndex:9999, background:"#0A1020", border:"1px solid #2A4060", borderRadius:8, padding:"12px 14px", width:310, boxShadow:"0 8px 32px rgba(0,0,0,.7)", pointerEvents:"none" }}>
          {content}
          <div style={{ position:"absolute", bottom:-6, left:"50%", transform:"translateX(-50%)", width:10, height:6 }}>
            <div style={{ width:8, height:8, background:"#0A1020", border:"1px solid #2A4060", transform:"rotate(45deg)", marginTop:-5, marginLeft:1 }} />
          </div>
        </div>
      )}
    </span>
  );
}

function GuideTooltip({ c }) {
  return (
    <Tooltip content={
      <div>
        <div style={{ fontSize:10, color:"#3A7AAA", letterSpacing:1.5, fontFamily:"monospace", marginBottom:8 }}>SCORING GUIDE</div>
        {c.scoringGuide.map(g=>(
          <div key={g.range} style={{ display:"flex", gap:8, marginBottom:5 }}>
            <span style={{ fontFamily:"monospace", fontSize:11, color:g.color, minWidth:32, flexShrink:0 }}>{g.range}</span>
            <span style={{ fontSize:11, color:"#7A9AB8", lineHeight:1.4 }}>{g.desc}</span>
          </div>
        ))}
        <div style={{ marginTop:10, paddingTop:8, borderTop:"1px solid #1A2D47" }}>
          <div style={{ fontSize:9, color:"#2A5A7A", letterSpacing:1.5, fontFamily:"monospace", marginBottom:4 }}>HOW TO RESEARCH</div>
          <div style={{ fontSize:11, color:"#4A5A6A", lineHeight:1.5 }}>{c.researchTip}</div>
        </div>
      </div>
    }>
      <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:15, height:15, borderRadius:"50%", background:"#1A2D47", border:"1px solid #2A4A6A", color:"#4A9FD4", fontSize:9, cursor:"help", fontFamily:"monospace" }}>?</span>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [targets, setTargets] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : INITIAL_TARGETS; } catch { return INITIAL_TARGETS; }
  });
  const [weights]   = useState(Object.fromEntries(CRITERIA.map(c=>[c.id,c.weight])));
  const [activeTab, setActiveTab] = useState("rankings");
  const [selId, setSelId] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [flash, setFlash] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [wt, setWt] = useState({...weights});

  // ── form state ──
  const blank = { name:"", category:"Security", notes:"", scores:Object.fromEntries(CRITERIA.map(c=>[c.id,""])), sources:Object.fromEntries(CRITERIA.map(c=>[c.id,""])) };
  const [form, setForm]       = useState(blank);
  const [formStep, setFormStep] = useState(0);
  const [formErr, setFormErr]  = useState({});

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(targets)); } catch {} }, [targets]);

  const ranked = useMemo(() => {
    return [...targets].map(t => {
      const weighted = CRITERIA.reduce((sum,c) => {
        const s = t.scores[c.id]; if (!hasVal(s)) return sum;
        return sum + Number(s)*(wt[c.id]/10);
      }, 0);
      const ct = CRITERIA.filter(c=>hasVal(t.scores[c.id])).length;
      return {...t, weighted, scoredCount:ct};
    }).sort((a,b)=>b.weighted-a.weighted).map((t,i)=>({...t,rank:i+1}));
  }, [targets, wt]);

  const sel = selId ? ranked.find(t=>t.id===selId) : null;

  function saveTarget() {
    if (!form.name.trim()) { setFormErr({name:"Company name is required."}); return; }
    const t = {
      id: Date.now(), name:form.name.trim(), category:form.category, notes:form.notes.trim(),
      scores: Object.fromEntries(CRITERIA.map(c=>[c.id, form.scores[c.id]===""?"":Number(form.scores[c.id])])),
      sources: {...form.sources},
    };
    setTargets(ts=>[...ts,t]);
    setForm(blank); setFormStep(0); setFormErr({});
    setFlash(true); setTimeout(()=>setFlash(false),2500);
    setActiveTab("rankings"); setSelId(t.id);
  }

  function deleteTarget(id) { setTargets(ts=>ts.filter(t=>t.id!==id)); if (selId===id) setSelId(null); setDelConfirm(null); }
  function updateScore(tid,cid,val) {
    const v = val===""?"":Math.max(1,Math.min(10,Number(val)));
    setTargets(ts=>ts.map(t=>t.id===tid?{...t,scores:{...t.scores,[cid]:v}}:t));
  }

  const totalWt = Object.values(wt).reduce((a,b)=>a+b,0);

  // ─────────────── RENDER ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#07090F", color:"#D8E8F4", fontFamily:"Georgia,serif", paddingBottom:80 }}>

      {/* ── HEADER ── */}
      <div style={{ background:"linear-gradient(160deg,#09101E 0%,#0D1830 100%)", borderBottom:"1px solid #141F35", padding:"18px 22px 0", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ maxWidth:1180, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:9, letterSpacing:3, color:"#2A5A7A", fontFamily:"monospace", marginBottom:3 }}>PLAINTIFF CLASS ACTION · NC § 25A-37</div>
              <h1 style={{ margin:0, fontSize:19, color:"#C8E0F4", letterSpacing:-0.3 }}>Target Scoring Matrix</h1>
            </div>
            <div style={{ display:"flex", gap:7, alignItems:"center", flexWrap:"wrap" }}>
              {flash && <div style={{ background:"#052E16", border:"1px solid #10B981", borderRadius:6, padding:"3px 12px", fontSize:11, color:"#10B981" }}>✓ Target added!</div>}
              {totalWt!==100 && <div style={{ background:"#3B0A0A", border:"1px solid #EF4444", borderRadius:6, padding:"3px 10px", fontSize:10, color:"#FCA5A5" }}>⚠ Weights = {totalWt}</div>}
              <button onClick={()=>setShowWeights(v=>!v)} style={{ background:"#0D1525", border:"1px solid #1A2D47", borderRadius:6, color:"#3A6A8A", fontSize:11, padding:"4px 11px", cursor:"pointer" }}>
                {showWeights?"▲ Weights":"⚙ Weights"}
              </button>
              <button onClick={()=>{ if(window.confirm("Reset to default targets?")){ setTargets(INITIAL_TARGETS); setSelId(null); }}} style={{ background:"#0D1525", border:"1px solid #1A2D47", borderRadius:6, color:"#2A3A4A", fontSize:11, padding:"4px 11px", cursor:"pointer" }}>Reset</button>
            </div>
          </div>

          {/* weight editor */}
          {showWeights && (
            <div style={{ background:"#07090F", border:"1px solid #141F35", borderRadius:8, padding:"12px 16px", marginBottom:12 }}>
              <div style={{ fontSize:9, color:"#2A5A7A", letterSpacing:2, fontFamily:"monospace", marginBottom:8 }}>ADJUST WEIGHTS — MUST SUM TO 100</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:7 }}>
                {CRITERIA.map(c=>(
                  <div key={c.id} style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <span style={{ flex:1, fontSize:10, color:"#4A6070" }}>{c.emoji} {c.label}</span>
                    <input type="number" min={0} max={40} value={wt[c.id]}
                      onChange={e=>setWt(w=>({...w,[c.id]:Math.max(0,Math.min(40,Number(e.target.value)))}))}
                      style={{ width:40, padding:"2px 4px", background:"#0A1120", border:"1px solid #1E2D3F", borderRadius:4, color:"#D8E8F4", fontSize:12, textAlign:"center", fontFamily:"monospace" }} />
                    <span style={{ fontSize:9, color:"#2A4A5A" }}>pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* tabs */}
          <div style={{ display:"flex", gap:2 }}>
            {[{id:"rankings",label:"Rankings"},{id:"add",label:"＋ Add Target"},{id:"guide",label:"Scoring Guide"}].map(tab=>(
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
                padding:"6px 18px", background:activeTab===tab.id?"#0A1526":"transparent",
                border:"1px solid", borderColor:activeTab===tab.id?"#1E3558":"transparent",
                borderBottom:activeTab===tab.id?"1px solid #0A1526":"1px solid #141F35",
                borderRadius:"6px 6px 0 0", color:activeTab===tab.id?"#6AAED4":"#2A4A5A",
                fontSize:12, cursor:"pointer", fontWeight:tab.id==="add"?600:400,
              }}>{tab.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1180, margin:"0 auto", padding:"18px 22px" }}>

        {/* ════════════════════════════════════════════════════════════════════
            RANKINGS TAB
            ════════════════════════════════════════════════════════════════════ */}
        {activeTab==="rankings" && (
          <div style={{ display:"grid", gridTemplateColumns:sel?"1fr 350px":"1fr", gap:16 }}>

            <div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontSize:9, color:"#2A5A7A", letterSpacing:2, fontFamily:"monospace" }}>{ranked.length} TARGETS · RANKED BY WEIGHTED FEE-RECOVERY POTENTIAL</div>
                <div style={{ fontSize:9, color:"#1E3048", fontFamily:"monospace" }}>Click any row to inspect</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {ranked.map(t=>(
                  <div key={t.id} onClick={()=>setSelId(selId===t.id?null:t.id)} style={{
                    background:selId===t.id?"#0A1526":"#090D1A",
                    border:`1px solid ${selId===t.id?"#1E3558":"#101828"}`,
                    borderLeft:`4px solid ${rankColor(t.rank)}`,
                    borderRadius:9, padding:"11px 15px", cursor:"pointer", transition:"all .15s",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:11, flexWrap:"wrap" }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", background:`${rankColor(t.rank)}18`, border:`2px solid ${rankColor(t.rank)}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:rankColor(t.rank), flexShrink:0 }}>
                        {t.rank}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:6 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:"#C8E0F4" }}>{t.name}</span>
                          <span style={{ fontSize:9, padding:"1px 7px", borderRadius:20, background:`${CAT_COLORS[t.category]||"#64748B"}18`, border:`1px solid ${CAT_COLORS[t.category]||"#64748B"}44`, color:CAT_COLORS[t.category]||"#64748B", letterSpacing:1, fontFamily:"monospace" }}>{t.category}</span>
                          {t.scoredCount<CRITERIA.length && <span style={{ fontSize:9, color:"#2A3848", fontFamily:"monospace" }}>{t.scoredCount}/{CRITERIA.length} scored</span>}
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"2px 8px" }}>
                          {CRITERIA.slice(0,4).map(c=>(
                            <div key={c.id}>
                              <div style={{ fontSize:8, color:"#2A4058", marginBottom:2, fontFamily:"monospace" }}>{c.shortLabel.slice(0,8).toUpperCase()}</div>
                              <ScoreBar score={t.scores[c.id]} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:24, fontWeight:700, lineHeight:1, color:t.weighted>=60?"#10B981":t.weighted>=45?"#F59E0B":"#EF4444" }}>{t.weighted.toFixed(1)}</div>
                        <div style={{ fontSize:8, color:"#2A4058", fontFamily:"monospace" }}>/ 100 pts</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* detail panel */}
            {sel && (
              <div style={{ background:"#090D1A", border:"1px solid #141F35", borderRadius:12, padding:16, height:"fit-content", position:"sticky", top:130 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:8, color:"#2A5A7A", letterSpacing:2, fontFamily:"monospace" }}>TARGET DETAIL</div>
                    <h3 style={{ margin:"3px 0 0", fontSize:15, color:"#C8E0F4" }}>{sel.name}</h3>
                  </div>
                  <div style={{ display:"flex", gap:5 }}>
                    {delConfirm===sel.id ? (
                      <>
                        <button onClick={()=>deleteTarget(sel.id)} style={{ background:"#3B0A0A", border:"1px solid #EF4444", borderRadius:5, color:"#FCA5A5", fontSize:10, padding:"3px 8px", cursor:"pointer" }}>Confirm Delete</button>
                        <button onClick={()=>setDelConfirm(null)} style={{ background:"#090D1A", border:"1px solid #1A2D3F", borderRadius:5, color:"#4A6A7A", fontSize:10, padding:"3px 7px", cursor:"pointer" }}>Cancel</button>
                      </>
                    ) : (
                      <button onClick={()=>setDelConfirm(sel.id)} style={{ background:"none", border:"none", color:"#2A3848", fontSize:13, cursor:"pointer" }} title="Delete">🗑</button>
                    )}
                    <button onClick={()=>setSelId(null)} style={{ background:"none", border:"none", color:"#2A3848", fontSize:15, cursor:"pointer" }}>✕</button>
                  </div>
                </div>

                {sel.notes && <div style={{ fontSize:11, color:"#5A7A96", lineHeight:1.6, marginBottom:12, padding:"7px 9px", background:"#05080F", borderRadius:6, borderLeft:"3px solid #1A3A5A" }}>{sel.notes}</div>}

                <div style={{ fontSize:8, color:"#2A5A7A", letterSpacing:2, fontFamily:"monospace", marginBottom:7 }}>CRITERION SCORES — CLICK TO EDIT</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {CRITERIA.map(c=>{
                    const s = sel.scores[c.id];
                    const ok = hasVal(s);
                    const contrib = ok ? Number(s)*(wt[c.id]/10) : null;
                    return (
                      <div key={c.id}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:10, color:"#5A7A8A" }}>{c.emoji} {c.label}</span>
                          <span style={{ fontSize:9, fontFamily:"monospace", color:"#2A4A5A" }}>
                            {ok ? <><span style={{ color:scoreColor(Number(s)) }}>{s}</span>/10×{wt[c.id]}%=<span style={{ color:scoreColor(Number(s)) }}>{contrib.toFixed(1)}</span></> : <span style={{ color:"#1E2D3A" }}>unscored</span>}
                          </span>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <div style={{ flex:1, height:5, background:"#141F35", borderRadius:3, overflow:"hidden" }}>
                            {ok && <div style={{ width:`${Number(s)*10}%`, height:"100%", background:scoreColor(Number(s)), borderRadius:3 }} />}
                          </div>
                          <input type="number" min={1} max={10} value={s===""?"":s} placeholder="—"
                            onChange={e=>updateScore(sel.id,c.id,e.target.value===""?"":e.target.value)}
                            style={{ width:34, padding:"1px 3px", background:"#07090F", border:"1px solid #1A2D3F", borderRadius:4, color:"#D8E8F4", fontSize:10, textAlign:"center", fontFamily:"monospace" }} />
                        </div>
                        {sel.sources?.[c.id] && <div style={{ fontSize:9, color:"#1E3A4A", marginTop:2, fontFamily:"monospace" }}>📎 {sel.sources[c.id]}</div>}
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop:12, padding:"8px 12px", background:"#05080F", borderRadius:7, border:"1px solid #141F35", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:10, color:"#2A4A5A", fontFamily:"monospace" }}>WEIGHTED TOTAL</span>
                  <span style={{ fontSize:20, fontWeight:700, color:sel.weighted>=60?"#10B981":sel.weighted>=45?"#F59E0B":"#EF4444" }}>
                    {sel.weighted.toFixed(1)}<span style={{ fontSize:11, color:"#2A4058" }}>/100</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ADD TARGET TAB
            ════════════════════════════════════════════════════════════════════ */}
        {activeTab==="add" && (
          <div style={{ maxWidth:740 }}>
            <div style={{ fontSize:9, color:"#2A5A7A", letterSpacing:2, fontFamily:"monospace", marginBottom:16 }}>
              ADD NEW TARGET · ALL SCORE FIELDS ARE OPTIONAL — LEAVE BLANK IF UNKNOWN
            </div>

            {/* step tabs */}
            <div style={{ display:"flex", marginBottom:22 }}>
              {["1 · Basic Info","2 · Score It"].map((lbl,i)=>(
                <div key={i} onClick={()=>{ if(i===1&&!form.name.trim()) return; setFormStep(i); }} style={{
                  flex:1, padding:"9px 14px", textAlign:"center", cursor:i===0||form.name.trim()?"pointer":"not-allowed",
                  background:formStep===i?"#0A1526":"#07090F",
                  border:"1px solid", borderColor:formStep===i?"#1E3558":"#101828",
                  borderBottom:formStep===i?"1px solid #0A1526":"1px solid #101828",
                  borderRadius:i===0?"8px 0 0 8px":"0 8px 8px 0",
                  fontSize:11, color:formStep===i?"#6AAED4":"#2A4A5A", fontFamily:"monospace", letterSpacing:1,
                }}>{lbl}</div>
              ))}
            </div>

            {/* STEP 1 */}
            {formStep===0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={{ display:"block", fontSize:10, color:"#3A6A8A", marginBottom:5, fontFamily:"monospace", letterSpacing:1 }}>COMPANY NAME *</label>
                  <input value={form.name} onChange={e=>{ setForm(f=>({...f,name:e.target.value})); setFormErr({}); }}
                    placeholder="e.g., Frontpoint Home Security"
                    style={{ width:"100%", padding:"9px 13px", background:"#090D1A", border:`1px solid ${formErr.name?"#EF4444":"#1A2D3F"}`, borderRadius:7, color:"#D8E8F4", fontSize:14, boxSizing:"border-box", outline:"none" }} />
                  {formErr.name && <div style={{ fontSize:10, color:"#EF4444", marginTop:3 }}>{formErr.name}</div>}
                </div>

                <div>
                  <label style={{ display:"block", fontSize:10, color:"#3A6A8A", marginBottom:5, fontFamily:"monospace", letterSpacing:1 }}>CATEGORY</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                    {CATEGORIES.map(cat=>(
                      <button key={cat} onClick={()=>setForm(f=>({...f,category:cat}))} style={{
                        padding:"5px 14px", borderRadius:20, fontSize:11, cursor:"pointer",
                        background:form.category===cat?`${CAT_COLORS[cat]||"#64748B"}20`:"#090D1A",
                        border:`1px solid ${form.category===cat?CAT_COLORS[cat]||"#64748B":"#1A2D3F"}`,
                        color:form.category===cat?CAT_COLORS[cat]||"#64748B":"#2A3A4A",
                      }}>{cat}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display:"block", fontSize:10, color:"#3A6A8A", marginBottom:5, fontFamily:"monospace", letterSpacing:1 }}>
                    NOTES / INITIAL IMPRESSIONS <span style={{ color:"#1E3048" }}>(optional)</span>
                  </label>
                  <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                    placeholder="Describe the referral program, known legal issues, contract structure, any red flags or advantages..."
                    rows={3}
                    style={{ width:"100%", padding:"9px 13px", background:"#090D1A", border:"1px solid #1A2D3F", borderRadius:7, color:"#D8E8F4", fontSize:12, resize:"vertical", boxSizing:"border-box", outline:"none", lineHeight:1.6 }} />
                </div>

                <div style={{ padding:13, background:"#07090F", borderRadius:8, border:"1px solid #101828" }}>
                  <div style={{ fontSize:9, color:"#2A5A7A", letterSpacing:1.5, fontFamily:"monospace", marginBottom:9 }}>KEY SOURCE LINKS (OPTIONAL — SAVES WITH TARGET)</div>
                  {[
                    { key:"referralUrl", label:"Referral Program Page URL", ph:"https://company.com/refer-a-friend" },
                    { key:"contractUrl", label:"Customer Agreement / TOS URL", ph:"https://company.com/legal/terms" },
                    { key:"solvencyNote", label:"Company / Ticker / Revenue Info", ph:"e.g., NASDAQ: FRPT · Est. $180M annual revenue" },
                  ].map(f=>(
                    <div key={f.key} style={{ marginBottom:8 }}>
                      <label style={{ display:"block", fontSize:9, color:"#2A4A5A", marginBottom:3 }}>{f.label}</label>
                      <input value={form[f.key]||""} onChange={e=>setForm(prev=>({...prev,[f.key]:e.target.value}))}
                        placeholder={f.ph}
                        style={{ width:"100%", padding:"6px 11px", background:"#090D1A", border:"1px solid #141F35", borderRadius:6, color:"#6A8A9A", fontSize:11, boxSizing:"border-box", outline:"none" }} />
                    </div>
                  ))}
                </div>

                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  <button onClick={()=>{ if(!form.name.trim()){ setFormErr({name:"Enter a company name first."}); return; } setFormStep(1); }}
                    style={{ background:"#1A3558", border:"1px solid #2A4A6A", borderRadius:7, color:"#6AAED4", fontSize:13, padding:"9px 26px", cursor:"pointer" }}>
                    Next: Score It →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {formStep===1 && (
              <div>
                <div style={{ padding:"9px 13px", background:"#07090F", borderRadius:7, border:"1px solid #101828", marginBottom:18, fontSize:11, color:"#4A5A6A", lineHeight:1.6 }}>
                  Rate each factor <strong style={{ color:"#EF4444" }}>1</strong> (worst) to <strong style={{ color:"#10B981" }}>10</strong> (best). <strong style={{ color:"#D8E8F4" }}>Leave any blank you don't know</strong> — the target still appears in rankings with partial scoring noted. Use the <span style={{ color:"#4A9FD4", fontSize:13 }}>?</span> buttons for the full scoring guide and research tips.
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {CRITERIA.map(c=>{
                    const sv = form.scores[c.id];
                    const hasScore = sv !== "";
                    return (
                      <div key={c.id} style={{ background:"#090D1A", border:"1px solid #101828", borderRadius:9, padding:"12px 14px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:9 }}>
                          <span style={{ fontSize:18, flexShrink:0 }}>{c.emoji}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                              <span style={{ fontSize:12, fontWeight:600, color:"#B8D8F0" }}>{c.label}</span>
                              <GuideTooltip c={c} />
                              <span style={{ fontSize:9, color:"#1E3A4A", fontFamily:"monospace", marginLeft:"auto" }}>{wt[c.id]} pts weight</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"7px 12px", alignItems:"center" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                            <span style={{ fontSize:10, color:"#2A4A5A", fontFamily:"monospace" }}>Score:</span>
                            <input type="number" min={1} max={10} value={sv} placeholder="—"
                              onChange={e=>setForm(f=>({...f,scores:{...f.scores,[c.id]:e.target.value}}))}
                              style={{ width:52, padding:"5px 6px", background:"#07090F", border:`1px solid ${hasScore?scoreColor(Number(sv)):"#1A2D3F"}`, borderRadius:6, color:hasScore?scoreColor(Number(sv)):"#3A4A5A", fontSize:16, textAlign:"center", fontFamily:"monospace", outline:"none" }} />
                            {hasScore && (
                              <div style={{ height:7, width:70, background:"#141F35", borderRadius:4, overflow:"hidden" }}>
                                <div style={{ width:`${Number(sv)*10}%`, height:"100%", background:scoreColor(Number(sv)), borderRadius:4 }} />
                              </div>
                            )}
                          </div>
                          <input value={form.sources[c.id]} onChange={e=>setForm(f=>({...f,sources:{...f.sources,[c.id]:e.target.value}}))}
                            placeholder={c.sourcePlaceholder}
                            style={{ padding:"5px 9px", background:"#07090F", border:"1px solid #101828", borderRadius:6, color:"#4A5A6A", fontSize:10, outline:"none", width:"100%", boxSizing:"border-box" }} />
                        </div>

                        {/* quick-pick buttons */}
                        <div style={{ display:"flex", gap:4, marginTop:8, flexWrap:"wrap", alignItems:"center" }}>
                          <span style={{ fontSize:9, color:"#1E3040", fontFamily:"monospace" }}>QUICK:</span>
                          {c.scoringGuide.map(g=>(
                            <button key={g.range}
                              onClick={()=>setForm(f=>({...f,scores:{...f.scores,[c.id]:parseInt(g.range)}}))}
                              style={{ padding:"2px 7px", borderRadius:4, fontSize:10, cursor:"pointer", background:"#07090F", border:`1px solid ${g.color}40`, color:g.color, fontFamily:"monospace" }}>
                              {g.range}
                            </button>
                          ))}
                          {hasScore && <button onClick={()=>setForm(f=>({...f,scores:{...f.scores,[c.id]:""}})) } style={{ padding:"2px 7px", borderRadius:4, fontSize:10, cursor:"pointer", background:"transparent", border:"1px solid #1E2D3A", color:"#2A3848" }}>clear</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display:"flex", justifyContent:"space-between", marginTop:18 }}>
                  <button onClick={()=>setFormStep(0)} style={{ background:"#090D1A", border:"1px solid #1A2D3F", borderRadius:7, color:"#3A5A6A", fontSize:12, padding:"8px 18px", cursor:"pointer" }}>← Back</button>
                  <div style={{ display:"flex", gap:9 }}>
                    <button onClick={()=>{ setForm(blank); setFormStep(0); setActiveTab("rankings"); }} style={{ background:"#090D1A", border:"1px solid #1A2D3F", borderRadius:7, color:"#3A5A6A", fontSize:12, padding:"8px 18px", cursor:"pointer" }}>Cancel</button>
                    <button onClick={saveTarget} style={{ background:"#1A3A6A", border:"1px solid #2A5A8A", borderRadius:7, color:"#7ABEF0", fontSize:13, fontWeight:600, padding:"8px 26px", cursor:"pointer" }}>Save Target ✓</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SCORING GUIDE TAB
            ════════════════════════════════════════════════════════════════════ */}
        {activeTab==="guide" && (
          <div>
            <div style={{ fontSize:9, color:"#2A5A7A", letterSpacing:2, fontFamily:"monospace", marginBottom:16 }}>
              WEIGHTED SCORING FRAMEWORK — 8 CRITERIA · {totalWt} TOTAL POINTS
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(420px,1fr))", gap:12 }}>
              {CRITERIA.map((c,idx)=>{
                const acc = ["#10B981","#0EA5E9","#7C3AED","#F59E0B","#EF4444","#EC4899","#14B8A6","#F97316"][idx];
                return (
                  <div key={c.id} style={{ background:"#090D1A", border:"1px solid #101828", borderRadius:10, padding:15, borderTop:`3px solid ${acc}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7 }}>
                      <div style={{ display:"flex", gap:7, alignItems:"center" }}>
                        <span style={{ fontSize:18 }}>{c.emoji}</span>
                        <h3 style={{ margin:0, fontSize:13, color:"#B8D0E8" }}>{c.label}</h3>
                      </div>
                      <div style={{ background:"#1A2D47", borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700, color:"#3A7AAA", fontFamily:"monospace", flexShrink:0 }}>{wt[c.id]} pts</div>
                    </div>
                    <p style={{ fontSize:11, color:"#4A5A6A", margin:"0 0 9px", lineHeight:1.6 }}>{c.researchTip}</p>
                    <div style={{ borderTop:"1px solid #101828", paddingTop:9 }}>
                      {c.scoringGuide.map(g=>(
                        <div key={g.range} style={{ display:"flex", gap:7, marginBottom:4 }}>
                          <span style={{ fontFamily:"monospace", fontSize:10, color:g.color, minWidth:30, flexShrink:0 }}>{g.range}</span>
                          <span style={{ fontSize:10, color:"#3A4A5A", lineHeight:1.4 }}>{g.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
