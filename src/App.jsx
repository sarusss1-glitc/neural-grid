import React, { useState, useEffect, useCallback } from "react";

// --- 1. CSS STYLES (Premium Neon UI) ---
const styles = `
@keyframes scanline { 0% { top: 0%; } 100% { top: 100%; } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulseGlow { 0% { box-shadow: 0 0 15px #00f0ff, inset 0 0 10px #00f0ff; } 50% { box-shadow: 0 0 25px #00f0ff, inset 0 0 15px #00f0ff; } 100% { box-shadow: 0 0 15px #00f0ff, inset 0 0 10px #00f0ff; } }

* { box-sizing: border-box; }
body { margin: 0; background: #030712; color: #f8fafc; font-family: 'Courier New', Courier, monospace; overflow-x: hidden; user-select: none; }
.scanline { position: fixed; top: 0; left: 0; width: 100%; height: 3px; background: rgba(0, 240, 255, 0.15); animation: scanline 3s linear infinite; pointer-events: none; z-index: 50; }

.btn-util { background: #0f172a; border: 1px solid #1e293b; color: #94a3b8; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s ease; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
.btn-util:hover:not(:disabled) { border-color: #00f0ff; color: #fff; background: #020617; box-shadow: 0 0 15px rgba(0, 240, 255, 0.3); transform: translateY(-2px); }
.btn-util:disabled { opacity: 0.2; cursor: not-allowed; transform: none; box-shadow: none; }

/* The Game Board Container */
.board-container { background: rgba(15, 23, 42, 0.6); padding: 30px; border-radius: 16px; border: 1px solid #1e293b; box-shadow: 0 20px 40px rgba(0,0,0,0.5); backdrop-filter: blur(10px); }

/* Neural Nodes */
.node-container { position: relative; width: 60px; height: 60px; }
.node { width: 100%; height: 100%; border-radius: 50%; cursor: pointer; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); border: 2px solid #1e293b; background: #020617; box-shadow: inset 0 4px 8px rgba(0,0,0,0.8); }
.node:hover { border-color: #475569; }

/* Active Node (Neon Cyan) */
.node.active { background: #00f0ff; border: 2px solid #fff; animation: pulseGlow 2s infinite; }

/* Preview Nodes (FIXED: Logical Colors) */
.node.preview-on { background: rgba(0, 240, 255, 0.15); border: 2px dashed #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.3); }
.node.active.preview-off { background: rgba(0, 240, 255, 0.1); border: 2px dashed #64748b; box-shadow: none; animation: none; opacity: 0.3; }

/* UI Elements */
.hud-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; font-weight: bold; }
.level-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; max-width: 550px; margin: 20px auto; max-height: 65vh; overflow-y: auto; padding: 25px; background: linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(2,6,23,0.8) 100%); border-radius: 16px; border: 1px solid rgba(0, 240, 255, 0.15); box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 0 20px rgba(0, 240, 255, 0.05); backdrop-filter: blur(10px); }
.level-btn { aspect-ratio: 1; border-radius: 8px; border: 1px solid #334155; background: rgba(30, 41, 59, 0.6); color: #f8fafc; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
.level-btn:hover:not(:disabled) { border-color: #00f0ff; transform: scale(1.1) translateY(-2px); background: rgba(0, 240, 255, 0.15); box-shadow: 0 10px 20px rgba(0, 240, 255, 0.3), inset 0 0 10px rgba(0, 240, 255, 0.2); z-index: 10; }
.level-btn:disabled { opacity: 0.45; background: rgba(15, 23, 42, 0.3); border-color: #0f172a; color: #475569; box-shadow: none; }
.level-star { position: absolute; top: -6px; right: -6px; font-size: 11px; border-radius: 50%; width: 22px; height: 22px; display:flex; justify-content:center; align-items:center; }
`;

// --- 2. AUDIO ENGINE ---
let _ac = null;
const ac = () => { if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)(); return _ac; };
function playTone(f, type = "sine", dur = 0.15, vol = 0.1, delay = 0) {
    try {
        const ctx = ac(); if (ctx.state === 'suspended') ctx.resume();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type = type; o.frequency.value = f;
        const start = ctx.currentTime + delay;
        g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(vol, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        o.start(start); o.stop(start + dur + 0.1);
    } catch(e) {}
}
const SFX = {
    click: () => playTone(440, "sine", 0.08, 0.08),
    win: () => [523, 659, 784, 1047].forEach((f, i) => playTone(f, "sine", 0.4, 0.1, i * 0.1)),
    undo: () => playTone(220, "triangle", 0.1, 0.05),
    nav: () => playTone(880, "sine", 0.05, 0.05),
    hint: () => playTone(600, "sine", 0.1, 0.05)
};

// --- 3. DATA BUILDERS ---
const B = (size, clicks, concept, hints = []) => {
    let b = Array(size * size).fill(1);
    clicks.forEach(idx => {
        const r = Math.floor(idx / size), c = idx % size;
        [idx, idx-1, idx+1, idx-size, idx+size].forEach(j => {
            if (j >= 0 && j < size*size && Math.abs(Math.floor(j/size) - r) + Math.abs((j%size) - c) <= 1) b[j] ^= 1;
        });
    });
    return { type: "lights", rows: size, cols: size, start: b, par: clicks.length, concept, hints, solvable: true };
};

const B_rect = (rows, cols, clicks, concept, hints = []) => {
    let b = Array(rows * cols).fill(1);
    clicks.forEach(idx => {
        const r = Math.floor(idx / cols), c = idx % cols;
        [idx, idx-1, idx+1, idx-cols, idx+cols].forEach(j => {
            if (j >= 0 && j < rows*cols && Math.abs(Math.floor(j/cols) - r) + Math.abs((j%cols) - c) <= 1) b[j] ^= 1;
        });
    });
    return { type: "lights", rows, cols, start: b, par: clicks.length, concept, hints, solvable: true };
};

const UL = (size, board, concept, hints, proof) => ({
    type: "lights", rows: size, cols: size, start: board, par: 0, concept, hints, proof, solvable: false
});

// --- 4. THE 60 LEVELS ARCHIVE ---
const LEVELS = [
   // PHASE 1: THE DISCOVERY HOOK (1-15)
    B(3, [4], "A single pulse affects more than itself", ["The center neuron affects its neighbors."]),
    B(3, [0, 8], "Opposite corners create symmetry", ["Think in mirrors."]),
    B(3, [0], "Not all nodes are equal. Corners are restricted", ["Edges have fewer connections."]),
    B(3, [1, 3], "Pulses interfere and cancel each other", ["Where pulses meet, signals neutralize."]),
    B(3, [0, 2], "Mirrors simplify chaos", ["Mirror actions create structure."]),
    B(3, [1, 4, 7], "Columns can be shifted as a system", ["Clear a vertical path."]),
    B(3, [3, 4, 5], "Instability can be pushed to the edges", ["Move the problem to the boundary."]),
    B(3, [1, 3, 5, 7], "Some states loop locally", ["Circular dependencies."]),
    B(3, [0, 4, 8], "The diagonal anchors the grid", ["Follow the diagonal."]),
    B(3, [2, 4, 6], "The center is the ultimate pivot", ["Balance the extremes."]),
    B(3, [1, 2], "Asymmetry requires step-by-step logic", ["Solve row by row."]),
    B(3, [6, 7, 8], "Base stabilization secures the grid", ["Clear the bottom row."]),
    B(3, [0, 5, 7], "Chaos hides simple paths", ["Don't let the noise confuse you."]),
    B(3, [2, 3, 8], "Misaligned grids need corner anchors", ["Anchor corners to clear the core."]),
    B(3, [0, 2, 4, 6, 8], "The system follows hidden rules", ["The Master 3x3 Calibration."]),

    // PHASE 2: BRIDGE (16-20)
    B_rect(3, 4, [5], "Dimensional Growth", ["Adapt to the new width."]),
    B_rect(3, 4, [5, 6], "Asymmetric Expansion", ["Symmetry in 3x4 is different."]),
    B_rect(3, 4, [0, 11], "Far Synapses", ["Distance changes interaction radius."]),
    B_rect(3, 4, [1, 6, 9], "Pathfinding", ["Follow the neural trail."]),
    B_rect(3, 4, [0, 3, 8, 11], "The Frame", ["Secure the boundaries."]),

    // PHASE 3 & 4: 4x4 MASTER CLASS (21-60)
    B(4, [5], "4D Core", ["Notice the expanded adjacency space."]),
    B(4, [0], "4D Corner", ["Corners now feel much further away."]),
    B(4, [5, 10], "Inner Diagonal", ["Two isolated center hits."]),
    B(4, [0, 15], "Absolute Extremes", ["Look at the far opposite ends."]),
    B(4, [5, 6, 9, 10], "The 2x2 Core", ["Focus purely on the central block."]),
    UL(4, [0,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], "Corner Trap", ["Can a single corner be reached alone?"], "PROOF: A corner connects to 2 nodes. Any parity change is global."),
    B(4, [1, 2, 13, 14], "Edge Pairs", ["Symmetry across the horizontal axis."]),
    B(4, [0, 3, 12, 15], "The Four Pillars", ["The anchors of the board."]),
    B(4, [0, 5, 10, 15], "Main 4D Diagonal", ["A perfect diagonal line."]),
    UL(4, [1,1,1,1, 1,0,1,1, 1,1,1,1, 1,1,1,1], "Inner Lock", ["Is this reachable?"], "PROOF: Internal kernel prevents single node isolation."),
    B(4, [0, 1, 2, 3], "Row Vector", ["Clear the top row."]),
    B(4, [0, 4, 8, 12], "Column Vector", ["Clear the left column."]),
    B(4, [2, 5, 8, 15], "Sparse Asymmetry", ["Treat each cluster separately."]),
    B(4, [1, 4, 11, 14], "Inner Cross", ["Symmetric inner edges."]),
    B(4, [0, 1, 2, 3, 4, 8, 12], "The L-Shape", ["Combine row and column."]),
    B(4, [5, 6, 9, 10, 0, 3], "Core and Corners", ["A symmetric lock."]),
    B(4, [1, 2, 4, 11, 13, 14], "The Asymmetric Ring", ["Try to outline the edges."]),
    UL(4, [0,1,1,1, 1,0,1,1, 1,1,1,1, 1,1,1,1], "Diagonal Trap", ["Two adjacent missing nodes."], "PROOF: Diagonal anomaly prevents orthogonal resolution."),
    B(4, [0, 2, 5, 7, 8, 10, 13, 15], "Checkerboard", ["An alternating grid pattern."]),
    B(4, [0, 1, 2, 3, 4, 5, 6, 7], "Top Hemisphere", ["A heavy inversion."]),
    B(4, [0, 1, 4, 5, 10, 11, 14, 15], "Dual Blocks", ["Opposite corner blocks."]),
    B(4, [0, 3, 5, 6, 9, 10, 12, 15], "The Large X", ["Corners and core combined."]),
    UL(4, [0,0,0,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], "Tri-Node Array", ["Consider the parity."], "PROOF: Dot product with kernel yields 1 (mod 2)."),
    B(4, [1, 3, 4, 6, 9, 11, 12, 14], "High Entropy", ["Scattered noise."]),
    B(4, [0, 2, 4, 6, 8, 10, 12, 14], "The Evens", ["Alternating pattern."]),
    B(4, [0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15], "The O-Frame", ["Massive perimeter interference."]),
    UL(4, [0,1,0,1, 0,1,0,1, 1,1,1,1, 1,1,1,1], "Bar Pattern", ["Does it exist?"], "PROOF: Creates an infinite loop of toggles in 4D space."),
    B(4, [1, 2, 4, 7, 8, 11, 13, 14], "Perimeter Lock", ["8 precise clicks required."]),
    B(4, [0, 6, 11, 13, 14], "Asymmetric Chaos", ["No symmetry to save you."]),
    B(4, [0, 1, 4, 10, 15], "Entropy Spike", ["Symmetry is broken. Focus on diagonal tension."]),
    B(4, [5, 6, 9, 2, 13], "Void Weaver", ["The center is a trap."]),
    B(4, [1, 2, 5, 6, 9, 10, 13, 14], "Center Pillars", ["A vertical block."]),
    B(4, [0, 4, 5, 10, 11, 15], "Diagonal Flow", ["Shifted equilibrium."]),
    B(4, [2, 3, 4, 5, 10, 11, 12, 13], "Inner Walls", ["Push toward the center."]),
    B(4, [2, 5, 7, 8, 10, 13], "Quantum Pulse", ["Complex 4x4 state."]),
    B(4, [0, 3, 6, 9, 12, 15], "Double Diagonal", ["Interweaving paths."]),
    B(4, [1, 2, 4, 7, 8, 11, 13, 14, 5, 10], "The Core Frame", ["Total internal/external sync."]),
    B(4, [0, 1, 2, 3, 12, 13, 14, 15], "Parallel Rails", ["Top and bottom constraints."]),
    B(4, [5, 6, 9, 10, 1, 14, 4, 11], "The Neural Cross", ["4D intersection points."]),
    B(4, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], "The Determinant", ["Total Calibration."])
];

// --- 5. MAIN COMPONENT ---
export default function InvariantMaster() {
    const [anomalyPhase, setAnomalyPhase] = useState(0); // 0=רגיל, 1=גליץ', 2=הוכחה
    const [discoveredRules, setDiscoveredRules] = useState([]); // שומר איזה חוקים השחקן כבר גילה
    const [scene, setScene] = useState("boot");
    const [lvIdx, setLvIdx] = useState(0);
    const [board, setBoard] = useState([]);
    const [history, setHistory] = useState([]);
    const [moves, setMoves] = useState(0);
    const [undos, setUndos] = useState(0);
    const [progress, setProgress] = useState({});
    const [locked, setLocked] = useState(false);
    const [hintStep, setHintStep] = useState(0);
    const [showPAR, setShowPAR] = useState(false);
    const [timer, setTimer] = useState(0);
    const [previewMode, setPreviewMode] = useState(false); // מצב עזר דלוק כברירת מחדל
    const [hoverNode, setHoverNode] = useState(null); // זוכר על איזה תא העכבר נמצא

    const lv = LEVELS[lvIdx];
    const rows = lv.rows, cols = lv.cols;

    useEffect(() => {
        const saved = localStorage.getItem("neural_grid_60_progress");
        if (saved) { try { setProgress(JSON.parse(saved)); } catch(e) {} }
        setTimeout(() => setScene("menu"), 2500);
    }, []);

    useEffect(() => {
        if (Object.keys(progress).length) localStorage.setItem("neural_grid_60_progress", JSON.stringify(progress));
    }, [progress]);

    useEffect(() => {
        if (scene === "play") {
            const t = setInterval(() => setTimer(prev => prev + 1), 1000);
            return () => { clearInterval(t); setTimer(0); };
        }
    }, [scene, lvIdx]);

    const initLevel = (idx) => {
        const current = LEVELS[idx];
        setBoard([...current.start]);
        setHistory([]); setMoves(0); setUndos(0); setHintStep(0); setShowPAR(false); setLocked(false);
    };

    const handleNode = (clickedIdx) => {
        if (locked) return;
        SFX.click();
        setLocked(true);

        const r = Math.floor(clickedIdx / cols);
        const c = clickedIdx % cols;
        const affected = [clickedIdx, clickedIdx - 1, clickedIdx + 1, clickedIdx - cols, clickedIdx + cols]
            .filter(j =>
                j >= 0 &&
                j < board.length &&
                Math.abs(Math.floor(j / cols) - r) + Math.abs((j % cols) - c) <= 1
            )
            .sort((a, b) => (a === clickedIdx ? -1 : b === clickedIdx ? 1 : 0));

        setHistory(prev => [...prev, [...board]]);

        affected.forEach((cellIdx, step) => {
            setTimeout(() => {
                // שימוש ב-Callback כדי ש-React 18 לא יאבד פריימים באנימציה
                setBoard(prevBoard => {
                    const nb = [...prevBoard];
                    nb[cellIdx] ^= 1;
                    
                    // בבדיקה של הצעד האחרון בגל:
                    if (step === affected.length - 1) {
                        const won = nb.every(v => v === 1);
                        setMoves(m => {
                            const next = m + 1;
                            if (won && lv.solvable !== false) handleWinUpdate(next);
                            return next;
                        });
                        if (!won) setLocked(false);
                    }
                    return nb;
                });
            }, step * 80); // האטתי טיפה את הגל ל-80ms כדי שייראה יותר אורגני
        });
    };

    const handleAnomaly = () => {
        if (locked) return;
        setLocked(true);
        setAnomalyPhase(1);

        let pulseCount = 0;
        const glitchInterval = setInterval(() => {
            setBoard(prev => {
                const nb = [...prev];
                for (let k = 0; k < 3; k++) nb[Math.floor(Math.random() * nb.length)] ^= 1;
                return nb;
            });
            pulseCount++;

            if (pulseCount >= 10) {
                clearInterval(glitchInterval);
                setBoard([...lv.start]);
                setAnomalyPhase(2);

                setTimeout(() => {
                    SFX.win();
                    setProgress(p => ({ ...p, [lvIdx]: Math.max(p[lvIdx] || 0, 3) }));
                    setAnomalyPhase(0);
                    setScene("win");
                }, 3500); // 3.5 שניות לקרוא את ההוכחה
            }
        }, 110);
    };

    const getStars = (m, u) => {
        if (lv.solvable === false) return 3;
        if (m <= lv.par && u === 0) return 3;
        if (m <= lv.par + 2) return 2;
        return 1;
    };

    const currentStars = getStars(moves, undos);
    const parUnlocked = moves >= 10 || timer >= 15;

    const handleWinUpdate = (nextMoves) => {
        setLocked(true);
        const score = getStars(nextMoves, undos);
        setTimeout(() => {
            SFX.win();
            setProgress(p => ({ ...p, [lvIdx]: Math.max(p[lvIdx] || 0, score) }));
            setScene("win");
        }, 1200); // 1.2 שניות שלמות כדי להנות מהלוח המואר לפני שעוברים מסך!
    };

    const generateShareText = () => {
        const grid = board.map(v => v ? "🟦" : "⬛").reduce((acc, emoji, i) => {
            return acc + emoji + ((i + 1) % cols === 0 ? "\n" : "");
        }, "");
        const text = `NEURAL GRID #${lvIdx + 1}\n${"⭐️".repeat(currentStars)}\nMOVES: ${moves} (PAR: ${lv.par})\n\n${grid}\nCan you stabilize it?`;
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard! Ready to share.");
    };

    return (
        <div style={{ padding: 20, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <style>{styles}</style>
            <div className="scanline" />

            {scene === "boot" && (
                <div style={{ marginTop: '30vh', textAlign: 'center', animation: 'fadeIn 2s' }}>
                    <div style={{ color: '#00f0ff', letterSpacing: 10, fontSize: 24, fontWeight: 'bold', textShadow: '0 0 15px #00f0ff' }}>NEURAL GRID</div>
                    <div style={{ color: '#94a3b8', marginTop: 10 }}>UNPACKING ARCHIVE...</div>
                </div>
            )}

           {scene === "menu" && (
                <div style={{ width: '100%', maxWidth: 650, textAlign: 'center', animation: 'fadeIn 0.5s', position: 'relative' }}>
                    {/* הילת רקע זוהרת למסך */}
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', height: '90%', background: 'radial-gradient(circle, rgba(0,240,255,0.08) 0%, transparent 70%)', zIndex: -1, pointerEvents: 'none' }} />
                    
                    <h2 style={{ letterSpacing: 5, color: '#00f0ff', textShadow: '0 0 15px rgba(0,240,255,0.6)', margin: '0 0 5px 0' }}>SIGNAL ARCHIVE</h2>
                    <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 25, letterSpacing: 2 }}>SELECT A NODE TO STABILIZE</div>
                    
                    <div className="level-grid">
                        {LEVELS.map((l, i) => {
                            const isUnlocked = i === 0 || progress[i-1] !== undefined;
                            const stars = progress[i] || 0;
                            return (
                                <button key={i} className="level-btn" disabled={!isUnlocked} onClick={() => { 
                                    SFX.nav(); setLvIdx(i); initLevel(i); setScene("play"); 
                                }} style={stars ? { borderColor: '#00f0ff', background: 'rgba(0, 240, 255, 0.05)' } : {}}>
                                    {i + 1}
                                    {stars === 3 && <div className="level-star" style={{color: '#000', background: '#eab308', borderColor: '#eab308', boxShadow: '0 0 10px #eab308'}}>★</div>}
                                    {stars > 0 && stars < 3 && <div className="level-star" style={{color: '#000', background: '#22c55e', borderColor: '#22c55e', boxShadow: '0 0 10px #22c55e'}}>✓</div>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {scene === "play" && (
                <div style={{ width: '100%', maxWidth: 500, animation: 'fadeIn 0.5s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <button className="btn-util" onClick={() => setScene("menu")}>← LEVELS</button>
                        <div style={{ textAlign: 'right' }}>
                            <div className="hud-label">RATING</div>
                            <div style={{ color: '#00f0ff', fontSize: 16, textShadow: '0 0 8px rgba(0,240,255,0.6)' }}>{"⭐️".repeat(currentStars)}</div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: 25 }}>
                        <div className="hud-label" style={{ color: '#00f0ff', textShadow: '0 0 8px rgba(0,240,255,0.4)', fontSize: 14 }}>
                            {progress[lvIdx] ? lv.concept : "??? (STABILIZE TO DISCOVER)"}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>{cols}x{rows} GRID | MOVES: {moves}</div>
                    </div>

                    <div className="board-container">
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, margin: '0 auto', width: 'fit-content' }}>
                            {board.map((v, i) => {
                                let isPreview = false;
                                if (previewMode && hoverNode !== null) {
                                    const r_hover = Math.floor(hoverNode / cols), c_hover = hoverNode % cols;
                                    const r_i = Math.floor(i / cols), c_i = i % cols;
                                    if (Math.abs(r_hover - r_i) + Math.abs(c_hover - c_i) <= 1) isPreview = true;
                                }
                                
                                // אם התא דלוק הוא יקבל את הקלאס שמדגיש עמעום/כיבוי. אם הוא כבוי הוא יקבל הילה כחולה.
                                const previewClass = isPreview ? (v ? 'preview-off' : 'preview-on') : '';
                                
                                return (
                                    <div key={i} className="node-container">
                                        <button 
                                            className={`node ${v ? 'active' : ''} ${previewClass}`} 
                                            onClick={() => handleNode(i)}
                                            onMouseEnter={() => setHoverNode(i)}
                                            onMouseLeave={() => setHoverNode(null)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ marginTop: 30, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn-util" onClick={() => { SFX.undo(); setBoard(history[history.length-1]); setHistory(p=>p.slice(0,-1)); setMoves(m=>Math.max(0, m-1)); setUndos(u=>u+1); }} disabled={history.length === 0 || locked}>UNDO</button>
                        <button className="btn-util" onClick={() => initLevel(lvIdx)}>RESTART</button>
                        <button className="btn-util" onClick={() => setPreviewMode(!previewMode)} style={{ color: previewMode ? '#00f0ff' : '#94a3b8', borderColor: previewMode ? '#00f0ff' : '#1e293b' }}>
                            PREVIEW [{previewMode ? 'ON' : 'OFF'}]
                        </button>
                        <button className="btn-util" onClick={() => setShowPAR(true)} disabled={!parUnlocked}>
                            {showPAR ? `PAR: ${lv.par}` : "SHOW PAR (?)"}
                        </button>
                        <button className="btn-util" onClick={() => { SFX.hint(); setHintStep(s => s + 1); }} disabled={hintStep >= lv.hints.length}>HINT</button>
                        {!lv.solvable && (
                            <button className="btn-util" disabled={locked} style={{ background: locked ? '#7f1d1d' : '#ef4444', color: '#fff', border: 'none', animation: !locked ? 'pulseGlow 1.5s infinite' : 'none' }} onClick={handleAnomaly}>
                                {locked ? 'ANALYZING...' : '⚠ DECLARE ANOMALY'}
                            </button>
                        )}
                    </div>

                    {hintStep > 0 && (
                        <div style={{ marginTop: 20, color: '#94a3b8', fontSize: 12, textAlign: 'left', padding: 15, background: 'rgba(15,23,42,0.6)', borderLeft: '2px solid #00f0ff', borderRadius: '4px' }}>
                            {lv.hints.slice(0, hintStep).map((h, i) => <div key={i} style={{marginBottom: 6}}>{"> "} {h}</div>)}
                        </div>
                    )}

                    {anomalyPhase === 2 && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.4s ease', zIndex: 100, padding: 40, textAlign: 'center' }}>
                            <div style={{ color: '#ef4444', fontSize: 13, letterSpacing: 4, marginBottom: 12 }}>⚠ ANOMALY CONFIRMED</div>
                            <div style={{ color: '#00f0ff', fontSize: 24, fontWeight: 'bold', marginBottom: 30, textShadow: '0 0 15px rgba(0,240,255,0.5)' }}>QUANTUM LOCK DETECTED</div>
                            <div style={{ background: '#0f172a', border: '1px solid #ef4444', borderRadius: 8, padding: '20px 30px', maxWidth: 420, color: '#f87171', fontSize: 13, lineHeight: 1.8, fontStyle: 'italic', boxShadow: '0 0 20px rgba(239,68,68,0.2)' }}>
                                {lv.proof || "This state lies outside the reachable subspace."}
                            </div>
                            <div style={{ color: '#475569', fontSize: 11, marginTop: 25 }}>ANALYZING KERNEL INTERSECTION...</div>
                        </div>
                    )}
                </div>
            )}

            {scene === "win" && (
                <div style={{ textAlign: 'center', marginTop: '15vh', animation: 'fadeIn 0.8s' }}>
                    <h1 style={{ color: '#00f0ff', letterSpacing: 8, textShadow: '0 0 15px rgba(0,240,255,0.6)' }}>STABILIZED</h1>
                    <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b', padding: 40, borderRadius: 12, margin: '30px 0', minWidth: 350, boxShadow: '0 20px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
                        <div style={{ color: '#22c55e', fontSize: 12, letterSpacing: 2, marginBottom: 15, fontWeight: 'bold' }}>SIGNAL STABILIZED</div>
                        <div className="hud-label" style={{ color: '#94a3b8', fontSize: 12 }}>YOU DISCOVERED:</div>
                        <div style={{ fontSize: 22, fontWeight: 'bold', color: '#fff', margin: '10px 0 25px 0' }}>{lv.concept}</div>
                        <div style={{ fontSize: 40, margin: '15px 0', textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>{"⭐️".repeat(currentStars)}</div>
                        <div style={{ color: '#64748b', fontSize: 12, marginTop: 15 }}>{moves} MOVES | PAR: {lv.par}</div>
                        {lv.solvable === false && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 20, fontStyle: 'italic' }}>PROOF: {lv.proof}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 15, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn-util" style={{ background: '#00f0ff', color: '#030712', border: 'none', fontSize: '14px', padding: '12px 30px', boxShadow: '0 0 20px rgba(0, 240, 255, 0.4)' }} onClick={generateShareText}>BRAG & SHARE 🔗</button>
                        <button className="btn-util" onClick={() => setScene("menu")}>LEVELS</button>
                        <button className="btn-util" style={{ background: '#f8fafc', color: '#030712', border: 'none' }} onClick={() => {
                            if (lvIdx + 1 < LEVELS.length) { setLvIdx(lvIdx + 1); initLevel(lvIdx + 1); setScene("play"); }
                            else { setScene("menu"); }
                        }}>NEXT NODE</button>
                    </div>
                </div>
            )}
        </div>
    );
}
