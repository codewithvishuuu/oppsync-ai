"use client";

import { useEffect, useRef, useState } from "react";
import { MASCOT_EVENT, type MascotState } from "./mascotEvents";

/**
 * Interactive 3-layer mascot rig.
 *
 * - Idle: CSS breathing on .mascot-idle (barely visible, -1px).
 * - Blink: randomized 3-6s, rare double blink, scaleY on the eye images.
 * - Cursor follow: eyes lead (±7px x / ±4px y), body follows much smaller
 *   (±2.5px / ±1.5px / ≤1°). All targets are lerped in one rAF loop — no
 *   per-move React renders, no jitter, loop stops when settled.
 * - Hover: lift -2px, scale 1.01 (mouse only).
 * - States via the mascotEvents interface: scan / opportunity-found /
 *   approved, all returning to idle. Pointer work is refs+styles only.
 * - Reduced motion: nothing moves, no blink, no timers.
 * - Touch: no cursor follow; idle + blink + state animations stay.
 */

const FALLBACK = "/oppsync-mascot-peek.png";
const LAYERS = [
  "/oppsync-mascot/body.png",
  "/oppsync-mascot/left-eye.png",
  "/oppsync-mascot/right-eye.png",
] as const;

const EYE_X = 7; // max eye translation, px
const EYE_Y = 4;
const BODY_X = 2.5; // body follows much less than the eyes
const BODY_Y = 1.5;
const BODY_ROT = 1; // deg

type Rig = {
  pointer: { x: number; y: number };
  pointerIn: boolean;
  hover: boolean;
  state: MascotState;
  // current values
  ex: number; ey: number;
  bx: number; by: number; rot: number; lift: number; scale: number; widen: number;
  // targets
  tex: number; tey: number;
  tbx: number; tby: number; trot: number;
  liftBase: number; scaleBase: number;
  hoverLift: number; hoverScale: number;
  stateLift: number; stateRot: number; stateWiden: number; stateEyeY: number;
  raf: number;
  running: boolean;
};

export default function MascotRig() {
  const [layersOk, setLayersOk] = useState(true);
  const peekRef = useRef<HTMLSpanElement | null>(null);
  const bodyRef = useRef<HTMLSpanElement | null>(null);
  const eyeLRef = useRef<HTMLSpanElement | null>(null);
  const eyeRRef = useRef<HTMLSpanElement | null>(null);
  const blinkLRef = useRef<HTMLImageElement | null>(null);
  const blinkRRef = useRef<HTMLImageElement | null>(null);

  const r = useRef<Rig>({
    pointer: { x: 0, y: 0 },
    pointerIn: false,
    hover: false,
    state: "idle",
    ex: 0, ey: 0, bx: 0, by: 0, rot: 0, lift: 0, scale: 1, widen: 1,
    tex: 0, tey: 0, tbx: 0, tby: 0, trot: 0,
    liftBase: 0, scaleBase: 1,
    hoverLift: 0, hoverScale: 1,
    stateLift: 0, stateRot: 0, stateWiden: 1, stateEyeY: 0,
    raf: 0,
    running: false,
  });
  const blinkTimers = useRef<number[]>([]);
  const stateTimers = useRef<number[]>([]);

  const reduced = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- targets ---------------- */

  const pointerTargets = () => {
    const s = r.current;
    const nx = s.pointerIn ? s.pointer.x : 0;
    const ny = s.pointerIn ? s.pointer.y : 0;
    // eyes: pointer unless a state drives them
    if (s.state === "idle") {
      s.tex = nx * EYE_X;
      s.tey = ny * EYE_Y;
    }
    // body: pointer unless a state drives it
    if (s.state === "idle") {
      s.tbx = nx * BODY_X;
      s.tby = ny * BODY_Y;
      s.trot = nx * BODY_ROT;
    }
    s.hoverLift = s.hover ? -2 : 0;
    s.hoverScale = s.hover ? 1.01 : 1;
  };

  /* ---------------- rAF lerp loop ---------------- */

  const write = () => {
    const s = r.current;
    const eyeT = `translate3d(${s.ex.toFixed(2)}px, ${s.ey.toFixed(2)}px, 0) scale(${s.widen.toFixed(3)})`;
    if (eyeLRef.current) eyeLRef.current.style.transform = eyeT;
    if (eyeRRef.current) eyeRRef.current.style.transform = eyeT;
    if (bodyRef.current) {
      bodyRef.current.style.transform =
        `translate3d(${s.bx.toFixed(2)}px, ${(s.by + s.lift).toFixed(2)}px, 0) ` +
        `rotate(${s.rot.toFixed(3)}deg) scale(${s.scale.toFixed(4)})`;
    }
  };

  const tick = () => {
    const s = r.current;
    const k = 1 - Math.exp((-1 / 60) * 9); // ~9/s smoothing, frame-rate aware
    let moving = false;
    const step = (cur: number, tgt: number) => {
      const next = cur + (tgt - cur) * k;
      if (Math.abs(tgt - next) > 0.02) moving = true;
      else return tgt;
      return next;
    };

    s.ex = step(s.ex, s.tex);
    s.ey = step(s.ey, s.tey);
    s.bx = step(s.bx, s.tbx);
    s.by = step(s.by, s.tby);
    s.rot = step(s.rot, s.trot);
    s.lift = step(s.lift, s.hoverLift + s.stateLift);
    s.scale = step(s.scale, s.hoverScale);
    s.widen = step(s.widen, s.stateWiden);

    write();

    if (moving || s.state !== "idle" || s.hover) {
      s.raf = requestAnimationFrame(tick);
    } else {
      s.running = false;
      s.raf = 0;
    }
  };

  const ensureLoop = () => {
    const s = r.current;
    if (reduced()) {
      writeNeutral();
      return;
    }
    pointerTargets();
    if (!s.running) {
      s.running = true;
      s.raf = requestAnimationFrame(tick);
    }
  };

  const writeNeutral = () => {
    const s = r.current;
    s.ex = s.ey = s.bx = s.by = s.rot = s.lift = 0;
    s.scale = 1; s.widen = 1;
    write();
  };

  /* ---------------- pointer ---------------- */

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || reduced()) return;
      const s = r.current;
      const rect = hero.getBoundingClientRect();
      s.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      s.pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      s.pointerIn = true;
      ensureLoop();
    };
    const onLeave = () => {
      const s = r.current;
      s.pointerIn = false;
      s.pointer.x = 0;
      s.pointer.y = 0;
      ensureLoop();
    };

    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    return () => {
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- blink ---------------- */

  const doBlink = (double: boolean) => {
    if (reduced()) return;
    const imgs = [blinkLRef.current, blinkRRef.current].filter(Boolean) as HTMLImageElement[];
    const fire = (delay: number, hold: number) => {
      const t1 = window.setTimeout(() => {
        imgs.forEach((i) => i.classList.add("is-blink"));
        const t2 = window.setTimeout(() => imgs.forEach((i) => i.classList.remove("is-blink")), hold);
        blinkTimers.current.push(t2);
      }, delay);
      blinkTimers.current.push(t1);
    };
    fire(0, 130);
    if (double) fire(250, 120);
  };

  const scheduleBlink = () => {
    if (reduced()) return;
    const t = window.setTimeout(() => {
      doBlink(Math.random() < 0.14); // rare double blink
      scheduleBlink();
    }, 3000 + Math.random() * 3000);
    blinkTimers.current.push(t);
  };

  /* ---------------- states ---------------- */

  const clearStateTimers = () => {
    stateTimers.current.forEach((t) => window.clearTimeout(t));
    stateTimers.current = [];
  };

  const at = (ms: number, fn: () => void) => {
    stateTimers.current.push(window.setTimeout(fn, ms));
  };

  const runState = (state: MascotState) => {
    clearStateTimers();
    const s = r.current;
    s.state = state;

    if (reduced()) {
      s.state = "idle";
      writeNeutral();
      return;
    }

    if (state === "scan") {
      // eyes: LEFT -> CENTER -> RIGHT -> CENTER, ~1s, body stays calm
      s.tbx = 0; s.tby = 0; s.trot = 0;
      s.tex = -6; s.tey = 0;
      at(300, () => { s.tex = 0; ensureLoop(); });
      at(600, () => { s.tex = 6; ensureLoop(); });
      at(900, () => { s.tex = 0; ensureLoop(); });
      at(1150, () => { s.state = "idle"; pointerTargets(); ensureLoop(); });
      ensureLoop();
      return;
    }

    if (state === "opportunity-found") {
      // widen + tiny upward eyes + small lift, then back
      s.stateWiden = 1.08;
      s.stateEyeY = -3;
      s.stateLift = -3;
      s.tex = s.pointerIn ? s.pointer.x * EYE_X : 0;
      s.tey = s.stateEyeY;
      s.tbx = 0; s.tby = -1; s.trot = 0;
      at(680, () => {
        s.stateWiden = 1; s.stateEyeY = 0; s.stateLift = 0;
        s.state = "idle";
        pointerTargets();
        ensureLoop();
      });
      ensureLoop();
      return;
    }

    if (state === "approved") {
      doBlink(false);
      s.stateLift = -2.5;
      s.stateRot = -0.7;
      s.trot = s.stateRot;
      s.tby = -1; s.tbx = 0;
      at(260, () => { s.trot = 0.4; ensureLoop(); });
      at(540, () => {
        s.stateLift = 0; s.stateRot = 0;
        s.state = "idle";
        pointerTargets();
        ensureLoop();
      });
      ensureLoop();
      return;
    }

    // idle
    s.state = "idle";
    pointerTargets();
    ensureLoop();
  };

  useEffect(() => {
    const onState = (e: Event) => {
      const detail = (e as CustomEvent).detail as MascotState;
      if (detail) runState(detail);
    };
    window.addEventListener(MASCOT_EVENT, onState);
    scheduleBlink();
    return () => {
      window.removeEventListener(MASCOT_EVENT, onState);
      clearStateTimers();
      blinkTimers.current.forEach((t) => {
        window.clearTimeout(t);
      });
      blinkTimers.current = [];
      if (r.current.raf) cancelAnimationFrame(r.current.raf);
      r.current.running = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- fallback (preload/hydration race safe) ---------------- */

  useEffect(() => {
    const imgs = document.querySelectorAll<HTMLImageElement>(".mascot-layers img");
    imgs.forEach((img) => {
      if (img.complete && img.naturalWidth === 0) setLayersOk(false);
      img.addEventListener("error", () => setLayersOk(false));
    });
  }, []);

  const onPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || reduced()) return;
    r.current.hover = true;
    ensureLoop();
  };
  const onPointerLeaveHover = () => {
    r.current.hover = false;
    ensureLoop();
  };

  return (
    <span className="mascot-peek" ref={peekRef} aria-hidden="true">
      <span
        className="mascot-follow"
        ref={bodyRef}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeaveHover}
      >
        <span className="mascot-idle">
        <span className="mascot-in mascot-layers">
          {layersOk ? (
            <>
              <img
                src={LAYERS[0]}
                alt=""
                width={2171}
                height={724}
                onError={() => setLayersOk(false)}
              />
              <span className="mascot-eye mascot-eye--l" ref={eyeLRef}>
                <img
                  className="mascot-eye-img"
                  ref={blinkLRef}
                  src={LAYERS[1]}
                  alt=""
                  width={2171}
                  height={724}
                  onError={() => setLayersOk(false)}
                />
              </span>
              <span className="mascot-eye mascot-eye--r" ref={eyeRRef}>
                <img
                  className="mascot-eye-img"
                  ref={blinkRRef}
                  src={LAYERS[2]}
                  alt=""
                  width={2171}
                  height={724}
                  onError={() => setLayersOk(false)}
                />
              </span>
            </>
          ) : (
            <img
              src={FALLBACK}
              alt=""
              width={2171}
              height={724}
            />
          )}
          </span>
        </span>
      </span>
    </span>
  );
}
