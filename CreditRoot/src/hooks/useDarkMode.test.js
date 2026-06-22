import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDarkMode } from "./useDarkMode";

// Mock localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem(key) {
      return store[key] || null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

describe("useDarkMode", () => {
  let savedLocalStorage;
  let savedMatchMedia;

  beforeEach(() => {
    // Save originals
    savedLocalStorage = global.localStorage;
    savedMatchMedia = global.window.matchMedia;

    // Replace with mocks
    global.localStorage = mockLocalStorage;
  });

  afterEach(() => {
    // Restore originals
    global.localStorage = savedLocalStorage;
    global.window.matchMedia = savedMatchMedia;
    // Clean up DOM
    document.documentElement.classList.remove("dark");
  });

  describe("initialization from localStorage", () => {
    it("initializes to true when ms-dark-mode is 'true'", () => {
      mockLocalStorage.setItem("ms-dark-mode", "true");

      const { result } = renderHook(() => useDarkMode());

      expect(result.current.dark).toBe(true);
    });

    it("initializes to false when ms-dark-mode is 'false'", () => {
      mockLocalStorage.setItem("ms-dark-mode", "false");

      const { result } = renderHook(() => useDarkMode());

      expect(result.current.dark).toBe(false);
    });
  });

  describe("fallback to matchMedia", () => {
    it("falls back to matchMedia when no localStorage value (dark mode)", () => {
      mockLocalStorage.removeItem("ms-dark-mode");

      global.window.matchMedia = (query) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      });

      const { result } = renderHook(() => useDarkMode());

      expect(result.current.dark).toBe(true);
    });

    it("falls back to matchMedia when no localStorage value (light mode)", () => {
      mockLocalStorage.removeItem("ms-dark-mode");

      global.window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      });

      const { result } = renderHook(() => useDarkMode());

      expect(result.current.dark).toBe(false);
    });
  });

  describe("toggle behavior", () => {
    it("toggle flips dark from false to true", () => {
      mockLocalStorage.removeItem("ms-dark-mode");

      global.window.matchMedia = () => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      });

      const { result } = renderHook(() => useDarkMode());

      expect(result.current.dark).toBe(false);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.dark).toBe(true);
    });

    it("toggle flips dark from true to false", () => {
      mockLocalStorage.setItem("ms-dark-mode", "true");

      const { result } = renderHook(() => useDarkMode());

      expect(result.current.dark).toBe(true);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.dark).toBe(false);
    });
  });

  describe("DOM class toggling", () => {
    it("adds 'dark' class when dark is true", () => {
      mockLocalStorage.setItem("ms-dark-mode", "true");

      renderHook(() => useDarkMode());

      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("removes 'dark' class when dark is false", () => {
      mockLocalStorage.setItem("ms-dark-mode", "false");

      renderHook(() => useDarkMode());

      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("toggles 'dark' class on toggle()", () => {
      mockLocalStorage.removeItem("ms-dark-mode");

      global.window.matchMedia = () => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      });

      const { result } = renderHook(() => useDarkMode());

      expect(document.documentElement.classList.contains("dark")).toBe(false);

      act(() => {
        result.current.toggle();
      });

      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  describe("localStorage persistence", () => {
    it("writes new value to localStorage after toggle", () => {
      mockLocalStorage.setItem("ms-dark-mode", "false");

      const { result } = renderHook(() => useDarkMode());

      expect(mockLocalStorage.getItem("ms-dark-mode")).toBe("false");

      act(() => {
        result.current.toggle();
      });

      expect(mockLocalStorage.getItem("ms-dark-mode")).toBe("true");
    });
  });
});
