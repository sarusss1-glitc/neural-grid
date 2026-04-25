import React, { useState, useEffect } from "react";

// --- CSS STYLES ---
const styles = `
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(6, 182, 212, 0); } 100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); } }
@keyframes scanline { 0% { top: 0%; } 100% { top: 100%; } }

body { margin: 0; background: #020202; color: #fff; font-family: monospace; overflow: hidden; user-select: none; }
.scanline { position: fixed; top: 0; left: 0; width: 100%; height: 2px; background: rgba(6, 182, 212, 0.1); animation: scanline 4s linear infinite; pointer-events: none; }
.btn-util { background: #111; border: 1px solid #333; color: #888; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: 0.2s; font-weight: bold; }
.btn-util:hover:not(:disabled) { border-color: #06b6d4; color: #fff; }
.node-container { position: relative; width: 65px; height: 65px; }
.node { width: 100%; height: 100%; border-radius: 50%; cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 2px solid #222; background: #0a0a0a; }
.node.active { background: #06b6d4; border-color: #06b6d4; box-shadow: 0 0 15px rgba(6, 182, 212, 0.4); }
.node.hint { animation: pulse 1.5s infinite; border-color: #06b6d4; }
.hud-label { color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
.efficiency-bar { height: 4px; background: #222; border-radius: 2px; margin-top: 4px; overflow: hidden; }
.efficiency-fill { height: 100%; background: #06b6d4; transition: width 0.5s ease; }
`;

// --- AUDIO ENGINE ---
let _ac = null;
const ac = () => { if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)(); return _ac; };
function playTone(f, type = "sine", dur = 0.1, vol = 0.1) {
    try {
        const ctx = ac(); if (ctx.state === 'suspended') ctx.resume();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.start(); o.stop(ctx.currentTime + dur + 0.1);
    } catch(e) {}
}

const SFX = {
    click: () => playTone(440, "sine", 0.08),
    win: () => [523, 659, 784].forEach((f, i) => playTone(f, "sine", 0.3, 0.1, i * 0.1)),
    undo: () => playTone(220, "triangle", 0.1, 0.05)
};

// --- LEVEL DATA ---
const LEVELS = [
    { id: 1, size: 3, clicks: [4], name: "NEURAL_01", par: 1, hint: "Focus on the core." },
    { id: 2, size: 3, clicks: [0, 8], name: "NEURAL_02", par: 2, hint: "Polar nodes affect edges." },
    { id: 3, size: 3, clicks: [1, 3, 5, 7], name: "NEURAL_03", par: 4, hint: "Cross-interference creates balance." },
    { id: 4, size: 4, clicks: [5, 10], name: "NEURAL_04", par: 2, hint: "4x4 grids require symmetric thinking." },
    { id: 5, size: 4, clicks: [0, 3, 12, 15], name: "NEURAL_05", par: 4, hint: "Stabilize the boundaries first." }
];

export default function App() {
    const [lvIdx, setLvIdx] = useState(0);
    const [board, setBoard] = useState([]);
    const [history, setHistory] = useState([]);
    const [moves, setMoves] = useState(0);
    const [undos, setUndos] = useState(0);
    const [scene, setScene] = useState("boot");
    const [locked, setLocked] = useState(false);

    const lv = LEVELS[lvIdx];

    // Initialize Level
    useEffect(() => {
        if (scene === "play") {
            let b = Array(lv.size * lv.size).fill(1);
            lv.clicks.forEach(idx => {
                const row = Math.floor(idx / lv.size), col = idx % lv.size;
                [idx, idx-1, idx+1, idx-lv.size, idx+lv.size].forEach(j => {
                    if (j >= 0 && j < b.length && Math.abs(Math.floor(j / lv.size) - row) + Math.abs((j % lv.size) - col) <= 1) b[j] ^= 1;
                });
            });
            setBoard(b); setHistory([]); setMoves(0); setUndos(0);
        }
    }, [lvIdx, scene]);

    const handleNode = (i) => {
        if (locked) return;
        SFX.click();
        const nb = [...board];
        const row = Math.floor(i / lv.size), col = i % lv.size;
        [i, i-1, i+1, i-lv.size, i+lv.size].forEach(j => {
            if (j >= 0 && j < nb.length && Math.abs(Math.floor(j / lv.size) - row) + Math.abs((j % lv.size) - col) <= 1) nb[j] ^= 1;
        });

        setHistory(prev => [...prev, board]);
        setBoard(nb);
        
        const won = nb.every(v => v === 1);
        setMoves(m => {
            const next = m + 1;
            if (won) { setLocked(true); setTimeout(() => { SFX.win(); setScene("win"); setLocked(false); }, 400); }
            return next;
        });
    };

    const undo = () => {
        if (history.length === 0) return;
        SFX.undo();
        setBoard(history[history.length - 1]);
        setHistory(prev => prev.slice(0, -1));
        setMoves(m => Math.max(0, m - 1));
        setUndos(u => u + 1);
    };

    // Efficiency Calculation: (PAR / MOVES) * Penalty for Undos
    const efficiency = Math.max(0, Math.floor((lv.par / Math.max(moves, lv.par)) * 100 - (undos * 5)));

    return (
        <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh' }}>
            <style>{styles}</style>
            <div className="scanline" />

            {scene === "boot" && (
                <div style={{ textAlign: 'center', marginTop: '20vh' }}>
                    <h2 style={{ color: '#06b6d4', letterSpacing: 4 }}>NEURAL_GRID_v1.0</h2>
                    <button className="btn-util" style={{ marginTop: 20 }} onClick={() => setScene("play")}>INITIALIZE LINK</button>
                </div>
            )}

            {scene === "play" && (
                <div style={{ maxWidth: 400, width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40 }}>
                        <div>
                            <div className="hud-label">Efficiency</div>
                            <div style={{ fontSize: 18, color: efficiency > 80 ? '#06b6d4' : '#f59e0b' }}>{efficiency}%</div>
                            <div className="efficiency-bar"><div className="efficiency-fill" style={{ width: `${efficiency}%` }} /></div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div className="hud-label">Signal_Level</div>
                            <div style={{ fontSize: 18 }}>{lv.name}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${lv.size}, 1fr)`, gap: 15, width: 'fit-content', margin: '0 auto' }}>
                        {board.map((v, i) => (
                            <div key={i} className="node-container">
                                <button className={`node ${v ? 'active' : ''}`} onClick={() => handleNode(i)} />
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 50, display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button className="btn-util" onClick={undo} disabled={history.length === 0}>UNDO_STEP</button>
                        <button className="btn-util" onClick={() => setScene("play")}>RECALIBRATE</button>
                    </div>
                </div>
            )}

            {scene === "win" && (
                <div style={{ textAlign: 'center', marginTop: '15vh' }}>
                    <h1 style={{ color: '#06b6d4', letterSpacing: 10 }}>LINK_STABLE</h1>
                    <div style={{ background: '#0a0a0a', border: '1px solid #222', padding: 25, borderRadius: 8, margin: '20px 0' }}>
                        <div className="hud-label">Final Elegance Score</div>
                        <div style={{ fontSize: 48, margin: '10px 0' }}>{efficiency}%</div>
                        <div style={{ color: '#555', fontSize: 12 }}>{moves} MOVES | {undos} UNDOS</div>
                    </div>
                    <button className="btn-util" style={{ padding: '12px 30px' }} onClick={() => { 
                        if (lvIdx + 1 < LEVELS.length) { setLvIdx(lvIdx + 1); setScene("play"); }
                        else { setLvIdx(0); setScene("boot"); }
                    }}>
                        NEXT_NODE →
                    </button>
                </div>
            )}
        </div>
    );
}