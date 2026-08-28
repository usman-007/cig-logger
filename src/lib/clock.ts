"use client";

/**
 * A single ticking clock shared by the whole app, kept outside React so that
 * reading "now" during render is a pure snapshot read rather than a Date.now()
 * call. Server renders see 0 — components treat that as "not hydrated yet".
 */
class Clock {
  private now = 0;
  private intervalId: number | null = null;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  getSnapshot = () => this.now;

  getServerSnapshot = () => 0;

  private tick = () => {
    this.now = Date.now();
    for (const listener of this.listeners) listener();
  };

  private onVisibilityChange = () => {
    if (document.visibilityState === "visible") this.tick();
  };

  private start() {
    this.now = Date.now();
    this.intervalId = window.setInterval(this.tick, 1000);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  private stop() {
    if (this.intervalId !== null) window.clearInterval(this.intervalId);
    this.intervalId = null;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }
}

export const clock = new Clock();
