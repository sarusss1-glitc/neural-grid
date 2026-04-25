import React, { useState, useEffect, useCallback } from "react";

// --- 1. CSS STYLES (The Cyber-Math Aesthetic) ---
const styles = `
@keyframes scanline { 0% { top: 0%; } 100% { top: 100%; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(6, 182, 212, 0); } 100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); } }

* { box-sizing: border-box; }
body { margin: 0; background: #020202; color: #fff; font-family: monospace; overflow-x: hidden; user-select: none; }
.scanline { position: fixed; top: 0; left: 0; width: 100%; height: 2px; background: rgba(6, 182, 212, 0.1); animation: scanline 4s linear infinite; pointer-events: none; z-index: 50; }

.btn-util { background: #111; border: 1px solid #333; color: #888; padding: 10px 18px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: 0.2s; font-weight: bold; text-transform: uppercase; }
.btn-util:hover:not(:disabled) { border-color: #06b6d4; color: #fff; background: #0a0a0a; }
.btn-util:disabled { opacity: 0.2; cursor: not-allowed; }

.level-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; max-width: 500px; margin: 30px auto; max-height: 70vh; overflow-y: auto; padding: 15px; border: 1px solid #111; }
.level-btn { aspect-ratio: 1; border-radius: 6px; border: 1px solid #222; background: #050505; color: #fff; font-size: 14px; font-weight: bold; cursor: pointer; transition: 0.2s; position: relative; }
.level-btn:hover:not(:disabled) { border-color: #06b6d4; transform: scale(1.05); }
.level-btn:disabled { opacity: 0.15; cursor: not-allowed; }
.level-star { position: absolute; top: -4px; right: -4px; font-size: 10px; background: #000; border-radius: 50%; width: 18px; height: 18px; display:flex; justify-content:center; align-items:center; border: 1px solid #06b6d4; color: #06b6d4; }

.node-container { position: relative; width: 55px; height: 55px; }
.node { width: 100%; height: 100%; border-radius: 50%; cursor: pointer; transition: 0.3s; border: 2px solid #222; background: #050505; }
.node.active { background: #06b6d4; border-color: #06b6d4; box-shadow: 0 0 15px rgba(6, 182, 212, 0.4); }

.hud-label { color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
.efficiency-bar { height: 4px; background: #111; border-radius: 2px; margin-top: 6px; overflow: hidden; width: 100px; }
.efficiency-fill { height: 100%; background: #06b6d4; transition: width 0.5s ease; }
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
    // PHASE 1: ONBOARDING (1-15)
    B(3, [4], "Trigger a pulse", ["The center neuron affects its neighbors."]),
    B(3, [0], "Corner Restriction", ["Edges have fewer connections."]),
    B(3, [1], "Synaptic Bridge", ["The pulse flows along the axis."]),
    B(3, [4, 4], "Echo Invariant", ["Double pulses cancel out (mod 2)."]),
    B(3, [1, 3], "Interference", ["Where pulses meet, signals neutralize."]),
    B(3, [0, 2, 6, 8], "Pattern Array", ["Anchor corners to clear the core."]),
    B(3, [0, 2], "Axial Symmetry", ["Mirror pulses to simplify the grid."]),
    B(3, [1, 4, 7], "Columnar Stabilization", ["Clear a vertical path."]),
    B(3, [3, 4, 5], "Signal Drift", ["Push noise to the boundary."]),
    B(3, [0, 4, 8], "Structural Resistance", ["Follow the diagonal."]),
    B(3, [2, 4, 6], "Balance Point", ["The center is the pivot."]),
    B(3, [1, 3, 5, 7], "Ring Oscillator", ["Circular dependencies."]),
    B(3, [0, 1, 2], "Layered Resolution", ["Solve row by row."]),
    B(3, [6, 7, 8], "Base Stabilization", ["Clear the bottom row."]),
    B(3, [0, 2, 4, 6, 8], "Neural X", ["The Master 3x3 Calibration."]),

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

    const handleNode = (i) => {
        if (locked) return;
        SFX.click();
        const nb = [...board];
        const r = Math.floor(i / cols), c = i % cols;
        [i, i-1, i+1, i-cols, i+cols].forEach(j => {
            if (j >= 0 && j < nb.length && Math.abs(Math.floor(j/cols) - r) + Math.abs((j%cols) - c) <= 1) nb[j] ^= 1;
        });

        setHistory(prev => [...prev, board]);
        setBoard(nb);
        
        const won = nb.every(v => v === 1);
        setMoves(m => {
            const next = m + 1;
            if (won && lv.solvable !== false) handleWinUpdate(next);
            return next;
        });
    };

    const getStars = (m, u) => {
        if (lv.solvable === false) return 3;
        if (m <= lv.par && u === 0) return 3;
        if (m <= lv.par + 2) return 2;
        return 1;
    };

    const currentStars = getStars(moves, undos);
    const parUnlocked = moves >= 10 || timer >= 15;

    const handleAnomaly = () => {
        SFX.win();
        setProgress(p => ({ ...p, [lvIdx]: Math.max(p[lvIdx] || 0, 3) }));
        setScene("win");
    };

    const handleWinUpdate = (nextMoves) => {
        setLocked(true);
        const score = getStars(nextMoves, undos);
        setTimeout(() => {
            SFX.win();
            setProgress(p => ({ ...p, [lvIdx]: Math.max(p[lvIdx] || 0, score) }));
            setScene("win");
        }, 500);
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
                    <div style={{ color: '#06b6d4', letterSpacing: 10, fontSize: 24, fontWeight: 'bold' }}>NEURAL_GRID_v6.0</div>
                    <div style={{ color: '#333', marginTop: 10 }}>UNPACKING 60 STABILIZERS...</div>
                </div>
            )}

            {scene === "menu" && (
                <div style={{ width: '100%', maxWidth: 650, textAlign: 'center', animation: 'fadeIn 0.5s' }}>
                    <h2 style={{ letterSpacing: 5, color: '#06b6d4' }}>LEVELS [60]</h2>
                    <div className="level-grid">
                        {LEVELS.map((l, i) => {
                            const isUnlocked = i === 0 || progress[i-1] !== undefined;
                            const stars = progress[i] || 0;
                            return (
                                <button key={i} className="level-btn" disabled={!isUnlocked} onClick={() => { 
                                    SFX.nav(); setLvIdx(i); initLevel(i); setScene("play"); 
                                }} style={{ borderColor: stars ? '#06b6d4' : '#222' }}>
                                    {i + 1}
                                    {stars === 3 && <div className="level-star" style={{color: '#eab308', borderColor: '#eab308'}}>★</div>}
                                    {stars > 0 && stars < 3 && <div className="level-star" style={{color: '#22c55e', borderColor: '#22c55e'}}>✓</div>}
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
                            <div style={{ color: '#06b6d4', fontSize: 16 }}>{"⭐️".repeat(currentStars)}</div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: 25 }}>
                        <div className="hud-label" style={{ color: '#06b6d4' }}>{lv.concept}</div>
                        <div style={{ fontSize: 11, color: '#444' }}>{cols}x{rows} GRID | MOVES: {moves}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, margin: '0 auto', width: 'fit-content' }}>
                        {board.map((v, i) => (
                            <div key={i} className="node-container">
                                <button className={`node ${v ? 'active' : ''}`} onClick={() => handleNode(i)} />
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 30, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn-util" onClick={() => { SFX.undo(); setBoard(history[history.length-1]); setHistory(p=>p.slice(0,-1)); setMoves(m=>Math.max(0, m-1)); setUndos(u=>u+1); }} disabled={history.length === 0 || locked}>UNDO</button>
                        <button className="btn-util" onClick={() => initLevel(lvIdx)}>RESTART</button>
                        <button className="btn-util" onClick={() => setShowPAR(true)} disabled={!parUnlocked}>
                            {showPAR ? `PAR: ${lv.par}` : "SHOW PAR (?)"}
                        </button>
                        <button className="btn-util" onClick={() => { SFX.hint(); setHintStep(s => s + 1); }} disabled={hintStep >= lv.hints.length}>HINT</button>
                        {!lv.solvable && (
                            <button className="btn-util" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={handleAnomaly}>DECLARE ANOMALY</button>
                        )}
                    </div>

                    {hintStep > 0 && (
                        <div style={{ marginTop: 20, color: '#888', fontSize: 12, textAlign: 'left', padding: 10, background: '#0a0a0a', borderLeft: '2px solid #06b6d4' }}>
                            {lv.hints.slice(0, hintStep).map((h, i) => <div key={i}>{"> "} {h}</div>)}
                        </div>
                    )}
                </div>
            )}

            {scene === "win" && (
                <div style={{ textAlign: 'center', marginTop: '15vh', animation: 'fadeIn 0.8s' }}>
                    <h1 style={{ color: '#06b6d4', letterSpacing: 8 }}>STABILIZED</h1>
                    <div style={{ background: '#0a0a0a', border: '1px solid #222', padding: 30, borderRadius: 8, margin: '30px 0', minWidth: 300 }}>
                        <div className="hud-label">{lv.concept}</div>
                        <div style={{ fontSize: 40, margin: '15px 0' }}>{"⭐️".repeat(currentStars)}</div>
                        <div style={{ color: '#555', fontSize: 11 }}>{moves} MOVES | PAR: {lv.par}</div>
                        {lv.solvable === false && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 15 }}>PROOF: {lv.proof}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn-util" style={{ background: '#22c55e', color: '#000', border: 'none' }} onClick={generateShareText}>SHARE 🔗</button>
                        <button className="btn-util" onClick={() => setScene("menu")}>LEVELS</button>
                        <button className="btn-util" style={{ background: '#06b6d4', color: '#000', border: 'none' }} onClick={() => {
                            if (lvIdx + 1 < LEVELS.length) { setLvIdx(lvIdx + 1); initLevel(lvIdx + 1); setScene("play"); }
                            else { setScene("menu"); }
                        }}>NEXT</button>
                    </div>
                </div>
            )}
        </div>
    );
}
