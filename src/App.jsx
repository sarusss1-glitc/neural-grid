import React, { useState, useEffect } from "react";

// --- 1. CSS STYLES ---
const styles = `
@keyframes scanline { 0% { top: 0%; } 100% { top: 100%; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

* { box-sizing: border-box; }
body { margin: 0; background: #020202; color: #fff; font-family: monospace; overflow: hidden; user-select: none; }
.scanline { position: fixed; top: 0; left: 0; width: 100%; height: 2px; background: rgba(6, 182, 212, 0.1); animation: scanline 4s linear infinite; pointer-events: none; z-index: 50; }

/* Buttons & UI */
.btn-util { background: #111; border: 1px solid #333; color: #888; padding: 10px 18px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: 0.2s; font-weight: bold; text-transform: uppercase; }
.btn-util:hover:not(:disabled) { border-color: #06b6d4; color: #fff; background: #0a0a0a; }
.btn-util:disabled { opacity: 0.2; cursor: not-allowed; }

/* Level Grid */
.level-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; max-width: 400px; margin: 40px auto; }
.level-btn { aspect-ratio: 1; border-radius: 8px; border: 1px solid #333; background: #0a0a0a; color: #fff; font-size: 18px; font-weight: bold; cursor: pointer; transition: 0.2s; position: relative; }
.level-btn:hover:not(:disabled) { border-color: #06b6d4; transform: translateY(-2px); }
.level-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.level-star { position: absolute; top: -5px; right: -5px; font-size: 14px; background: #000; border-radius: 50%; width: 22px; height: 22px; display:flex; justify-content:center; align-items:center; border: 1px solid #06b6d4; color: #06b6d4; }

/* Engine UI */
.node-container { position: relative; width: 60px; height: 60px; }
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
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(vol, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        o.start(start); o.stop(start + dur + 0.1);
    } catch(e) {}
}

const SFX = {
    click: () => playTone(440, "sine", 0.1, 0.08),
    win: () => [523, 659, 784, 1047].forEach((f, i) => playTone(f, "sine", 0.4, 0.1, i * 0.1)),
    undo: () => playTone(220, "triangle", 0.15, 0.05),
    nav: () => playTone(880, "sine", 0.05, 0.05)
};

// --- 3. LEVEL DATA ---
const LEVELS = [
    { id: 0, size: 3, clicks: [4], name: "NODE_ALPHA", par: 1, hint: "Center dominance." },
    { id: 1, size: 3, clicks: [0, 8], name: "NODE_BETA", par: 2, hint: "Corner propagation." },
    { id: 2, size: 3, clicks: [1, 3, 5, 7], name: "NODE_GAMMA", par: 4, hint: "Symmetry cancels chaos." },
    { id: 3, size: 4, clicks: [5, 6, 9, 10], name: "NODE_DELTA", par: 4, hint: "The 4x4 core behaves differently." },
    { id: 4, size: 4, clicks: [0, 5, 10, 15], name: "NODE_EPSILON", par: 4, hint: "Diagonal stabilization." },
    { id: 5, size: 4, clicks: [0, 1, 4, 11, 14, 15], name: "NODE_ZETA", par: 6, hint: "Boundary interference." }
];

export default function NeuralGrid() {
    const [scene, setScene] = useState("boot"); // boot, menu, play, win
    const [lvIdx, setLvIdx] = useState(0);
    const [board, setBoard] = useState([]);
    const [history, setHistory] = useState([]);
    const [moves, setMoves] = useState(0);
    const [undos, setUndos] = useState(0);
    const [progress, setProgress] = useState({});
    const [locked, setLocked] = useState(false);

    const lv = LEVELS[lvIdx];

    // Load progress
    useEffect(() => {
        const saved = localStorage.getItem("neural_grid_progress");
        if (saved) { try { setProgress(JSON.parse(saved)); } catch(e) {} }
        setTimeout(() => setScene("menu"), 2500);
    }, []);

    // Save progress
    useEffect(() => {
        if (Object.keys(progress).length) localStorage.setItem("neural_grid_progress", JSON.stringify(progress));
    }, [progress]);

    // Setup Level
    const initLevel = (idx) => {
        const currentLv = LEVELS[idx];
        let b = Array(currentLv.size * currentLv.size).fill(1);
        currentLv.clicks.forEach(clickIdx => {
            const r = Math.floor(clickIdx / currentLv.size), c = clickIdx % currentLv.size;
            [clickIdx, clickIdx-1, clickIdx+1, clickIdx-currentLv.size, clickIdx+currentLv.size].forEach(j => {
                if (j >= 0 && j < b.length && Math.abs(Math.floor(j/currentLv.size) - r) + Math.abs((j%currentLv.size) - c) <= 1) b[j] ^= 1;
            });
        });
        setBoard(b); setHistory([]); setMoves(0); setUndos(0); setLocked(false);
    };

    const handleNode = (i) => {
        if (locked) return;
        SFX.click();
        const nb = [...board];
        const r = Math.floor(i / lv.size), c = i % lv.size;
        [i, i-1, i+1, i-lv.size, i+lv.size].forEach(j => {
            if (j >= 0 && j < nb.length && Math.abs(Math.floor(j/lv.size) - r) + Math.abs((j%lv.size) - c) <= 1) nb[j] ^= 1;
        });

        setHistory(prev => [...prev, board]);
        setBoard(nb);
        
        const won = nb.every(v => v === 1);
        setMoves(m => {
            const next = m + 1;
            if (won) {
                setLocked(true);
                const score = calculateEfficiency(next, undos);
                setTimeout(() => {
                    SFX.win();
                    setProgress(p => ({ ...p, [lvIdx]: Math.max(p[lvIdx] || 0, score) }));
                    setScene("win");
                }, 500);
            }
            return next;
        });
    };

    const calculateEfficiency = (m, u) => {
        return Math.max(0, Math.floor((lv.par / Math.max(m, lv.par)) * 100 - (u * 5)));
    };

    const currentEfficiency = calculateEfficiency(moves, undos);

    return (
        <div style={{ padding: 20, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <style>{styles}</style>
            <div className="scanline" />

            {/* BOOT SCENE */}
            {scene === "boot" && (
                <div style={{ marginTop: '30vh', textAlign: 'center', animation: 'fadeIn 2s' }}>
                    <div style={{ color: '#06b6d4', letterSpacing: 10, fontSize: 24, fontWeight: 'bold' }}>NEURAL_GRID</div>
                    <div style={{ color: '#333', marginTop: 10 }}>LINKING SYSTEM...</div>
                </div>
            )}

            {/* MENU / GRID SCENE */}
            {scene === "menu" && (
                <div style={{ width: '100%', maxWidth: 500, textAlign: 'center', animation: 'fadeIn 0.5s' }}>
                    <h2 style={{ letterSpacing: 5, color: '#06b6d4' }}>ARCHIVE_NODES</h2>
                    <div className="level-grid">
                        {LEVELS.map((l, i) => {
                            const isUnlocked = i === 0 || progress[i-1] !== undefined;
                            const score = progress[i];
                            return (
                                <button key={i} className="level-btn" disabled={!isUnlocked} onClick={() => { 
                                    SFX.nav(); setLvIdx(i); initLevel(i); setScene("play"); 
                                }} style={{ borderColor: score ? '#06b6d4' : '#222' }}>
                                    {i + 1}
                                    {score === 100 && <div className="level-star">★</div>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* PLAY SCENE */}
            {scene === "play" && (
                <div style={{ width: '100%', maxWidth: 450, animation: 'fadeIn 0.5s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
                        <button className="btn-util" onClick={() => { SFX.nav(); setScene("menu"); }}>← GRID</button>
                        <div style={{ textAlign: 'right' }}>
                            <div className="hud-label">Efficiency</div>
                            <div style={{ color: currentEfficiency > 80 ? '#06b6d4' : '#f59e0b', fontSize: 16 }}>{currentEfficiency}%</div>
                            <div className="efficiency-bar"><div className="efficiency-fill" style={{ width: `${currentEfficiency}%` }} /></div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: 30 }}>
                        <div className="hud-label" style={{ color: '#06b6d4' }}>{lv.name}</div>
                        <div style={{ fontSize: 11, color: '#444' }}>PAR_MOVES: {lv.par}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${lv.size}, 1fr)`, gap: 12, margin: '0 auto', width: 'fit-content' }}>
                        {board.map((v, i) => (
                            <div key={i} className="node-container">
                                <button className={`node ${v ? 'active' : ''}`} onClick={() => handleNode(i)} />
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 40, display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button className="btn-util" onClick={() => { SFX.undo(); undo(); }} disabled={history.length === 0 || locked}>UNDO</button>
                        <button className="btn-util" onClick={() => { SFX.nav(); initLevel(lvIdx); }}>RESTART</button>
                    </div>
                </div>
            )}

            {/* WIN SCENE */}
            {scene === "win" && (
                <div style={{ textAlign: 'center', marginTop: '15vh', animation: 'fadeIn 0.8s' }}>
                    <h1 style={{ color: '#06b6d4', letterSpacing: 8 }}>SIGNAL_STABLE</h1>
                    <div style={{ background: '#0a0a0a', border: '1px solid #222', padding: 30, borderRadius: 8, margin: '30px 0', minWidth: 300 }}>
                        <div className="hud-label">Final Efficiency</div>
                        <div style={{ fontSize: 54, color: '#fff', margin: '10px 0' }}>{currentEfficiency}%</div>
                        <div style={{ color: '#555', fontSize: 11 }}>{moves} MOVES | {undos} UNDOS</div>
                    </div>
                    <div style={{ display: 'flex', gap: 15, justifyContent: 'center' }}>
                        <button className="btn-util" onClick={() => setScene("menu")}>GRID</button>
                        <button className="btn-util" style={{ background: '#06b6d4', color: '#000', border: 'none' }} onClick={() => {
                            if (lvIdx + 1 < LEVELS.length) { setLvIdx(lvIdx + 1); initLevel(lvIdx + 1); setScene("play"); }
                            else { setScene("menu"); }
                        }}>NEXT_LEVEL</button>
                    </div>
                </div>
            )}
        </div>
    );

    function undo() {
        if (!history.length) return;
        setBoard(history[history.length - 1]);
        setHistory(prev => prev.slice(0, -1));
        setMoves(m => Math.max(0, m - 1));
        setUndos(u => u + 1);
    }
}