"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface Slip {
  id: string;
  text: string;
  drawn: boolean;
}

interface TombolaState {
  slips: Slip[];
  drawnSlip: Slip | null;
}

export interface ShareableState {
  t1: string[];
  t2: string[];
  n1?: string;
  n2?: string;
  draws?: number;
  title?: string;
  seed?: number;
}

// Seeded random number generator (mulberry32)
function createSeededRandom(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export default function TombolaClient() {
  const [tombola1, setTombola1] = useState<TombolaState>({
    slips: [],
    drawnSlip: null,
  });
  const [tombola2, setTombola2] = useState<TombolaState>({
    slips: [],
    drawnSlip: null,
  });
  const [input1, setInput1] = useState("");
  const [input2, setInput2] = useState("");
  const [note1, setNote1] = useState("");
  const [note2, setNote2] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [maxDraws, setMaxDraws] = useState<number | null>(null);
  const [drawCount, setDrawCount] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawKey, setDrawKey] = useState(0);
  const [ejectingSlips, setEjectingSlips] = useState<{
    slip1: Slip | null;
    slip2: Slip | null;
  }>({ slip1: null, slip2: null });
  const [linkCopied, setLinkCopied] = useState(false);
  const [isFromLink, setIsFromLink] = useState(false);
  const [displayTitle, setDisplayTitle] = useState("");
  const [seededRandom, setSeededRandom] = useState<(() => number) | null>(null);

  const drum1Ref = useRef<HTMLDivElement>(null);
  const drum2Ref = useRef<HTMLDivElement>(null);

  // Parse URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("s");
    if (encoded) {
      try {
        const decoded = JSON.parse(atob(encoded)) as ShareableState;
        if (decoded.t1?.length) {
          setTombola1({
            slips: decoded.t1.map((text) => ({
              id: crypto.randomUUID(),
              text,
              drawn: false,
            })),
            drawnSlip: null,
          });
        }
        if (decoded.t2?.length) {
          setTombola2({
            slips: decoded.t2.map((text) => ({
              id: crypto.randomUUID(),
              text,
              drawn: false,
            })),
            drawnSlip: null,
          });
        }
        if (decoded.n1) setNote1(decoded.n1);
        if (decoded.n2) setNote2(decoded.n2);
        if (decoded.draws) setMaxDraws(decoded.draws);
        if (decoded.title) setDisplayTitle(decoded.title);
        if (decoded.seed !== undefined) {
          setSeededRandom(() => createSeededRandom(decoded.seed!));
        }
        setIsFromLink(true);
      } catch {
        // Invalid encoded state, ignore
      }
    }
  }, []);

  const generateShareableLink = useCallback(() => {
    const state: ShareableState = {
      t1: tombola1.slips.map((s) => s.text),
      t2: tombola2.slips.map((s) => s.text),
    };
    if (note1.trim()) state.n1 = note1.trim();
    if (note2.trim()) state.n2 = note2.trim();
    if (maxDraws && maxDraws > 0) state.draws = maxDraws;
    if (linkTitle.trim()) state.title = linkTitle.trim();
    // Generate a random seed for deterministic draws
    state.seed = Math.floor(Math.random() * 2147483647);

    const encoded = btoa(JSON.stringify(state));
    const url = `${window.location.origin}${window.location.pathname}?s=${encoded}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [tombola1.slips, tombola2.slips, note1, note2, maxDraws, linkTitle]);

  const addSlip = useCallback(
    (tombolaNum: 1 | 2) => {
      const input = tombolaNum === 1 ? input1 : input2;
      const setTombola = tombolaNum === 1 ? setTombola1 : setTombola2;
      const setInput = tombolaNum === 1 ? setInput1 : setInput2;

      if (!input.trim()) return;

      const newSlip: Slip = {
        id: crypto.randomUUID(),
        text: input.trim(),
        drawn: false,
      };

      setTombola((prev) => ({
        ...prev,
        slips: [...prev.slips, newSlip],
      }));
      setInput("");
    },
    [input1, input2]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, tombolaNum: 1 | 2) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addSlip(tombolaNum);
      }
    },
    [addSlip]
  );

  const removeSlip = useCallback((tombolaNum: 1 | 2, slipId: string) => {
    const setTombola = tombolaNum === 1 ? setTombola1 : setTombola2;
    setTombola((prev) => ({
      ...prev,
      slips: prev.slips.filter((s) => s.id !== slipId),
    }));
  }, []);

  const getRemainingSlips = (tombola: TombolaState) =>
    tombola.slips.filter((s) => !s.drawn);

  const hasSlipsRemaining =
    getRemainingSlips(tombola1).length > 0 ||
    getRemainingSlips(tombola2).length > 0;

  const drawsRemaining = maxDraws === null ? null : maxDraws - drawCount;
  const canDraw = hasSlipsRemaining && (drawsRemaining === null || drawsRemaining > 0);

  const drawSlips = useCallback(() => {
    if (isDrawing || !canDraw) return;

    setIsDrawing(true);

    // Add spinning class
    drum1Ref.current?.classList.add("drum-spinning");
    drum2Ref.current?.classList.add("drum-spinning");

    // Determine what will be drawn
    const remaining1 = getRemainingSlips(tombola1);
    const remaining2 = getRemainingSlips(tombola2);

    // Use seeded random if available (from shared link), otherwise use Math.random
    const random = seededRandom || Math.random;

    let drawn1: Slip | null = null;
    let drawn2: Slip | null = null;

    if (remaining1.length > 0) {
      const randomIndex = Math.floor(random() * remaining1.length);
      drawn1 = remaining1[randomIndex];
    }

    if (remaining2.length > 0) {
      const randomIndex = Math.floor(random() * remaining2.length);
      drawn2 = remaining2[randomIndex];
    }

    // After spin animation, show ejecting slips
    setTimeout(() => {
      setEjectingSlips({ slip1: drawn1, slip2: drawn2 });

      // After eject animation, update state and show results
      setTimeout(() => {
        setEjectingSlips({ slip1: null, slip2: null });
        setDrawKey((k) => k + 1);
        setDrawCount((c) => c + 1);

        if (drawn1) {
          setTombola1((prev) => ({
            ...prev,
            slips: prev.slips.map((s) =>
              s.id === drawn1!.id ? { ...s, drawn: true } : s
            ),
            drawnSlip: drawn1,
          }));
        }

        if (drawn2) {
          setTombola2((prev) => ({
            ...prev,
            slips: prev.slips.map((s) =>
              s.id === drawn2!.id ? { ...s, drawn: true } : s
            ),
            drawnSlip: drawn2,
          }));
        }

        drum1Ref.current?.classList.remove("drum-spinning");
        drum2Ref.current?.classList.remove("drum-spinning");
        setIsDrawing(false);
      }, 800);
    }, 1500);
  }, [isDrawing, canDraw, tombola1, tombola2, seededRandom]);

  const resetAll = useCallback(() => {
    setTombola1({ slips: [], drawnSlip: null });
    setTombola2({ slips: [], drawnSlip: null });
    setInput1("");
    setInput2("");
    setNote1("");
    setNote2("");
    setLinkTitle("");
    setMaxDraws(null);
    setDrawCount(0);
    setDrawKey(0);
    setIsFromLink(false);
    setDisplayTitle("");
  }, []);

  const resetDrawn = useCallback(() => {
    setTombola1((prev) => ({
      slips: prev.slips.map((s) => ({ ...s, drawn: false })),
      drawnSlip: null,
    }));
    setTombola2((prev) => ({
      slips: prev.slips.map((s) => ({ ...s, drawn: false })),
      drawnSlip: null,
    }));
    setDrawCount(0);
    setDrawKey(0);
  }, []);

  return (
    <div className="min-h-screen py-8 px-4 sm:py-12 sm:px-6">
      {/* Header */}
      <header className="text-center mb-12 sm:mb-16 flourish">
        <h1
          className="text-5xl sm:text-7xl font-black tracking-tight mb-3"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--burgundy)",
            textShadow:
              "3px 3px 0 var(--gold), 5px 5px 10px rgba(44, 24, 16, 0.2)",
          }}
        >
          {displayTitle || "TOMBOLOR"}
        </h1>
        <p
          className="text-xl sm:text-2xl italic"
          style={{ color: "var(--burgundy-dark)" }}
        >
          två trummor &mdash; ett öde
        </p>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto">
        {/* Tombolas grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 mb-12">
          {/* Tombola 1 */}
          <TombolaDrum
            title="Tombola I"
            note={note1}
            setNote={setNote1}
            tombola={tombola1}
            input={input1}
            setInput={setInput1}
            onAddSlip={() => addSlip(1)}
            onRemoveSlip={(id) => removeSlip(1, id)}
            onKeyDown={(e) => handleKeyDown(e, 1)}
            drumRef={drum1Ref}
            ejectingSlip={ejectingSlips.slip1}
            isFromLink={isFromLink}
          />

          {/* Tombola 2 */}
          <TombolaDrum
            title="Tombola II"
            note={note2}
            setNote={setNote2}
            tombola={tombola2}
            input={input2}
            setInput={setInput2}
            onAddSlip={() => addSlip(2)}
            onRemoveSlip={(id) => removeSlip(2, id)}
            onKeyDown={(e) => handleKeyDown(e, 2)}
            drumRef={drum2Ref}
            ejectingSlip={ejectingSlips.slip2}
            isFromLink={isFromLink}
          />
        </div>

        {/* Draw button */}
        <div className="text-center mb-12">
          {/* Draw counter */}
          {maxDraws !== null && (
            <p
              className="mb-4 text-lg font-semibold"
              style={{ color: "var(--burgundy)" }}
            >
              Dragning {drawCount + 1} av {maxDraws}
              {drawsRemaining === 0 && " (alla dragningar gjorda)"}
            </p>
          )}

          <button
            onClick={drawSlips}
            disabled={!canDraw || isDrawing}
            className="golden-button px-16 py-5 text-2xl sm:text-4xl font-black rounded-xl uppercase tracking-widest"
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: canDraw ? "var(--burgundy-dark)" : "#666",
            }}
          >
            {isDrawing ? "Snurrar..." : "Dra Lott!"}
          </button>

          {!canDraw && tombola1.slips.length + tombola2.slips.length > 0 && (
            <p
              className="mt-6 text-xl italic"
              style={{ color: "var(--burgundy)" }}
            >
              {drawsRemaining === 0 ? "Alla dragningar har gjorts!" : "Alla lotter har dragits!"}
            </p>
          )}
        </div>

        {/* Results display */}
        {(tombola1.drawnSlip || tombola2.drawnSlip) && (
          <div
            key={drawKey}
            className="result-container rounded-xl p-8 sm:p-12 mb-10"
          >
            <h2
              className="text-3xl sm:text-4xl font-bold text-center mb-8"
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                color: "var(--burgundy)",
              }}
            >
              Vinnande Lotter
            </h2>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-8 sm:gap-16">
              {tombola1.drawnSlip && (
                <DrawnSlipDisplay
                  label="Tombola I"
                  slip={tombola1.drawnSlip}
                />
              )}
              {tombola1.drawnSlip && tombola2.drawnSlip && (
                <span
                  className="text-5xl font-black"
                  style={{
                    color: "var(--gold)",
                    textShadow: "2px 2px 4px rgba(0,0,0,0.2)",
                  }}
                >
                  &amp;
                </span>
              )}
              {tombola2.drawnSlip && (
                <DrawnSlipDisplay
                  label="Tombola II"
                  slip={tombola2.drawnSlip}
                />
              )}
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          {!isFromLink && (
            <button
              onClick={resetDrawn}
              className="px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
              style={{
                background: "var(--cream-light)",
                border: "2px solid var(--burgundy)",
                color: "var(--burgundy)",
              }}
            >
              Återställ Dragningar
            </button>
          )}
          <button
            onClick={resetAll}
            className="px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
            style={{
              background: "var(--burgundy)",
              color: "var(--cream)",
            }}
          >
            Rensa Allt
          </button>
        </div>

        {/* History of drawn slips */}
        {(tombola1.slips.some((s) => s.drawn) ||
          tombola2.slips.some((s) => s.drawn)) && (
          <div className="mt-10 text-center">
            <h3
              className="text-xl font-bold mb-4"
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                color: "var(--burgundy)",
              }}
            >
              Tidigare Dragna
            </h3>
            <div className="flex flex-wrap justify-center gap-2">
              {tombola1.slips
                .filter((s) => s.drawn)
                .map((slip) => (
                  <span
                    key={slip.id}
                    className="px-3 py-1 rounded text-sm"
                    style={{
                      background: "rgba(114, 47, 55, 0.1)",
                      color: "var(--burgundy)",
                      textDecoration: "line-through",
                    }}
                  >
                    I: {slip.text}
                  </span>
                ))}
              {tombola2.slips
                .filter((s) => s.drawn)
                .map((slip) => (
                  <span
                    key={slip.id}
                    className="px-3 py-1 rounded text-sm"
                    style={{
                      background: "rgba(201, 162, 39, 0.15)",
                      color: "var(--burgundy)",
                      textDecoration: "line-through",
                    }}
                  >
                    II: {slip.text}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Create shareable link section - only show when not loaded from link */}
        {!isFromLink && (tombola1.slips.length > 0 || tombola2.slips.length > 0) && (
          <div className="mt-12 p-6 rounded-xl text-center" style={{ background: "var(--cream-light)", border: "2px solid var(--burgundy)" }}>
            <h3
              className="text-xl font-bold mb-4"
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                color: "var(--burgundy)",
              }}
            >
              Dela Tombolan
            </h3>
            <div className="flex flex-col items-center gap-4 mb-4">
              <input
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Titel (visas i länkförhandsgranskning)"
                className="vintage-input px-4 py-2 rounded-lg w-full max-w-md"
              />
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <label className="flex items-center gap-3" style={{ color: "var(--burgundy-dark)" }}>
                  <span className="font-semibold">Antal dragningar:</span>
                  <input
                    type="range"
                    min="1"
                    max={Math.max(tombola1.slips.length, tombola2.slips.length, 10)}
                    value={maxDraws ?? Math.max(tombola1.slips.length, tombola2.slips.length, 1)}
                    onChange={(e) => setMaxDraws(parseInt(e.target.value))}
                    className="w-32"
                    style={{ accentColor: "var(--burgundy)" }}
                  />
                  <span className="font-bold w-8">{maxDraws ?? Math.max(tombola1.slips.length, tombola2.slips.length, 1)}</span>
                </label>
                <button
                  onClick={generateShareableLink}
                  className="px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
                  style={{
                    background: "var(--burgundy)",
                    color: "var(--cream)",
                  }}
                >
                  {linkCopied ? "Länk kopierad!" : "Kopiera länk"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TombolaDrumProps {
  title: string;
  note: string;
  setNote: (value: string) => void;
  tombola: TombolaState;
  input: string;
  setInput: (value: string) => void;
  onAddSlip: () => void;
  onRemoveSlip: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  drumRef: React.RefObject<HTMLDivElement | null>;
  ejectingSlip: Slip | null;
  isFromLink: boolean;
}

function TombolaDrum({
  title,
  note,
  setNote,
  tombola,
  input,
  setInput,
  onAddSlip,
  onRemoveSlip,
  onKeyDown,
  drumRef,
  ejectingSlip,
  isFromLink,
}: TombolaDrumProps) {
  const remainingSlips = tombola.slips.filter((s) => !s.drawn);

  return (
    <div className="flex flex-col items-center">
      <h2
        className="text-2xl sm:text-3xl font-bold text-center mb-2"
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: "var(--burgundy)",
        }}
      >
        {title}
      </h2>

      {/* Note - editable when not from link, display only when from link */}
      {isFromLink ? (
        note && (
          <p
            className="text-lg italic text-center mb-4"
            style={{ color: "var(--burgundy-dark)" }}
          >
            {note}
          </p>
        )
      ) : (
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notering (valfritt)"
          className="vintage-input px-3 py-1 rounded text-center text-sm mb-4 w-48"
          style={{ fontStyle: "italic" }}
        />
      )}

      {/* Input area - hidden when loaded from link */}
      {!isFromLink && (
        <div className="flex gap-2 mb-6 w-full max-w-sm">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Skriv lottens text..."
            className="vintage-input flex-1 px-4 py-3 rounded-lg text-lg"
          />
          <button
            onClick={onAddSlip}
            disabled={!input.trim()}
            className="add-button px-4 py-3 rounded-lg font-bold text-xl"
            style={{
              color: input.trim() ? "var(--burgundy-dark)" : "#888",
            }}
          >
            +
          </button>
        </div>
      )}

      {/* The drum */}
      <div className="tombola-drum-container w-full max-w-md px-8 pb-10 relative">
        {/* Ejecting slip animation */}
        {ejectingSlip && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 z-30 animate-eject">
            <div
              className="paper-slip px-4 py-2 rounded text-lg font-bold"
              style={{ color: "var(--ink)" }}
            >
              {ejectingSlip.text}
            </div>
          </div>
        )}

        <div ref={drumRef} className="tombola-drum">
          {/* Metal caps on sides */}
          <div className="drum-cap-left" />
          <div className="drum-cap-right" />

          {/* Crank handle */}
          <div className="drum-handle">
            <div className="handle-arm">
              <div className="handle-grip" />
            </div>
          </div>

          {/* The cage */}
          <div className="drum-cage">
            {/* Interior with slips */}
            <div className="drum-interior">
              {remainingSlips.length === 0 ? (
                <p
                  className="text-base italic text-center"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  {tombola.slips.length === 0 ? "Lägg till lotter..." : "Tom!"}
                </p>
              ) : (
                remainingSlips.map((slip, index) => {
                  const rotation = ((index * 37) % 30) - 15;
                  return (
                    <div
                      key={slip.id}
                      className={`paper-slip px-2 py-1 rounded ${!isFromLink ? "cursor-pointer group" : ""}`}
                      style={
                        {
                          transform: `rotate(${rotation}deg)`,
                          "--rot": `${rotation}deg`,
                        } as React.CSSProperties
                      }
                      onClick={!isFromLink ? () => onRemoveSlip(slip.id) : undefined}
                      title={!isFromLink ? "Klicka för att ta bort" : undefined}
                    >
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--ink)" }}
                      >
                        {slip.text}
                      </span>
                      {!isFromLink && (
                        <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 text-xs">
                          ×
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Stand legs */}
          <div className="drum-stand">
            <div className="stand-leg" />
            <div className="stand-leg" />
          </div>
        </div>
      </div>

      {/* Slip count */}
      <div
        className="text-center mt-4 text-base font-semibold"
        style={{ color: "var(--burgundy)" }}
      >
        {remainingSlips.length} av {tombola.slips.length} lotter kvar
      </div>
    </div>
  );
}

interface DrawnSlipDisplayProps {
  label: string;
  slip: Slip;
}

function DrawnSlipDisplay({ label, slip }: DrawnSlipDisplayProps) {
  return (
    <div className="text-center animate-reveal">
      <p
        className="text-base font-semibold mb-3 uppercase tracking-wide"
        style={{ color: "var(--burgundy)" }}
      >
        {label}
      </p>
      <div
        className="result-ticket px-10 py-6 rounded-lg animate-float"
        style={{ minWidth: "140px" }}
      >
        <span
          className="text-3xl sm:text-4xl font-black block"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--ink)",
          }}
        >
          {slip.text}
        </span>
      </div>
    </div>
  );
}
