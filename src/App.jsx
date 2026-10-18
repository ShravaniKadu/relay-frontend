import React, { useState, useRef, useEffect, useMemo, createContext, useContext } from "react";
import { App as CapApp } from "@capacitor/app";
import {
  LayoutGrid, Users, Phone, Inbox as InboxIcon, Contact, Megaphone, Workflow,
  Bot, BarChart3, ScrollText, Settings as SettingsIcon, Search, Bell, ChevronDown,
  Plus, X, Check, CheckCheck, Send, Paperclip, Image as ImageIcon, Video, Mic,
  Smile, MoreVertical, Play, Square, Trash2, Tag, UserCog,
  ChevronRight, ChevronLeft, Eye, Pencil, Power, LogOut, Key,
  CircleDot, Clock, Construction, ArrowDown, GitBranch, MessageCircle, Save, Menu,
  FlaskConical, Zap, ListTree, RefreshCw, AlertCircle, WifiOff, Mail, Lock, EyeOff,
  Palette, Globe, Database, Info, Archive, Accessibility as AccessIcon, User as UserIcon, Pause, Download, Activity as ActivityIcon
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList
} from "recharts";

// ============================================================
// API CLIENT — every page below calls the real FastAPI backend.
// Change API_BASE if the backend isn't running on localhost:8000.
// ============================================================
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : "http://localhost:8001/api/v1";

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function apiFetch(path, { method = "GET", body, token, params } = {}) {
  let url = `${API_BASE}${path}`;
  if (params) {
    const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
    const qs = new URLSearchParams(clean).toString();
    if (qs) url += `?${qs}`;
  }
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (networkErr) {
    // Fetch throws (not a 4xx/5xx) when the backend isn't reachable at all —
    // wrong host, server not running, CORS block. Surfaced distinctly so
    // the UI can say "can't reach the server" instead of a generic error.
    throw new ApiError("Could not reach the backend — is it running on " + API_BASE + "?", 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try { const j = await res.json(); detail = j.detail || detail; } catch { /* body wasn't JSON */ }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ============================================================
// AUTH — token lives in React state only (no localStorage/sessionStorage
// per artifact constraints), so a page refresh signs the user out. That's
// expected for this environment; a real deployment would add a refresh
// flow, not browser storage inside this sandbox.
// ============================================================
const AuthContext = createContext(null);
function useAuth() { return useContext(AuthContext); }

const AUTH_KEY = "relay_auth";
function loadAuth() { try { const v = localStorage.getItem(AUTH_KEY); return v ? JSON.parse(v) : null; } catch { return null; } }
function saveAuth(v) { try { if (v) localStorage.setItem(AUTH_KEY, JSON.stringify(v)); else localStorage.removeItem(AUTH_KEY); } catch { /* storage unavailable */ } }

function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadAuth); // { token, role, name, userId } — restored on app start

  const login = async (email, password) => {
    const data = await apiFetch("/auth/login", { method: "POST", body: { email, password } });
    const next = { token: data.access_token, role: data.role, name: data.name, userId: data.user_id };
    setAuth(next);
    saveAuth(next);
    return next;
  };
  const logout = () => { setAuth(null); saveAuth(null); };
  const setName = (name) => setAuth((a) => { if (!a) return a; const next = { ...a, name }; saveAuth(next); return next; });

  return (
    <AuthContext.Provider value={{ ...auth, isAuthed: !!auth, login, logout, setName }}>
      {children}
    </AuthContext.Provider>
  );
}

/** GET a list endpoint; refetches when path/params/token change or reload() is called. */
function useApiList(path, { params, enabled = true } = {}) {
  const { token, logout } = useAuth();
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  const [state, setState] = useState({ data: [], loading: true, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const paramsKey = JSON.stringify(params || {});

  useEffect(() => {
    if (!enabled || !token) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    apiFetch(path, { token, params }).then(
      (data) => { if (!cancelled) setState({ data, loading: false, error: null }); },
      (err) => { if (err.status === 401) { logoutRef.current(); return; } if (!cancelled) setState({ data: [], loading: false, error: err.message }); }
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, token, paramsKey, reloadKey, enabled]);

  return { ...state, reload: () => setReloadKey((k) => k + 1) };
}

// ============================================================
// DESIGN TOKENS
// ============================================================

const FONT_IMPORT = ""; // fonts are bundled via @fontsource in main.jsx (works offline)

const RESPONSIVE_CSS = `
  html, body, #root { margin: 0; min-height: 100%; }
  *, *::before, *::after { box-sizing: border-box; }
  button, input, textarea, select { max-width: 100%; }
  .relay-shell { height: 100vh; min-height: 100vh; width: 100%; }
  .relay-main { min-width: 0; min-height: 0; }
  .relay-page { min-width: 0; min-height: 0; overflow-x: auto; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .relay-topbar { min-height: 56px; }
  .relay-topbar-search { width: 320px; }
  .relay-mobile-menu-btn { display: none; }
  .relay-mobile-overlay { display: none; }
  .relay-page-header { flex-wrap: wrap; gap: 12px; }
  .relay-table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
  .relay-table-wrap table { min-width: 680px; }
  .relay-modal-card { max-width: calc(100vw - 24px) !important; }
  .relay-login-form { width: min(380px, calc(100vw - 24px)) !important; }
  .relay-auth-screen { min-height: 100dvh !important; min-height: 100vh !important; background: #16211C; }
  .relay-chart-grid { min-width: 0; }
  .relay-inbox { min-width: 0; }
  .relay-customer-panel { flex: 0 0 280px; }
  .relay-inbox-back { display: none; }
  .relay-kpi-card { min-width: 150px; }

  @media (max-width: 768px) {
    .relay-shell { height: 100dvh; min-height: 100dvh; }

    .relay-sidebar {
      position: fixed !important;
      z-index: 60;
      top: 0;
      left: 0;
      height: 100dvh !important;
      width: 280px !important;
      transform: translateX(-105%);
      box-shadow: 12px 0 30px rgba(0,0,0,0.18);
      transition: transform 0.22s ease;
    }
    .relay-sidebar.relay-sidebar-open { transform: translateX(0); }
    .relay-sidebar-collapse { display: none !important; }
    .relay-mobile-close { display: flex !important; }
    .relay-mobile-overlay {
      display: block;
      border: 0;
      padding: 0;
      position: fixed;
      inset: 0;
      z-index: 50;
      background: rgba(12, 18, 15, 0.42);
    }

    .relay-mobile-menu-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      border-radius: 7px;
      background: transparent;
      border: 1px solid transparent;
    }
    .relay-topbar {
      padding: 10px 12px !important;
      gap: 8px;
    }
    .relay-topbar-search {
      width: auto !important;
      flex: 1;
      min-width: 0;
    }
    .relay-topbar-user-details { display: none; }
    .relay-topbar-chevron { display: none; }
    .relay-topbar-actions { gap: 8px !important; }

    .relay-page {
      padding: 14px 12px !important;
    }
    .relay-page-header { margin-bottom: 14px !important; }
    .relay-page-header > div:first-child { min-width: 0; }
    .relay-page-header > div:last-child { width: 100%; }
    .relay-page-header > div:last-child > button { max-width: 100%; }

    .relay-kpi-card {
      flex: 1 1 calc(50% - 6px) !important;
      min-width: 0 !important;
    }

    .relay-chart-grid {
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 12px !important;
    }

    .relay-modal-card {
      width: calc(100vw - 24px) !important;
      max-height: 90dvh !important;
    }

    .relay-inbox {
      height: calc(100dvh - 72px) !important;
      min-height: 0 !important;
      display: block !important;
      position: relative;
    }
    .relay-inbox-list {
      width: 100% !important;
      height: 100% !important;
      max-height: none !important;
      border-right: none !important;
      border-bottom: none !important;
    }
    .relay-inbox-thread {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: #FFFFFF !important;
      z-index: 2;
    }
    .relay-inbox.relay-inbox-show-thread .relay-inbox-list { display: none !important; }
    .relay-inbox:not(.relay-inbox-show-thread) .relay-inbox-thread { display: none !important; }
    .relay-inbox .relay-customer-panel { display: none !important; }
    .relay-inbox-back { display: inline-flex !important; }
    .relay-inbox-thread .relay-thread-messages { padding-left: 12px !important; padding-right: 12px !important; }
    .relay-inbox-thread .relay-thread-composer { padding-left: 10px !important; padding-right: 10px !important; }
    .relay-inbox-thread .relay-composer-icons { gap: 0 !important; }
    .relay-inbox-thread .relay-composer-icons > button { padding: 5px !important; }
    .relay-inbox-thread .relay-thread-input { min-width: 0 !important; }

    .relay-flow-branches { flex-wrap: wrap; justify-content: center; gap: 20px !important; }
  }


  html { -webkit-text-size-adjust: 100%; }
  body { overscroll-behavior-y: none; -webkit-tap-highlight-color: transparent; }
  button, a, [role="button"] { touch-action: manipulation; }
  button { transition: transform .12s ease, background-color .15s ease, opacity .15s ease; }
  button:active:not(:disabled) { transform: scale(0.97); }
  .relay-page > * { animation: relayFade .2s ease both; }
  @keyframes relayFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .relay-page > *, button { animation: none !important; transition: none !important; } }
  .relay-kpi-card { box-shadow: 0 1px 2px rgba(20,30,25,.04), 0 6px 16px rgba(20,30,25,.05); }
  .relay-table-wrap {
    background:
      linear-gradient(to right, #fff 30%, rgba(255,255,255,0)),
      linear-gradient(to left, #fff 30%, rgba(255,255,255,0)) 100% 0,
      radial-gradient(farthest-side at 0 50%, rgba(0,0,0,.16), rgba(0,0,0,0)),
      radial-gradient(farthest-side at 100% 50%, rgba(0,0,0,.16), rgba(0,0,0,0)) 100% 0 !important;
    background-repeat: no-repeat !important;
    background-color: #fff !important;
    background-size: 40px 100%, 40px 100%, 14px 100%, 14px 100% !important;
    background-attachment: local, local, scroll, scroll !important;
  }
  .relay-bottom-nav { display: none; }
  @supports (-webkit-touch-callout: none) {
    input, select, textarea { font-size: 16px !important; }
  }
  @media (max-width: 768px) {
    .relay-topbar { padding-top: calc(10px + max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))) !important; }
    .relay-mobile-menu-btn { width: 40px; height: 40px; flex: 0 0 40px; }
    .relay-bottom-nav {
      display: flex;
      flex: 0 0 auto;
      background: #FFFFFF;
      border-top: 1px solid #DDD9D0;
      padding: 6px 4px calc(6px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)));
      z-index: 20;
    }
    .relay-bottom-nav button {
      flex: 1; min-width: 0; min-height: 48px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
      background: transparent; border: 0; border-radius: 10px;
      font-size: 10.5px; font-weight: 600; color: #5B615C; font-family: 'Inter', sans-serif;
    }
    .relay-bottom-nav button.is-active { color: #0E9461; background: #E3F4EA; }
    .relay-inbox { height: calc(100dvh - 72px - 64px - max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px))) !important; }
  }

  @media (max-width: 420px) {
    .relay-kpi-card { flex-basis: 100% !important; }
    .relay-topbar-search input { font-size: 12px !important; }
    .relay-page { padding: 12px 10px !important; }
  }

  /* ===== Dashboard look: navy sidebar, white cards, soft blue page ===== */
  .rl-side { background: linear-gradient(180deg, #0B1E47 0%, #08142F 100%); transition: width .2s ease; }
  .rl-side-brand { position: relative; display: flex; align-items: center; gap: 12px; padding: 24px 18px 22px; }
  .rl-side.is-collapsed .rl-side-brand { justify-content: center; padding-left: 0; padding-right: 0; }
  .rl-side-mark { width: 44px; height: 44px; flex: 0 0 44px; border-radius: 13px; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(145deg, #34D27A, #12A150); box-shadow: 0 8px 20px -6px rgba(34,197,94,0.6), 0 1px 0 rgba(255,255,255,0.35) inset; }
  .rl-side-name { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 23px; letter-spacing: -0.01em; color: #fff; white-space: nowrap; }
  .rl-side-name em { font-style: normal; color: #2DD4A7; }
  .rl-side-collapse { position: absolute; right: -11px; top: 34px; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: #0B1E47; border: 1px solid rgba(255,255,255,0.18); color: #AFC0E0; z-index: 10; }
  .rl-side-collapse:hover { color: #fff; border-color: rgba(255,255,255,0.4); }
  .rl-side-close { position: absolute; right: 12px; top: 26px; width: 32px; height: 32px; border-radius: 9px; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); border: 0; }
  .rl-side-nav { flex: 1; overflow-y: auto; padding: 4px 14px; }
  .rl-side-item { width: 100%; display: flex; align-items: center; gap: 14px; height: 48px; padding: 0 14px; margin-bottom: 4px; border-radius: 11px;
    text-align: left; color: #B9C6E3; border: 0; background: transparent; position: relative; font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 500; }
  .rl-side.is-collapsed .rl-side-item { justify-content: center; padding: 0; gap: 0; }
  .rl-side-item:hover { background: rgba(255,255,255,0.07); color: #fff; }
  .rl-side-item.is-active { color: #fff; font-weight: 600; background: linear-gradient(90deg, #0F6A45, #0B4F37); box-shadow: 0 1px 0 rgba(255,255,255,0.08) inset; }
  .rl-side-item:focus-visible { outline: 2px solid #2DD4A7; outline-offset: -2px; }
  .rl-side-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rl-side-badge { min-width: 24px; height: 24px; padding: 0 7px; border-radius: 999px; background: #17B26A; color: #fff; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
  .rl-side-dot { position: absolute; top: 11px; right: 15px; width: 9px; height: 9px; border-radius: 50%; background: #17B26A; box-shadow: 0 0 0 2px #0B1E47; }
  .rl-side-foot { margin: 6px 14px 18px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); }
  .rl-side-foot .rl-side-item { margin-bottom: 0; }

  .rl-top { display: flex; align-items: center; justify-content: space-between; min-height: 76px; padding: 14px 32px; background: #fff; border-bottom: 1px solid #E8EDF5; }
  .relay-topbar-search.rl-search { display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 16px; width: auto; flex: 1; max-width: 690px; background: #fff; border: 1px solid #DCE3EF; border-radius: 12px; }
  .rl-search:focus-within { border-color: #12A06B; box-shadow: 0 0 0 3px rgba(18,160,107,0.14); }
  .rl-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font-family: 'Inter', sans-serif; font-size: 14.5px; color: #1B2338; }
  .rl-search input::placeholder { color: #8A94A8; }
  .rl-bell { width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 12px; border: 0; background: transparent; }
  .rl-bell:hover { background: #F2F5FA; }
  .rl-user { display: flex; align-items: center; gap: 12px; border: 0; background: transparent; padding: 4px 6px; border-radius: 12px; }
  .rl-user:hover { background: #F2F5FA; }
  .rl-avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #0E6B46; color: #fff; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 15px; }
  .relay-topbar-user-details { display: flex; flex-direction: column; text-align: left; line-height: 1.25; }
  .rl-user-name { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600; color: #1B2338; }
  .rl-user-role { font-family: 'Inter', sans-serif; font-size: 13px; color: #7A859D; }
  .rl-pop { position: absolute; right: 0; top: 52px; background: #fff; border: 1px solid #E1E7F1; border-radius: 12px; box-shadow: 0 14px 34px rgba(20,30,70,0.16); padding: 12px; }

  .relay-page { padding: 30px 32px; }
  .rl-page-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 32px; line-height: 1.15; letter-spacing: -0.02em; color: #151C30; }
  .rl-page-desc { font-family: 'Inter', sans-serif; font-size: 16px; margin-top: 6px; color: #6A7B9B; }

  .rl-kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin-bottom: 26px; }
  .rl-kpi-grid-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .rl-kpi-grid-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .relay-kpi-card.rl-kpi { background: #fff; border: 1px solid #E6EBF3; border-radius: 14px !important; padding: 18px 20px 18px 18px; min-width: 0;
    box-shadow: 0 1px 2px rgba(20,30,70,0.04), 0 8px 22px -8px rgba(20,30,70,0.1); display: flex; flex-direction: column; gap: 14px; }
  .rl-kpi-top { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .rl-kpi-icon { width: 42px; height: 42px; flex: 0 0 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .rl-kpi-label { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 500; color: #1B2338; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rl-kpi-body { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .rl-kpi-value { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 34px; line-height: 1.1; letter-spacing: -0.02em; color: #151C30; }
  .rl-kpi-sub { margin-top: 6px; font-family: 'Inter', sans-serif; font-size: 13px; color: #6A7B9B; }
  .rl-kpi-bar { height: 8px; border-radius: 999px; background: #EDF1F7; overflow: hidden; margin-top: -2px; }
  .rl-kpi-bar i { display: block; height: 100%; border-radius: 999px; }

  .rl-panel { background: #fff; border: 1px solid #E6EBF3; border-radius: 16px; padding: 22px 24px 20px; margin-bottom: 24px;
    box-shadow: 0 1px 2px rgba(20,30,70,0.04), 0 8px 22px -10px rgba(20,30,70,0.1); }
  .rl-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .rl-panel-head h2 { margin: 0; font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 22px; letter-spacing: -0.01em; color: #151C30; }
  .rl-panel-foot { margin-top: 12px; font-family: 'Inter', sans-serif; font-size: 13px; color: #8A94A8; }
  .rl-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #EDF1F7; border-radius: 12px; }
  .rl-table { width: 100%; min-width: 720px; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .rl-table thead tr { background: #F3F6FB; }
  .rl-table th { text-align: left; padding: 14px 18px; font-size: 13px; font-weight: 600; color: #4A5876; white-space: nowrap; }
  .rl-table th span { display: inline-flex; align-items: center; gap: 8px; }
  .rl-table th svg { color: #5B6882; }
  .rl-table td { padding: 14px 18px; font-size: 14.5px; color: #1B2338; border-top: 1px solid #EDF1F7; white-space: nowrap; }
  .rl-table tbody tr:hover { background: #F8FAFD; }
  .rl-person { display: inline-flex; align-items: center; gap: 12px; }
  .rl-person-av { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; font-weight: 600; flex: 0 0 38px; }
  .rl-person-name { font-weight: 500; color: #1B2338; }

  @media (max-width: 1180px) {
    .rl-kpi-grid, .rl-kpi-grid-5, .rl-kpi-grid-6 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 768px) {
    .rl-top { min-height: 0; padding: 10px 12px; }
    .rl-search { height: 42px; }
    .rl-page-title { font-size: 26px; }
    .rl-page-desc { font-size: 14px; }
    .rl-kpi-grid { gap: 12px; margin-bottom: 20px; }
    .relay-kpi-card.rl-kpi { padding: 14px 14px 14px 14px; gap: 10px; }
    .rl-kpi-icon { width: 36px; height: 36px; flex-basis: 36px; }
    .rl-kpi-label { font-size: 13.5px; }
    .rl-kpi-value { font-size: 26px; }
    .rl-panel { padding: 16px 14px 14px; border-radius: 14px; }
    .rl-panel-head h2 { font-size: 18px; }
    .rl-side-brand { padding-top: calc(24px + env(safe-area-inset-top, 0px)); }
  }
  @media (max-width: 420px) {
    .rl-kpi-grid, .rl-kpi-grid-5, .rl-kpi-grid-6 { grid-template-columns: minmax(0, 1fr); }
    .rl-kpi-ring-hide svg { display: none; }
  }

  /* ===== Analytics ===== */
  .rl-hero-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-bottom: 22px; }
  .rl-hero { position: relative; display: flex; align-items: center; gap: 18px; min-width: 0; padding: 22px 22px 22px 20px; border-radius: 16px;
    border: 1px solid var(--bd); border-left: 4px solid var(--acc); overflow: hidden;
    background: linear-gradient(120deg, #fff 32%, var(--tint) 100%); box-shadow: 0 1px 2px rgba(20,30,70,0.04), 0 8px 22px -10px rgba(20,30,70,0.12); }
  .rl-hero::after { content: ""; position: absolute; right: -40px; bottom: -60px; width: 220px; height: 150px; border-radius: 50%; background: var(--tint); opacity: .7; filter: blur(14px); pointer-events: none; }
  .rl-hero > * { position: relative; z-index: 1; }
  .rl-hero-icon { width: 66px; height: 66px; flex: 0 0 66px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: var(--grad); box-shadow: 0 12px 24px -10px var(--acc); }
  .rl-hero-main { min-width: 0; flex: 1; }
  .rl-hero-label { font-family: 'Inter', sans-serif; font-size: 16px; color: #4A5876; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rl-hero-value { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 40px; line-height: 1.1; letter-spacing: -0.02em; color: #151C30; margin-top: 2px; }
  .rl-hero-stat { text-align: right; flex: 0 0 auto; max-width: 42%; }
  .rl-hero-stat-top { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600; color: var(--acc); }
  .rl-hero-stat-cap { font-family: 'Inter', sans-serif; font-size: 12.5px; color: #7A859D; margin-top: 3px; }

  .rl-chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
  .rl-chart-card { background: #fff; border: 1px solid #E6EBF3; border-radius: 16px; padding: 20px 22px 14px; min-width: 0;
    box-shadow: 0 1px 2px rgba(20,30,70,0.04), 0 8px 22px -10px rgba(20,30,70,0.1); }
  .rl-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
  .rl-chart-title { display: inline-flex; align-items: center; gap: 10px; font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 18px; color: #151C30; }
  .rl-chart-ico { width: 30px; height: 30px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; }
  .rl-pill-note { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500; color: #6D4BD8; background: #EEE8FD; border-radius: 8px; padding: 5px 11px; white-space: nowrap; }
  .rl-tip { background: #fff; border: 1px solid #E1E7F1; border-radius: 12px; padding: 10px 14px; box-shadow: 0 12px 28px rgba(20,30,70,0.16); font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.6; }
  .rl-tip-title { font-weight: 600; color: #1B2338; margin-bottom: 2px; }
  .recharts-legend-item-text { font-family: 'Inter', sans-serif; font-size: 13px; color: #33405C !important; }
  .rl-empty { height: 220px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 20px; font-family: 'Inter', sans-serif; font-size: 14px; color: #7A859D; }
  .rl-funnel { position: relative; width: 100%; aspect-ratio: 520 / 280; max-width: 640px; margin: 4px auto 6px; }
  .rl-funnel svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .rl-funnel-label { position: absolute; left: 67.5%; transform: translateY(-50%); display: flex; flex-direction: column; line-height: 1.25; font-family: 'Inter', sans-serif; }
  .rl-funnel-name { font-size: 12.5px; color: #4A5876; white-space: nowrap; }
  .rl-funnel-val { font-size: 15px; font-weight: 600; color: #151C30; white-space: nowrap; }
  .rl-funnel-val em { font-style: normal; font-weight: 400; font-size: 12.5px; color: #7A859D; }

  @media (max-width: 1180px) { .rl-hero-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 768px) {
    .rl-hero-grid { gap: 12px; margin-bottom: 16px; }
    .rl-hero { padding: 16px 14px; gap: 12px; }
    .rl-hero-icon { width: 52px; height: 52px; flex-basis: 52px; }
    .rl-hero-icon svg { width: 24px; height: 24px; }
    .rl-hero-value { font-size: 30px; }
    .rl-hero-label { font-size: 14px; }
    .rl-chart-grid { gap: 14px; }
    .rl-chart-card { padding: 16px 14px 10px; border-radius: 14px; }
    .rl-chart-title { font-size: 16px; }
    .rl-funnel-name { font-size: 11px; }
    .rl-funnel-val { font-size: 13px; }
    .rl-funnel-val em { font-size: 11px; }
  }
  @media (max-width: 560px) {
    .rl-hero-grid { grid-template-columns: minmax(0, 1fr); }
  }

  /* ===== Admins page ===== */
  .rl-ad-panel { position: relative; overflow: hidden; border-radius: 22px; padding: 22px 22px 24px; border: 1px solid #E3EAF6;
    background: linear-gradient(180deg, #FFFFFF 0%, #F5F8FF 100%); box-shadow: 0 1px 2px rgba(20,30,70,0.04), 0 14px 34px -14px rgba(40,60,140,0.18); }
  .rl-ad-panel::before { content: ""; position: absolute; top: -70px; right: -50px; width: 340px; height: 190px; border-radius: 50%;
    background: radial-gradient(ellipse at 40% 60%, rgba(120,150,255,0.2), rgba(150,190,255,0.08) 60%, transparent 72%); pointer-events: none; }
  .rl-ad-head { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
  .rl-ad-title { display: flex; align-items: center; gap: 12px; }
  .rl-ad-ico { width: 46px; height: 46px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center; color: #fff;
    background: linear-gradient(145deg, #4F8BFF, #7B4DF0); box-shadow: 0 10px 22px -8px rgba(91,75,216,0.6); }
  .rl-ad-count { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 36px; line-height: 1; color: #3B4BE0; letter-spacing: -0.02em; }
  .rl-ad-word { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 26px; color: #14224A; }
  .rl-ad-add { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border: 0; border-radius: 12px; color: #fff;
    font-family: 'Inter', sans-serif; font-size: 14.5px; font-weight: 600; background: linear-gradient(135deg, #4F7CFF, #6D4BD8);
    box-shadow: 0 12px 24px -10px rgba(79,124,255,0.8), 0 1px 0 rgba(255,255,255,0.3) inset; }
  .rl-ad-add:hover { filter: brightness(1.07); }
  .rl-ad-add:focus-visible { outline: 3px solid rgba(79,124,255,0.4); outline-offset: 2px; }

  .rl-table-blue { min-width: 1020px; }
  .rl-table-blue thead tr { background: linear-gradient(90deg, #E3EDFC 0%, #E2F2FB 55%, #E3F7E8 100%); }
  .rl-table-blue th { color: #1B2B55; padding: 16px 18px; }
  .rl-table-blue td { padding: 12px 18px; color: #1B2338; }
  .rl-table-blue tbody tr:nth-child(even) { background: #F8FAFF; }
  .rl-table-blue tbody tr { position: relative; transition: background-color .15s, box-shadow .15s; }
  .rl-table-blue tbody tr:hover { background: #EEF4FF; box-shadow: inset 3px 0 0 #5B4BD8; }
  .rl-ad-av { width: 42px; height: 42px; flex-basis: 42px; font-size: 14px; }
  .rl-ad-name { font-weight: 600; color: #14224A; }
  .rl-ad-cell { display: inline-flex; align-items: center; gap: 12px; color: #1B2B55; }
  .rl-ad-cell svg { color: #2F6FE0; flex: 0 0 auto; }
  .rl-ad-conv { display: inline-flex; align-items: center; gap: 8px; color: #12A06B; font-weight: 500; }


  /* ===== table density preference ===== */
  html[data-density="compact"] .rl-table td { padding-top: 7px; padding-bottom: 7px; font-size: 13.5px; }
  html[data-density="compact"] .rl-table th { padding-top: 10px; padding-bottom: 10px; }
  html[data-density="compact"] .rl-person-av { width: 30px; height: 30px; flex-basis: 30px; font-size: 11px; }

  /* ===== shared look for every page ===== */
  .rl-tw { background: #fff; border: 1px solid #E6EBF3; border-radius: 14px !important; overflow: hidden; box-shadow: 0 1px 2px rgba(20,30,70,0.04), 0 8px 22px -12px rgba(20,30,70,0.12) !important; }
  .rl-thead { background: linear-gradient(90deg, #E8F0FD 0%, #E5F3FA 60%, #E6F7EC 100%); }
  .rl-th { text-align: left; padding: 13px 16px; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 600; color: #1B2B55; white-space: nowrap; }
  .rl-td { padding: 12px 16px; font-family: 'Inter', sans-serif; font-size: 13.5px; color: #151C30; border-top: 1px solid #EDF1F7; }
  .relay-table-wrap tbody tr:hover { background: #F5F8FE; }
  .rl-btn-primary { padding: 9px 18px; border: 0; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #fff; white-space: nowrap;
    background: linear-gradient(180deg, #14A870, #0C8556); box-shadow: 0 8px 18px -8px rgba(14,148,97,0.7), 0 1px 0 rgba(255,255,255,0.25) inset; }
  .rl-btn-primary:hover:not(:disabled) { filter: brightness(1.07); }
  .rl-btn-primary:disabled { background: #B7C0D0; box-shadow: none; opacity: .85; cursor: default; }
  .rl-btn-ghost { padding: 9px 16px; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #33405C; background: #fff; border: 1px solid #DCE3EF; white-space: nowrap; }
  .rl-btn-ghost:hover { background: #F2F5FA; }
  .rl-x { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; }
  .rl-x:hover { background: #F2F5FA; }
  .relay-page input:not([type="checkbox"]):not([type="radio"]):focus, .relay-page select:focus, .relay-page textarea:focus,
  .relay-modal-card input:focus, .relay-modal-card select:focus, .relay-modal-card textarea:focus { border-color: #0E9461 !important; box-shadow: 0 0 0 3px rgba(14,148,97,0.14); }
  .relay-page select, .relay-modal-card select { border-radius: 10px; }
  html[data-density="compact"] .rl-td { padding-top: 7px; padding-bottom: 7px; font-size: 13px; }
  html[data-density="compact"] .rl-th { padding-top: 10px; padding-bottom: 10px; }

  /* ===== Settings: grouped menu ===== */
  .rl-set { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 24px; align-items: start; }
  .rl-set-nav { background: #fff; border: 1px solid #E6EBF3; border-radius: 16px; padding: 6px 10px 10px; box-shadow: 0 1px 2px rgba(20,30,70,0.04), 0 8px 22px -12px rgba(20,30,70,0.12); }
  .rl-set-group { padding: 16px 12px 6px; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: #8A94A8; }
  .rl-set-item { width: 100%; display: flex; align-items: center; gap: 12px; height: 42px; padding: 0 12px; margin-bottom: 2px; border: 0; border-radius: 10px; background: transparent;
    font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #33405C; text-align: left; }
  .rl-set-item svg { flex: 0 0 auto; color: #5B6882; }
  .rl-set-item:hover { background: #F2F5FA; }
  .rl-set-item.is-active { background: #E3F4EA; color: #0A6F49; font-weight: 600; }
  .rl-set-item.is-active svg { color: #0E9461; }
  .rl-set-label { flex: 1; }
  .rl-set-chev { display: none; color: #9AA5BB !important; }
  .rl-set-content { min-width: 0; }
  .rl-set-title { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 22px; color: #151C30; letter-spacing: -0.01em; }
  .rl-set-desc { font-family: 'Inter', sans-serif; font-size: 13.5px; color: #6A7B9B; margin: 4px 0 18px; }
  .rl-set-back { display: none; align-items: center; gap: 4px; margin: 0 0 12px -4px; padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; color: #0E9461; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; }
  @media (max-width: 768px) {
    .rl-set { grid-template-columns: minmax(0, 1fr); gap: 0; }
    .rl-set-chev { display: block; }
    .rl-set-item { height: 48px; font-size: 15px; }
    .rl-set.is-detail .rl-set-nav { display: none; }
    .rl-set:not(.is-detail) .rl-set-content { display: none; }
    .rl-set-back { display: inline-flex; }
  }

  /* ===== shared pills / avatars ===== */
  .rl-pills, .rl-ib-filters { display: flex; flex-wrap: wrap; gap: 10px; }
  .rl-pill { --pc: #7A859D; display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 8px 0 15px; border: 0; border-radius: 999px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; white-space: nowrap; transition: box-shadow .15s, filter .15s; }
  .rl-pill b { min-width: 24px; height: 22px; padding: 0 7px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; }
  .rl-pill:hover { filter: brightness(0.97); }
  .rl-pill-all { --pc: #0E6B46; background: #E5F4EC; color: #0A6F49; } .rl-pill-all b { background: #CDEBDB; }
  .rl-pill-active { --pc: #12A06B; background: #E5F6EC; color: #0A7A4F; } .rl-pill-active b { background: #CDEFDC; }
  .rl-pill-warning { --pc: #F0A020; background: #FDF1DB; color: #A8660A; } .rl-pill-warning b { background: #FBE3B5; }
  .rl-pill-error { --pc: #E5484D; background: #FDE8E8; color: #C23038; } .rl-pill-error b { background: #F9CFCF; }
  .rl-pill-inactive { --pc: #7A859D; background: #EDF1F7; color: #4A5876; } .rl-pill-inactive b { background: #DDE3EE; }
  .rl-pill-needs_human { --pc: #EF6A1B; background: #FDEBDD; color: #B24D0C; } .rl-pill-needs_human b { background: #FAD6BC; }
  .rl-pill-bot { --pc: #2F7DE1; background: #E4EEFC; color: #2056B0; } .rl-pill-bot b { background: #CFE0FA; }
  .rl-pill.is-on { box-shadow: inset 0 0 0 2px var(--pc); }
  .rl-pill-all.is-on { background: #0E6B46; color: #fff; box-shadow: 0 8px 18px -8px rgba(14,107,70,0.7); } .rl-pill-all.is-on b { background: #CFF1DF; color: #0E6B46; }
  .rl-av { width: 46px; height: 46px; flex: 0 0 46px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 15px; }
  .rl-av-md { width: 48px; height: 48px; flex-basis: 48px; font-size: 16px; }
  .rl-av-lg { width: 84px; height: 84px; flex-basis: 84px; font-size: 28px; }
  .rl-status-pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 13px 5px 11px; border-radius: 999px; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
  .rl-status-pill i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

  /* ===== WhatsApp Numbers ===== */
  .rl-nm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
  .rl-nm-title { margin: 0; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 26px; letter-spacing: -0.01em; color: #151C30; }
  .rl-nm-sub { margin: 4px 0 0; font-family: 'Inter', sans-serif; font-size: 14.5px; color: #6A7B9B; }
  .rl-nm-panel .rl-pills { margin-bottom: 18px; }
  .rl-table-nm { min-width: 860px; }
  .rl-table-nm thead tr { background: #F7F9FC; }
  .rl-table-nm th { padding: 8px 14px; }
  .rl-sortbtn { display: inline-flex; align-items: center; gap: 8px; padding: 6px 4px; border: 0; background: transparent; font: inherit; color: #1B2B55; }
  .rl-sortbtn:hover { color: #0E6B46; }
  .rl-pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
  .rl-pager-info { font-family: 'Inter', sans-serif; font-size: 13px; color: #6A7B9B; }
  .rl-pager-btns { display: flex; gap: 6px; }
  .rl-pg { min-width: 34px; height: 34px; padding: 0 8px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #DCE3EF; border-radius: 9px; background: #fff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #33405C; }
  .rl-pg:hover:not(:disabled) { background: #F2F5FA; }
  .rl-pg.is-on { background: #0E6B46; border-color: #0E6B46; color: #fff; }
  .rl-pg:disabled { opacity: .4; cursor: default; }

  /* ===== Inbox ===== */
  .rl-inbox { gap: 16px; height: calc(100dvh - 136px); min-height: 520px; }
  .rl-ib-card { background: #fff; border: 1px solid #E6EBF3; border-radius: 18px; box-shadow: 0 1px 2px rgba(20,30,70,0.04), 0 8px 22px -12px rgba(20,30,70,0.12); overflow: hidden; }
  .rl-ib-list { width: 360px; }
  .rl-ib-filters { padding: 16px 16px 12px; gap: 8px; flex-wrap: nowrap; overflow-x: auto; }
  .rl-conv { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 12px; margin-bottom: 4px; border: 0; border-radius: 14px; background: transparent; text-align: left; }
  .rl-conv:hover { background: #F5F8FE; }
  .rl-conv.is-active { background: #E6F5EC; }
  .rl-conv-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .rl-conv-name { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600; color: #151C30; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rl-conv-phone { font-family: 'Inter', sans-serif; font-size: 13px; color: #6A7B9B; }
  .rl-conv-st { display: inline-flex; align-items: center; gap: 6px; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 500; }
  .rl-conv-st i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
  .rl-conv-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; align-self: flex-start; padding-top: 2px; }
  .rl-conv-time { font-family: 'Inter', sans-serif; font-size: 12px; color: #7A859D; white-space: nowrap; }
  .rl-unread { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: #12A06B; color: #fff; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }

  .rl-chat-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid #EDF1F7; background: #fff; }
  .rl-chat-name { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 18px; color: #151C30; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rl-chat-sub { font-family: 'Inter', sans-serif; font-size: 13px; color: #6A7B9B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rl-chat-bg { background-color: #F1F5FB; background-image: radial-gradient(rgba(110,140,190,0.13) 1.3px, transparent 1.5px), radial-gradient(rgba(110,140,190,0.08) 1px, transparent 1.2px); background-size: 26px 26px, 26px 26px; background-position: 0 0, 13px 13px; }
  .rl-day { display: flex; justify-content: center; margin: 6px 0 14px; }
  .rl-day span { padding: 5px 16px; border-radius: 999px; background: #fff; border: 1px solid #E6EBF3; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 500; color: #4A5876; }
  .rl-bub { max-width: 64%; padding: 11px 15px 8px; font-family: 'Inter', sans-serif; font-size: 14.5px; line-height: 1.5; word-break: break-word; box-shadow: 0 2px 6px -2px rgba(20,30,70,0.12); }
  .rl-bub-c { background: #fff; color: #151C30; border-radius: 16px 16px 16px 4px; }
  .rl-bub-h { background: linear-gradient(135deg, #FF7A5C, #F2593C); color: #fff; border-radius: 16px 16px 4px 16px; }
  .rl-bub-b { background: linear-gradient(135deg, #F7B23B, #E8920F); color: #fff; border-radius: 16px 16px 4px 16px; }
  .rl-bub-tag { display: flex; align-items: center; gap: 5px; margin-bottom: 4px; font-size: 11px; font-weight: 600; opacity: .95; }
  .rl-bub-meta { display: flex; align-items: center; justify-content: flex-end; gap: 5px; margin-top: 4px; font-size: 11px; opacity: .75; }
  .rl-bub-c .rl-bub-meta { color: #7A859D; opacity: 1; }
  .rl-composer-wrap { padding: 14px 16px; border-top: 1px solid #EDF1F7; background: #fff; }
  .rl-composer { position: relative; display: flex; align-items: center; gap: 6px; }
  .rl-comp-input { flex: 1; min-width: 0; padding: 8px 16px; border: 1px solid #E6EBF3; border-radius: 16px; background: #F6F8FC; }
  .rl-comp-input textarea { display: block; width: 100%; border: 0; outline: 0; background: transparent; resize: none; font-size: 14.5px; line-height: 1.5; max-height: 110px; }
  .rl-comp-input:focus-within { border-color: #0E9461; box-shadow: 0 0 0 3px rgba(14,148,97,0.14); background: #fff; }
  .rl-send { width: 52px; height: 52px; flex: 0 0 52px; border: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #1DB77C, #0E8F5F); box-shadow: 0 10px 20px -8px rgba(14,148,97,0.8); }
  .rl-send:disabled { background: #B7C0D0; box-shadow: none; }

  .rl-ib-side { width: 330px; flex: 0 0 330px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
  .relay-inbox .relay-customer-panel.rl-ib-side { flex: 0 0 330px; }
  .rl-prof { display: flex; flex-direction: column; align-items: center; padding: 22px 18px 18px; }
  .rl-prof-name { margin: 12px 0 8px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 22px; color: #151C30; text-align: center; }
  .rl-prof-line { display: flex; align-items: center; gap: 10px; align-self: stretch; margin-top: 10px; font-family: 'Inter', sans-serif; font-size: 14px; color: #1B2338; word-break: break-all; }
  .rl-prof-line:first-of-type { margin-top: 16px; }
  .rl-tiles-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; align-self: stretch; margin-top: 18px; }
  .rl-tile-s { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; border: 1px solid #EDF1F7; border-radius: 12px; background: #FAFBFE; }
  .rl-tile-s span { width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }
  .rl-tile-s b { font-family: 'Space Grotesk', sans-serif; font-size: 18px; color: #151C30; }
  .rl-tile-s em { font-style: normal; font-family: 'Inter', sans-serif; font-size: 11px; color: #7A859D; }
  .rl-sec { padding: 16px 16px 14px; }
  .rl-sec-title { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-family: 'Inter', sans-serif; font-size: 14.5px; font-weight: 600; color: #151C30; }
  .rl-sec-title svg { color: #5B6882; }
  .rl-note { width: 100%; padding: 10px 12px; border: 1px solid #E6EBF3; border-radius: 12px; background: #fff; font-family: 'Inter', sans-serif; font-size: 13.5px; color: #151C30; resize: vertical; outline: 0; }
  .rl-note-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; font-family: 'Inter', sans-serif; font-size: 12.5px; }
  .rl-act { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-top: 1px solid #EDF1F7; }
  .rl-act:first-of-type { border-top: 0; }
  .rl-act > span { width: 32px; height: 32px; flex: 0 0 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #E3F4EA; color: #0E9461; }
  .rl-act b { display: block; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #151C30; }
  .rl-act em { display: block; font-style: normal; font-family: 'Inter', sans-serif; font-size: 12.5px; color: #6A7B9B; overflow-wrap: anywhere; }

  @media (max-width: 1280px) { .rl-ib-list { width: 320px; } }
  @media (max-width: 1180px) { .relay-inbox .relay-customer-panel.rl-ib-side { display: none; } }
  @media (max-width: 768px) {
    .rl-ib-list { width: 100% !important; }
    .rl-ib-card { border-radius: 14px; }
    .rl-chat-head { padding: 12px 12px; }
    .rl-bub { max-width: 82%; font-size: 14px; }
    .rl-composer-wrap { padding: 10px 10px; }
    .rl-send { width: 46px; height: 46px; flex-basis: 46px; }
    .rl-nm-title { font-size: 21px; }
    .rl-pills { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
  }

  /* ===== Campaigns / Automations ===== */
  .rl-pghead { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
  .rl-pghead-l { display: flex; align-items: center; gap: 16px; }
  .rl-pgicon { width: 58px; height: 58px; flex: 0 0 58px; border-radius: 17px; display: inline-flex; align-items: center; justify-content: center; color: #12A06B; background: #DDF3EA; }
  .rl-btn-lg { height: 48px; padding: 0 22px; font-size: 14.5px; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; }
  .rl-kpi-grid-c6 { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; }
  .rl-kpi-grid-c6 .rl-kpi-value { font-size: 28px; }
  .rl-kpi-grid-c6 .rl-kpi-label { font-size: 14px; }
  .rl-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
  .rl-tsearch { flex: 1; min-width: 200px; max-width: 360px; height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 1px solid #DCE3EF; border-radius: 12px; background: #fff; color: #8A94A8; }
  .rl-tsearch:focus-within { border-color: #0E9461; box-shadow: 0 0 0 3px rgba(14,148,97,0.14); }
  .rl-tsearch input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font-family: 'Inter', sans-serif; font-size: 14px; color: #151C30; }
  .rl-tselect { height: 44px; padding: 0 14px; border: 1px solid #DCE3EF; border-radius: 12px; background: #fff; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #33405C; }
  .rl-export { margin-left: auto; height: 44px; display: inline-flex; align-items: center; gap: 8px; border-radius: 12px; }
  .rl-export:disabled { opacity: .5; cursor: default; }
  .rl-table-cm { min-width: 1120px; }
  .rl-table-au { min-width: 1000px; }
  .rl-cm-ico { width: 38px; height: 38px; flex: 0 0 38px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; }
  .rl-metric { display: flex; flex-direction: column; gap: 3px; min-width: 100px; }
  .rl-metric b { font-weight: 500; font-size: 14px; color: #151C30; }
  .rl-metric-row { display: flex; align-items: center; gap: 8px; }
  .rl-metric em { font-style: normal; font-size: 11.5px; color: #6A7B9B; min-width: 28px; }
  .rl-bar { flex: 1; max-width: 70px; height: 5px; border-radius: 999px; background: #E8EDF5; overflow: hidden; }
  .rl-bar i { display: block; height: 100%; border-radius: 999px; }
  .rl-date b { display: block; font-weight: 500; font-size: 13.5px; color: #151C30; }
  .rl-date em { display: block; font-style: normal; font-size: 12px; color: #7A859D; }
  .rl-auto-cell { display: inline-flex; align-items: center; gap: 14px; border: 0; background: transparent; text-align: left; padding: 0; }
  .rl-auto-ico { width: 44px; height: 44px; flex: 0 0 44px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }
  .rl-auto-cell b { display: block; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14.5px; color: #151C30; }
  .rl-auto-cell em { display: block; font-style: normal; font-family: 'Inter', sans-serif; font-size: 12.5px; color: #6A7B9B; margin-top: 2px; }
  .rl-prog b { display: block; font-weight: 500; font-size: 13.5px; margin-bottom: 6px; }
  .rl-prog span { display: block; width: 120px; height: 6px; border-radius: 999px; background: #E8EDF5; overflow: hidden; }
  .rl-prog i { display: block; height: 100%; border-radius: 999px; }
  .rl-actions { display: flex; align-items: center; gap: 8px; }
  .rl-act-btn { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border-radius: 10px; border: 1px solid; font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 600; white-space: nowrap; }
  .rl-act-btn.is-pause { color: #2F6FE0; border-color: #C9DBF7; background: #F4F8FE; }
  .rl-act-btn.is-resume { color: #0A7A4F; border-color: #BFE6D1; background: #F1FAF5; }
  .rl-act-btn:hover:not(:disabled) { filter: brightness(0.97); }
  .rl-act-btn:disabled { opacity: .6; cursor: default; }
  .rl-icon-btn { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #E1E7F1; border-radius: 10px; background: #fff; color: #5B6882; }
  .rl-icon-btn:hover { background: #F2F5FA; color: #151C30; }
  @media (max-width: 1280px) { .rl-kpi-grid-c6 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 768px) {
    .rl-kpi-grid-c6 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .rl-pghead { margin-bottom: 16px; }
    .rl-btn-lg { height: 44px; padding: 0 16px; }
    .rl-tsearch { max-width: none; min-width: 100%; }
    .rl-export { margin-left: 0; }
  }
  @media (max-width: 420px) { .rl-kpi-grid-c6 { grid-template-columns: minmax(0, 1fr); } }

  /* ===== Activity logs ===== */
  .rl-pgicon.is-blue { background: #E3EEFD; color: #2F7DE1; }
  .rl-table-lg { min-width: 900px; }
  .rl-type { display: inline-flex; align-items: center; gap: 7px; padding: 6px 13px 6px 10px; border-radius: 999px; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
  .rl-viewbtn { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 16px; border: 1px solid #DCE3EF; border-radius: 10px; background: #fff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #33405C; }
  .rl-viewbtn:hover { background: #F2F5FA; }
  .rl-detail > div { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid #EDF1F7; font-family: 'Inter', sans-serif; font-size: 13.5px; }
  .rl-detail > div:last-child { border-bottom: 0; }
  .rl-detail span { color: #6A7B9B; flex: 0 0 auto; }
  .rl-detail b { font-weight: 500; color: #151C30; text-align: right; overflow-wrap: anywhere; }

  /* ===== Chatbot ===== */
  .rl-pgicon.is-teal { width: 72px; height: 72px; flex-basis: 72px; border-radius: 20px; color: #fff; background: linear-gradient(145deg, #34D3B0, #0E8A7A); box-shadow: 0 14px 28px -12px rgba(14,138,122,0.7); }
  .rl-btn-primary.rl-btn-teal { background: linear-gradient(180deg, #118A74, #0A6556); box-shadow: 0 12px 24px -10px rgba(10,101,86,0.8), 0 1px 0 rgba(255,255,255,0.25) inset; }
  .rl-bot-ico { width: 46px; height: 46px; flex: 0 0 46px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 8px 16px -8px rgba(20,30,70,0.4); }
  .rl-act-btn.is-open { color: #0A7A4F; border-color: #BFE6D1; background: #F1FAF5; }

  /* ===== Settings: menu card + section heading + profile form ===== */
  .rl-set { grid-template-columns: 300px minmax(0, 1fr); gap: 28px; }
  .rl-set-nav { border-radius: 20px; padding: 8px 12px 14px; }
  .rl-set-nav-head { display: flex; align-items: center; gap: 12px; padding: 14px 12px 2px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 22px; color: #151C30; }
  .rl-set-nav-head svg { color: #33405C; }
  .rl-set-item { height: 44px; font-size: 14.5px; }
  .rl-set-item.is-active { background: #DDF3EA; }
  .rl-set-hero { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; }
  .rl-set-hero-ico { width: 72px; height: 72px; flex: 0 0 72px; border-radius: 20px; display: flex; align-items: center; justify-content: center; color: #fff;
    background: linear-gradient(145deg, #1FCF8D, #0E9461); box-shadow: 0 14px 28px -12px rgba(14,148,97,0.7); }
  .rl-set-hero .rl-set-title { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
  .rl-set-hero .rl-set-desc { font-size: 16px; margin: 6px 0 0; }

  .rl-pf-card { max-width: 720px; background: #fff; border: 1px solid #E6EBF3; border-radius: 20px; padding: 30px 32px 32px; box-shadow: 0 1px 2px rgba(20,30,70,0.04), 0 14px 34px -16px rgba(20,30,70,0.14); }
  .rl-pf-row { display: flex; align-items: flex-start; gap: 18px; margin-bottom: 22px; }
  .rl-pf-ico { width: 28px; flex: 0 0 28px; padding-top: 2px; color: #2A3B5C; }
  .rl-pf-field { flex: 1; min-width: 0; }
  .rl-pf-field label { display: block; margin-bottom: 10px; font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600; color: #151C30; }
  .rl-pf-input-wrap { position: relative; }
  .rl-pf-input { width: 100%; height: 54px; padding: 0 16px; border: 1px solid #D5DEEC; border-radius: 14px; background: #fff; font-family: 'Inter', sans-serif; font-size: 15.5px; color: #151C30; outline: 0; transition: border-color .15s, box-shadow .15s; }
  .rl-pf-input::placeholder { color: #9AA7BD; }
  .rl-pf-input:focus { border-color: #0E9461; box-shadow: 0 0 0 3px rgba(14,148,97,0.14); }
  .rl-pf-input:disabled { opacity: .75; }
  .rl-pf-input.is-locked { padding-right: 46px; background: #EAF1FB; border-color: #DCE6F5; color: #7D8BA6; opacity: 1; }
  .rl-pf-lock { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #7D8BA6; }
  .rl-pf-note { display: flex; align-items: center; gap: 8px; margin: -8px 0 20px 46px; font-family: 'Inter', sans-serif; font-size: 13.5px; color: #2F7DE1; }
  .rl-pf-banner { display: flex; align-items: center; gap: 12px; margin: 0 0 20px 46px; padding: 14px 16px; border: 1px solid #F7C9CF; border-radius: 14px; background: #FDECEE; font-family: 'Inter', sans-serif; font-size: 14px; color: #C23038; }
  .rl-pf-banner .grow { flex: 1; min-width: 0; }
  .rl-pf-banner small { display: block; margin-top: 3px; font-size: 12.5px; color: #8C5A5F; }
  .rl-pf-banner.is-ok { border-color: #BFE6D1; background: #EAF8F1; color: #0A7A4F; }
  .rl-pf-retry { display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto; border: 0; background: transparent; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #0E9461; }
  .rl-pf-save { display: flex; align-items: center; justify-content: center; gap: 10px; width: calc(100% - 46px); margin-left: 46px; height: 56px; border: 0; border-radius: 14px; color: #fff;
    font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600; background: linear-gradient(180deg, #1BB596, #0E8A7A); box-shadow: 0 12px 24px -10px rgba(14,138,122,0.7), 0 1px 0 rgba(255,255,255,0.25) inset; }
  .rl-pf-save:hover:not(:disabled) { filter: brightness(1.06); }
  .rl-pf-save:disabled { background: #B7C0D0; box-shadow: none; cursor: default; }
  @media (max-width: 768px) {
    .rl-set-nav-head { font-size: 24px; padding-top: 16px; }
    .rl-set-hero { gap: 14px; margin-bottom: 18px; }
    .rl-set-hero-ico { width: 56px; height: 56px; flex-basis: 56px; border-radius: 16px; }
    .rl-set-hero-ico svg { width: 26px; height: 26px; }
    .rl-set-hero .rl-set-title { font-size: 26px; }
    .rl-set-hero .rl-set-desc { font-size: 14px; }
    .rl-pf-card { padding: 22px 18px 22px; border-radius: 18px; }
  }
  @media (max-width: 560px) {
    .rl-pf-ico { display: none; }
    .rl-pf-note, .rl-pf-banner { margin-left: 0; }
    .rl-pf-save { width: 100%; margin-left: 0; }
  }

  /* ===== Backups ===== */
  .rl-bk { display: flex; flex-direction: column; gap: 18px; max-width: 720px; }
  .rl-bk-card { background: #fff; border: 1px solid #E6EBF3; border-radius: 20px; padding: 24px 26px; box-shadow: 0 1px 2px rgba(20,30,70,0.04), 0 14px 34px -16px rgba(20,30,70,0.12); }
  .rl-bk-title { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 19px; color: #151C30; }
  .rl-bk-sub { margin: 4px 0 16px; font-family: 'Inter', sans-serif; font-size: 13.5px; color: #6A7B9B; }
  .rl-bk-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .rl-bk-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid #E6EBF3; border-radius: 14px; cursor: pointer; background: #FAFBFE; }
  .rl-bk-item:hover { background: #F3F7FD; }
  .rl-bk-item input { width: 18px; height: 18px; accent-color: #0E9461; flex: 0 0 auto; }
  .rl-bk-ico { width: 34px; height: 34px; flex: 0 0 34px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: #E3F4EA; color: #0E9461; }
  .rl-bk-text b { display: block; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #151C30; }
  .rl-bk-text em { display: block; font-style: normal; font-family: 'Inter', sans-serif; font-size: 12px; color: #6A7B9B; line-height: 1.4; }
  .rl-bk-links { display: flex; gap: 16px; margin: 12px 2px 14px; }
  .rl-bk-links button { border: 0; background: transparent; padding: 0; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #0E9461; }
  .rl-bk-links button:disabled { opacity: .5; }
  .rl-bk-warn { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 16px; padding: 11px 13px; border-radius: 12px; background: #FDF1DB; color: #8A5A0B; font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.45; }
  .rl-bk-warn svg { flex: 0 0 auto; margin-top: 2px; }
  .rl-bk-last { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; padding: 11px 0; border-top: 1px solid #EDF1F7; border-bottom: 1px solid #EDF1F7; font-family: 'Inter', sans-serif; font-size: 13.5px; color: #6A7B9B; }
  .rl-bk-last b { font-weight: 600; color: #151C30; text-align: right; }
  .rl-bk-due { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding: 11px 13px; border-radius: 12px; background: #FDF1DB; color: #8A5A0B; font-family: 'Inter', sans-serif; font-size: 13px; }
  .rl-bk-soon { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 14px 0; border-top: 1px solid #EDF1F7; }
  .rl-bk-title + .rl-bk-soon { margin-top: 10px; }
  .rl-bk-soon b { display: block; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #33405C; }
  .rl-bk-soon em { display: block; margin-top: 3px; font-style: normal; font-family: 'Inter', sans-serif; font-size: 12.5px; color: #7A859D; line-height: 1.45; }
  .rl-bk-soon > span { flex: 0 0 auto; padding: 4px 11px; border-radius: 999px; background: #EDF1F7; color: #4A5876; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; }
  .rl-set-dot { width: 8px; height: 8px; border-radius: 50%; background: #F0A020; flex: 0 0 auto; }
  @media (max-width: 640px) { .rl-bk-list { grid-template-columns: minmax(0, 1fr); } .rl-bk-card { padding: 20px 16px; border-radius: 18px; } }
  @media (max-width: 768px) {
    .rl-ad-panel { padding: 16px 12px 16px; border-radius: 18px; }
    .rl-ad-count { font-size: 30px; }
    .rl-ad-word { font-size: 22px; }
    .rl-ad-add { height: 40px; padding: 0 14px; }
  }
`;


const C = {
  bg: "#F2F5FA", panel: "#FFFFFF", panelDeep: "#EDF1F7",
  sidebar: "#0B1E47", sidebarSoft: "#13306A",
  ink: "#151C30", inkSoft: "#4A5876", inkFaint: "#8A94A8",
  jade: "#0E9461", jadeDeep: "#0A6F49", jadeSoft: "#E3F4EA",
  amber: "#D9861A", amberSoft: "#FDF1DB",
  rust: "#D93A40", rustSoft: "#FDE8E8",
  blue: "#2F7DE1", blueSoft: "#E4EEFC",
  gray: "#7A859D", graySoft: "#EDF1F7",
  hairline: "#E1E7F1", hairlineSoft: "#EAEFF7", white: "#FFFFFF",
};
const CARD_SHADOW = "0 1px 2px rgba(20,30,70,0.04), 0 8px 22px -12px rgba(20,30,70,0.12)";
const F = { d: "'Space Grotesk', sans-serif", b: "'Inter', sans-serif", m: "'IBM Plex Mono', monospace" };

const PALETTE = [C.jade, C.amber, C.blue, C.rust, "#6B5B95", "#3D8A72"];
function initials(name) { return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }
function colorForId(id) {
  let hash = 0;
  const s = String(id || "");
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: LIVE_PREFS.timeFormat !== "24h" });
}

// ============================================================
// PRIMITIVES
// ============================================================
function StatusPill({ status }) {
  const map = {
    active: [C.jade, "#E3F4EA", "Active"], warning: [C.amber, C.amberSoft, "Warning"],
    error: [C.rust, C.rustSoft, "Error"], inactive: [C.gray, C.graySoft, "Inactive"],
    Running: [C.jade, "#E3F4EA", "Running"], Paused: [C.amber, C.amberSoft, "Paused"],
    Completed: [C.blue, C.blueSoft, "Completed"], Failed: [C.rust, C.rustSoft, "Failed"],
    Scheduled: [C.gray, C.graySoft, "Scheduled"], Draft: [C.gray, C.graySoft, "Draft"],
    Connected: [C.jade, "#E3F4EA", "Connected"],
    paused: [C.gray, C.graySoft, "Paused"],
  };
  const [fg, bg, label] = map[status] || [C.gray, C.graySoft, status];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ fontFamily: F.b, color: fg, background: bg, borderRadius: 999, padding: "4px 12px 4px 10px" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: fg, display: "inline-block" }} />{label}
    </span>
  );
}

/** Small donut showing a real ratio (0-100). */
function RatioRing({ value, color, size = 54 }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const r = 20, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden="true" style={{ flex: "0 0 auto" }}>
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeOpacity="0.16" strokeWidth="5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(v / 100) * circ} ${circ}`} transform="rotate(-90 26 26)" />
      <text x="26" y="30" textAnchor="middle" style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, fill: "#33405C" }}>{Math.round(v)}%</text>
    </svg>
  );
}

function KpiCard({ label, value, accent, sub, icon: Icon, soft, ratio, bar }) {
  const tint = soft || `${accent}1F`;
  return (
    <div className="relay-kpi-card rl-kpi" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="rl-kpi-top">
        {Icon && <span className="rl-kpi-icon" style={{ background: tint, color: accent }}><Icon size={20} /></span>}
        <span className="rl-kpi-label">{label}</span>
      </div>
      <div className="rl-kpi-body">
        <div style={{ minWidth: 0 }}>
          <div className="rl-kpi-value">{value}</div>
          {sub && <div className="rl-kpi-sub">{sub}</div>}
        </div>
        {ratio != null && !bar && <RatioRing value={ratio} color={accent} />}
      </div>
      {ratio != null && bar && (
        <div className="rl-kpi-bar"><i style={{ width: `${Math.max(2, Math.min(100, ratio))}%`, background: accent }} /></div>
      )}
    </div>
  );
}

function DashPanel({ title, children, foot }) {
  return (
    <section className="rl-panel">
      <div className="rl-panel-head"><h2>{title}</h2></div>
      {children}
      {foot && <div className="rl-panel-foot">{foot}</div>}
    </section>
  );
}

/** cols: [[label, Icon, color?], ...] — rows are passed as <tr> children. */
function DashTable({ cols, children, variant }) {
  return (
    <div className="rl-table-wrap">
      <table className={`rl-table${variant ? ` rl-table-${variant}` : ""}`}>
        <thead>
          <tr>
            {cols.map(([label, Icon, color]) => (
              <th key={label}><span>{Icon && <Icon size={16} {...(color ? { color } : {})} />}{label}</span></th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Table({ columns, children }) {
  return (
    <div className="relay-table-wrap rl-tw">
      <table className="w-full border-collapse">
        <thead>
          <tr className="rl-thead">
            {columns.map((c) => <th key={c} className="rl-th">{c}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children, mono }) {
  return <td className="rl-td" style={mono ? { fontFamily: F.m } : undefined}>{children}</td>;
}
function IconBtn({ icon: Icon, onClick, active }) {
  return (
    <button onClick={onClick} className="p-2 shrink-0" style={{ borderRadius: 10, background: active ? C.jadeSoft : "transparent" }}>
      <Icon size={16} color={active ? C.jade : C.inkSoft} />
    </button>
  );
}
function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(10,20,50,0.5)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }} onClick={onClose}>
      <div className="relay-modal-card" onClick={(e) => e.stopPropagation()} style={{ width, maxHeight: "85vh", overflowY: "auto", background: C.panel, borderRadius: 18, border: `1px solid ${C.hairline}` }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.hairlineSoft}` }}>
          <span className="text-[16px] font-semibold" style={{ fontFamily: F.d, color: C.ink }}>{title}</span>
          <button onClick={onClose} className="rl-x" aria-label="Close"><X size={18} color={C.inkSoft} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div className="mb-3.5">
      <label className="block text-[12.5px] font-semibold mb-1.5" style={{ fontFamily: F.b, color: C.ink }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = { fontFamily: F.b, fontSize: 13.5, color: C.ink, width: "100%", padding: "10px 12px", border: `1px solid ${C.hairline}`, borderRadius: 10, outline: "none", background: C.white };
function PrimaryBtn({ children, onClick, full, disabled }) {
  return <button disabled={disabled} onClick={onClick} className={`rl-btn-primary${full ? " w-full" : ""}`}>{children}</button>;
}
function GhostBtn({ children, onClick }) {
  return <button onClick={onClick} className="rl-btn-ghost">{children}</button>;
}
function EmptyState({ icon: Icon, title, desc, phase }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="flex items-center justify-center mb-4" style={{ width: 60, height: 60, background: "linear-gradient(145deg,#E4EEFC,#E3F4EA)", borderRadius: 18 }}><Icon size={26} color={C.blue} /></div>
      <div className="text-[17px] font-semibold mb-1.5" style={{ fontFamily: F.d, color: C.ink }}>{title}</div>
      <div className="text-[13.5px] max-w-[400px] leading-relaxed mb-3" style={{ fontFamily: F.b, color: C.inkSoft }}>{desc}</div>
      {phase && <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1" style={{ fontFamily: F.b, color: C.amber, background: C.amberSoft, borderRadius: 999 }}><Construction size={11} /> Planned for the next build phase</span>}
    </div>
  );
}
function PageHeader({ title, desc, action }) {
  return (
    <div className="relay-page-header flex items-start justify-between mb-6">
      <div>
        <div className="rl-page-title">{title}</div>
        {desc && <div className="rl-page-desc">{desc}</div>}
      </div>
      {action}
    </div>
  );
}

/** Loading skeleton for table-shaped content — real fetches take real time. */
function TableSkeleton({ rows = 6 }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.hairline}`, borderRadius: 14, overflow: "hidden", boxShadow: CARD_SHADOW }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 px-3.5 py-3" style={{ borderBottom: i < rows - 1 ? `1px solid ${C.hairlineSoft}` : "none" }}>
          {[30, 20, 15, 10, 10, 15].map((w, j) => (
            <div key={j} style={{ width: `${w}%`, height: 12, background: C.hairlineSoft, borderRadius: 4, animation: "relay-pulse 1.4s ease-in-out infinite" }} />
          ))}
        </div>
      ))}
      <style>{`@keyframes relay-pulse { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }`}</style>
    </div>
  );
}

/** Real errors get shown, not swallowed — with a retry that re-fires the fetch. */
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ background: C.rustSoft, border: `1px solid ${C.rust}33`, borderRadius: 12 }}>
      <div className="flex items-center gap-2">
        <WifiOff size={15} color={C.rust} />
        <span className="text-[12.5px]" style={{ fontFamily: F.b, color: C.rust }}>{message}</span>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1" style={{ fontFamily: F.b, color: C.rust, border: `1px solid ${C.rust}`, borderRadius: 6 }}>
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}

// ============================================================
// LOGIN — real POST /auth/login, controlled inputs (not defaultValue).
// ============================================================
function LoginFX() {
  return (
    <div className="rl-fx" aria-hidden="true">
      <i className="rl-orb o1" /><i className="rl-orb o2" /><i className="rl-orb o3" />
      <i className="rl-band bd1" /><i className="rl-band bd2" />
      <i className="rl-beam b1" /><i className="rl-beam b2" /><i className="rl-beam b3" /><i className="rl-beam b4" />
      <i className="rl-beam b5" /><i className="rl-beam b6" /><i className="rl-beam b7" />
      <i className="rl-sp s1" /><i className="rl-sp s2" /><i className="rl-sp s3" /><i className="rl-sp s4" />
      <i className="rl-sp s5" /><i className="rl-sp s6" /><i className="rl-sp s7" /><i className="rl-sp s8" />
    </div>
  );
}

function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const tick = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

  return (
    <div className="rl-screen">
      <style>{LOGIN_CSS}</style>
      <LoginFX />

      <div className="rl-stage">
        <div className="rl-brand">
          <div className="rl-mark"><InboxIcon size={26} color="white" /></div>
          <div className="rl-name">Ramorra<span>.io</span></div>
        </div>

        <h1 className="rl-title">Welcome <span>back</span></h1>
        <p className="rl-sub">Sign in to manage your WhatsApp conversations and automations.</p>

        <div className="rl-row">
          <form onSubmit={submit} className="rl-card">
            <label className="rl-label" htmlFor="rl-email">Work email</label>
            <div className="rl-input-wrap">
              <Mail size={18} className="rl-icon" />
              <input id="rl-email" className="rl-input" type="email" autoComplete="username" placeholder="you@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <label className="rl-label" htmlFor="rl-password">Password</label>
            <div className="rl-input-wrap">
              <Lock size={18} className="rl-icon" />
              <input id="rl-password" className="rl-input rl-input-pw" type={showPw ? "text" : "password"} autoComplete="current-password"
                placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="rl-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div className="rl-error" role="alert">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <button className="rl-btn" type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in \u2192"}</button>

            <div className="rl-trust">
              <span><svg width="15" height="15" viewBox="0 0 24 24" {...tick}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>Secure</span>
              <i />
              <span><svg width="15" height="15" viewBox="0 0 24 24" {...tick}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>Fast</span>
              <i />
              <span><svg width="15" height="15" viewBox="0 0 24 24" {...tick}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>Reliable</span>
            </div>
          </form>

          <div className="rl-tiles" aria-hidden="true">
            <div className="rl-tile rl-tile-a"><InboxIcon /></div>
            <div className="rl-tile rl-tile-b"><MessageCircle /></div>
            <div className="rl-tile rl-tile-c"><SettingsIcon /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

const LOGIN_CSS = `
  .rl-screen {
    min-height: 100vh; min-height: 100dvh; width: 100%;
    display: flex; align-items: center; justify-content: center;
    padding: max(28px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom));
    position: relative; overflow: hidden;
    background:
      radial-gradient(700px 520px at 20% 25%, rgba(59,70,210,0.45), transparent 70%),
      radial-gradient(600px 500px at 90% 90%, rgba(124,58,237,0.35), transparent 70%),
      linear-gradient(180deg, #070B3A 0%, #050730 55%, #080636 100%);
  }
  .rl-fx { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .rl-fx::before {
    content: ""; position: absolute; inset: 0;
    background-image: radial-gradient(rgba(160,180,255,0.16) 1px, transparent 1px);
    background-size: 28px 28px;
    -webkit-mask-image: radial-gradient(ellipse at 50% 45%, #000 20%, transparent 78%);
            mask-image: radial-gradient(ellipse at 50% 45%, #000 20%, transparent 78%);
  }
  .rl-fx i { position: absolute; display: block; }

  .rl-orb { border-radius: 50%; filter: blur(70px); }
  .rl-orb.o1 { width: 62vmax; height: 62vmax; top: -26vmax; right: -20vmax; background: radial-gradient(circle, rgba(217,70,239,0.62), rgba(99,102,241,0.3) 45%, transparent 70%); animation: rl-float 16s ease-in-out infinite; }
  .rl-orb.o2 { width: 58vmax; height: 58vmax; bottom: -28vmax; right: -16vmax; background: radial-gradient(circle, rgba(251,146,60,0.5), rgba(168,85,247,0.34) 48%, transparent 70%); animation: rl-float 19s ease-in-out infinite reverse; }
  .rl-orb.o3 { width: 52vmax; height: 52vmax; top: 18%; left: -26vmax; background: radial-gradient(circle, rgba(34,211,238,0.28), rgba(59,70,210,0.3) 50%, transparent 72%); animation: rl-float 22s ease-in-out infinite; }

  .rl-band { height: 110px; border-radius: 60px; filter: blur(22px); transform-origin: 100% 50%; transform: rotate(-38deg); }
  .rl-band.bd1 { top: 8%; right: -6%; width: 78vmax; background: linear-gradient(90deg, transparent, rgba(139,92,246,0.42) 60%, rgba(34,211,238,0.4)); }
  .rl-band.bd2 { top: 30%; right: -10%; width: 54vmax; height: 70px; background: linear-gradient(90deg, transparent, rgba(217,70,239,0.3) 65%, rgba(251,146,60,0.28)); }

  .rl-beam { height: 3px; border-radius: 3px; animation: rl-pulse 4.5s ease-in-out infinite; }
  .rl-beam.b1, .rl-beam.b2, .rl-beam.b3, .rl-beam.b4 { transform-origin: 100% 50%; transform: rotate(-38deg); }
  .rl-beam.b5, .rl-beam.b6, .rl-beam.b7 { transform-origin: 0 50%; transform: rotate(-38deg); }
  .rl-beam.b1 { top: 5%; right: -4%; width: 66vmax; background: linear-gradient(90deg, transparent, #67E8F9 70%, #fff); box-shadow: 0 0 12px #22D3EE, 0 0 38px rgba(34,211,238,0.75); }
  .rl-beam.b2 { top: 13%; right: -6%; width: 50vmax; height: 2.5px; background: linear-gradient(90deg, transparent, #E879F9 70%, #fff); box-shadow: 0 0 12px #D946EF, 0 0 34px rgba(217,70,239,0.7); animation-delay: -1.5s; }
  .rl-beam.b3 { top: 0; right: 5%; width: 80vmax; height: 1.5px; background: linear-gradient(90deg, transparent, #A78BFA 75%, #fff); box-shadow: 0 0 10px #8B5CF6; animation-delay: -3s; }
  .rl-beam.b4 { top: 22%; right: -9%; width: 40vmax; height: 1.5px; background: linear-gradient(90deg, transparent, #67E8F9); box-shadow: 0 0 10px #22D3EE; opacity: .8; animation-delay: -2s; }
  .rl-beam.b5 { left: 50%; bottom: 7%; width: 56vmax; background: linear-gradient(90deg, transparent, #FB923C 55%, #FDE68A); box-shadow: 0 0 12px #FB923C, 0 0 40px rgba(251,146,60,0.75); animation-delay: -1s; }
  .rl-beam.b6 { left: 62%; bottom: 0; width: 44vmax; height: 2.5px; background: linear-gradient(90deg, transparent, #D946EF 55%, #F5D0FE); box-shadow: 0 0 12px #D946EF, 0 0 34px rgba(217,70,239,0.7); animation-delay: -2.5s; }
  .rl-beam.b7 { left: 36%; bottom: 13%; width: 36vmax; height: 1.5px; background: linear-gradient(90deg, transparent, #A78BFA 55%, #67E8F9); box-shadow: 0 0 10px #8B5CF6; animation-delay: -3.5s; }

  .rl-sp { width: 3px; height: 3px; border-radius: 50%; background: #CFFAFE; box-shadow: 0 0 8px 2px rgba(103,232,249,0.8); animation: rl-twinkle 3.6s ease-in-out infinite; }
  .rl-sp.s1 { top: 14%; left: 12%; } .rl-sp.s2 { top: 26%; right: 18%; animation-delay: -1s; } .rl-sp.s3 { top: 48%; left: 6%; animation-delay: -2s; }
  .rl-sp.s4 { top: 62%; right: 9%; animation-delay: -.5s; } .rl-sp.s5 { bottom: 18%; left: 20%; animation-delay: -2.8s; } .rl-sp.s6 { top: 8%; left: 44%; animation-delay: -1.6s; }
  .rl-sp.s7 { bottom: 8%; right: 30%; animation-delay: -3.1s; } .rl-sp.s8 { top: 38%; right: 4%; animation-delay: -2.3s; }

  @keyframes rl-float { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(-2.5vmax, 2vmax, 0); } }
  @keyframes rl-pulse { 0%, 100% { opacity: .72; } 50% { opacity: 1; } }
  @keyframes rl-twinkle { 0%, 100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.3); } }
  @media (prefers-reduced-motion: reduce) { .rl-orb, .rl-beam, .rl-sp { animation: none; } }
  .rl-stage { position: relative; z-index: 1; width: 100%; max-width: 780px; }

  .rl-brand { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
  .rl-mark {
    width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(145deg, #34D27A, #12A150);
    box-shadow: 0 10px 26px -6px rgba(34,197,94,0.6), 0 1px 0 rgba(255,255,255,0.35) inset;
  }
  .rl-name { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 25px; letter-spacing: -0.01em; color: #fff; }
  .rl-name span, .rl-title span { color: #22D3EE; }
  .rl-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 46px; line-height: 1.08; letter-spacing: -0.02em; color: #fff; margin: 0 0 12px; }
  .rl-sub { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.55; color: rgba(226,232,255,0.82); margin: 0 0 26px; max-width: 420px; }

  .rl-row { display: grid; grid-template-columns: minmax(0, 500px) 1fr; gap: 24px; align-items: center; }

  .rl-card {
    position: relative; padding: 26px 24px 22px; border-radius: 26px; border: 1.5px solid transparent;
    background:
      linear-gradient(160deg, rgba(20,26,96,0.88), rgba(10,13,60,0.9)) padding-box,
      linear-gradient(135deg, #22D3EE 0%, #6366F1 55%, #A855F7 100%) border-box;
    box-shadow: 0 0 46px -8px rgba(99,102,241,0.55), 0 30px 60px -30px rgba(0,0,0,0.8);
    -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  }
  .rl-label { display: block; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #F1F4FF; margin: 0 0 9px; }
  .rl-input-wrap { position: relative; margin-bottom: 18px; }
  .rl-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: rgba(226,232,255,0.9); pointer-events: none; transition: color .15s; }
  .rl-input {
    width: 100%; height: 54px; padding: 0 16px 0 48px;
    font-family: 'Inter', sans-serif; font-size: 15px; color: #fff;
    background: rgba(40,52,150,0.32); border: 1px solid rgba(140,155,255,0.2); border-radius: 14px; outline: none;
    transition: border-color .15s, box-shadow .15s, background .15s;
  }
  .rl-input-pw { padding-right: 52px; }
  .rl-input::placeholder { color: rgba(226,232,255,0.4); }
  .rl-input:hover { border-color: rgba(160,175,255,0.35); }
  .rl-input:focus { background: rgba(40,60,170,0.4); border-color: #22D3EE; box-shadow: 0 0 0 4px rgba(34,211,238,0.16); }
  .rl-input-wrap:focus-within .rl-icon { color: #67E8F9; }
  .rl-input:-webkit-autofill, .rl-input:-webkit-autofill:focus {
    -webkit-text-fill-color: #fff; caret-color: #fff; box-shadow: 0 0 0 1000px #151C6E inset; transition: background-color 9999s;
  }
  .rl-eye {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
    color: rgba(226,232,255,0.85); background: transparent; border: 0; border-radius: 11px; cursor: pointer;
  }
  .rl-eye:hover { background: rgba(255,255,255,0.08); color: #fff; }
  .rl-eye:focus-visible { outline: 2px solid #22D3EE; outline-offset: 1px; }
  .rl-error {
    display: flex; align-items: center; gap: 8px; margin: -4px 0 16px; padding: 11px 13px;
    background: rgba(244,63,94,0.14); border: 1px solid rgba(244,63,94,0.35); border-radius: 12px;
    font-family: 'Inter', sans-serif; font-size: 13px; color: #FDA4AF;
  }
  .rl-btn {
    width: 100%; height: 58px; margin-top: 4px; border: 0; border-radius: 17px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 17px; font-weight: 600; color: #fff;
    background: linear-gradient(90deg, #2DE8C0 0%, #22C1EE 50%, #4C7DFF 100%);
    box-shadow: 0 14px 34px -10px rgba(34,211,238,0.8), 0 1px 0 rgba(255,255,255,0.4) inset;
    transition: transform .12s, box-shadow .15s, filter .15s;
  }
  .rl-btn:hover:not(:disabled) { filter: brightness(1.08); box-shadow: 0 18px 40px -10px rgba(34,211,238,0.95), 0 1px 0 rgba(255,255,255,0.4) inset; }
  .rl-btn:active:not(:disabled) { transform: translateY(1px); }
  .rl-btn:focus-visible { outline: 3px solid rgba(103,232,249,0.55); outline-offset: 3px; }
  .rl-btn:disabled { opacity: .65; cursor: default; }
  .rl-trust {
    display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; margin-top: 22px;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; color: rgba(226,232,255,0.88);
  }
  .rl-trust span { display: inline-flex; align-items: center; gap: 6px; }
  .rl-trust svg { color: #38BDF8; }
  .rl-trust i { width: 3px; height: 3px; border-radius: 50%; background: rgba(226,232,255,0.45); }

  .rl-tiles { display: flex; flex-direction: column; align-items: center; gap: 26px; }
  .rl-tile {
    display: flex; align-items: center; justify-content: center; color: #fff;
    border-radius: 26%; border: 1.5px solid rgba(190,215,255,0.5);
    transform: perspective(500px) rotateY(-22deg) rotateX(8deg) rotateZ(4deg);
  }
  .rl-tile svg { width: 50%; height: 50%; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35)); }
  .rl-tile-a { width: 124px; height: 124px; background: linear-gradient(145deg, rgba(52,210,122,0.9), rgba(16,120,80,0.85)); box-shadow: 0 0 40px -4px rgba(52,210,122,0.65), 12px 14px 0 -2px rgba(10,60,50,0.55); }
  .rl-tile-b { width: 88px; height: 88px; background: linear-gradient(145deg, rgba(59,130,246,0.92), rgba(37,60,190,0.9)); box-shadow: 0 0 34px -4px rgba(59,130,246,0.7), 10px 12px 0 -2px rgba(20,30,110,0.6); }
  .rl-tile-c { width: 88px; height: 88px; background: linear-gradient(145deg, rgba(168,85,247,0.92), rgba(88,40,200,0.92)); box-shadow: 0 0 34px -4px rgba(168,85,247,0.7), 10px 12px 0 -2px rgba(50,20,120,0.6); }

  @media (max-width: 700px) {
    .rl-screen { align-items: flex-start; padding-top: max(36px, env(safe-area-inset-top)); }
    .rl-title { font-size: 38px; }
    .rl-row { grid-template-columns: minmax(0, 1fr) 62px; gap: 12px; align-items: start; }
    .rl-tiles { gap: 18px; padding-top: 6px; margin-top: -120px; }
    .rl-tile-a { width: 68px; height: 68px; box-shadow: 0 0 26px -4px rgba(52,210,122,0.65), 6px 8px 0 -2px rgba(10,60,50,0.55); }
    .rl-tile-b, .rl-tile-c { width: 52px; height: 52px; box-shadow: 0 0 22px -4px rgba(99,102,241,0.7), 5px 6px 0 -2px rgba(20,30,110,0.6); }
    .rl-card { padding: 22px 18px 18px; border-radius: 22px; }
    .rl-input { font-size: 16px; } /* stops iOS zoom on focus */
  }
  @media (max-width: 380px) {
    .rl-row { grid-template-columns: minmax(0, 1fr); }
    .rl-tiles { display: none; }
  }
`;

// ============================================================
// SIDEBAR + TOPBAR
// ============================================================
// ============================================================
// PREFERENCES — appearance, accessibility, language (saved on this device)
// ============================================================
const PREFS_KEY = "relay.prefs.v1";
const DEFAULT_PREFS = { theme: "light", textSize: "normal", contrast: false, reduceMotion: false, lang: "en", landing: "dashboard", sidebar: "expanded", density: "comfortable", timeFormat: "12h", inboxBadge: true, backupReminder: "off", lastBackupAt: null };
let LIVE_PREFS = DEFAULT_PREFS; // always the latest saved prefs (read by helpers that run outside React)
function loadPrefs() { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return { ...DEFAULT_PREFS }; } }
function applyPrefs(p) {
  LIVE_PREFS = p;
  const el = document.documentElement;
  el.dataset.density = p.density || "comfortable";
  const dark = p.theme === "dark" || (p.theme === "system" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  el.classList.toggle("relay-dark", dark);
  el.classList.toggle("relay-contrast", !!p.contrast);
  el.classList.toggle("relay-reduce-motion", !!p.reduceMotion);
  el.dataset.textSize = p.textSize;
  el.lang = p.lang;
}
const PREFS = loadPrefs();
applyPrefs(PREFS);

const LANGS = [["en", "English"], ["hi", "हिन्दी (Hindi)"], ["mr", "मराठी (Marathi)"]];
const I18N = {
  hi: { "Dashboard": "डैशबोर्ड", "Inbox": "इनबॉक्स", "WhatsApp Numbers": "व्हाट्सऐप नंबर", "Contacts / CRM": "संपर्क / CRM", "Campaigns": "कैंपेन", "Automations": "ऑटोमेशन", "Chatbot": "चैटबॉट", "Analytics": "एनालिटिक्स", "Settings": "सेटिंग्स", "Admins": "एडमिन", "Activity Logs": "गतिविधि लॉग", "Contacts": "संपर्क", "More": "और", "Profile": "प्रोफ़ाइल", "API Keys": "API कीज़", "About": "जानकारी", "Appearance": "दिखावट", "Accessibility": "सुगम्यता", "Language": "भाषा", "Storage & data": "स्टोरेज और डेटा", "Sign out": "साइन आउट" },
  mr: { "Dashboard": "डॅशबोर्ड", "Inbox": "इनबॉक्स", "WhatsApp Numbers": "व्हॉट्सॲप क्रमांक", "Contacts / CRM": "संपर्क / CRM", "Campaigns": "मोहिमा", "Automations": "ऑटोमेशन", "Chatbot": "चॅटबॉट", "Analytics": "विश्लेषण", "Settings": "सेटिंग्ज", "Admins": "अ‍ॅडमिन", "Activity Logs": "क्रियाकलाप नोंदी", "Contacts": "संपर्क", "More": "अधिक", "Profile": "प्रोफाइल", "API Keys": "API की", "About": "माहिती", "Appearance": "दिसणे", "Accessibility": "सुलभता", "Language": "भाषा", "Storage & data": "स्टोरेज आणि डेटा", "Sign out": "साइन आउट" },
};
const tr = (text) => (I18N[PREFS.lang] && I18N[PREFS.lang][text]) || text;

const NAV_ADMIN = [
  { key: "dashboard", label: tr("Dashboard"), icon: LayoutGrid },
  { key: "inbox", label: tr("Inbox"), icon: InboxIcon },
  { key: "numbers", label: tr("WhatsApp Numbers"), icon: Phone },
  { key: "crm", label: tr("Contacts / CRM"), icon: Contact },
  { key: "campaigns", label: tr("Campaigns"), icon: Megaphone },
  { key: "automations", label: tr("Automations"), icon: Workflow },
  { key: "chatbot", label: tr("Chatbot"), icon: Bot },
  { key: "analytics", label: tr("Analytics"), icon: BarChart3 },
  { key: "settings", label: tr("Settings"), icon: SettingsIcon },
];
const NAV_SUPER = [
  { key: "dashboard", label: tr("Dashboard"), icon: LayoutGrid },
  { key: "admins", label: tr("Admins"), icon: Users },
  { key: "numbers", label: tr("WhatsApp Numbers"), icon: Phone },
  { key: "inbox", label: tr("Inbox"), icon: InboxIcon },
  { key: "crm", label: tr("Contacts / CRM"), icon: Contact },
  { key: "campaigns", label: tr("Campaigns"), icon: Megaphone },
  { key: "automations", label: tr("Automations"), icon: Workflow },
  { key: "chatbot", label: tr("Chatbot"), icon: Bot },
  { key: "analytics", label: tr("Analytics"), icon: BarChart3 },
  { key: "activity", label: tr("Activity Logs"), icon: ScrollText },
  { key: "settings", label: tr("Settings"), icon: SettingsIcon },
];

function Sidebar({ role, page, setPage, collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { logout } = useAuth();
  const items = role === "super_admin" ? NAV_SUPER : NAV_ADMIN;
  const convos = useApiList("/inbox/conversations");
  const unread = Array.isArray(convos.data) ? convos.data.reduce((n, c) => n + (c.unread_count || 0), 0) : 0;

  return (
    <div className={`relay-sidebar rl-side h-full flex flex-col shrink-0${mobileOpen ? " relay-sidebar-open" : ""}${collapsed ? " is-collapsed" : ""}`} style={{ width: collapsed ? 76 : 252 }}>
      <div className="rl-side-brand">
        <div className="rl-side-mark"><InboxIcon size={22} color="white" /></div>
        {!collapsed && <span className="rl-side-name">Ramorra<em>.io</em></span>}

        <button type="button" className="relay-sidebar-collapse rl-side-collapse" onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        <button type="button" className="relay-mobile-close rl-side-close" onClick={() => setMobileOpen(false)} title="Close menu" aria-label="Close menu" style={{ display: "none" }}>
          <X size={16} color="#DCE6F5" />
        </button>
      </div>

      <nav className="rl-side-nav">
        {items.map((it) => {
          const active = page === it.key;
          const Icon = it.icon;
          const badge = it.key === "inbox" && unread > 0 && LIVE_PREFS.inboxBadge !== false ? (unread > 99 ? "99+" : unread) : null;
          return (
            <button key={it.key} onClick={() => { setPage(it.key); setMobileOpen(false); }}
              className={`rl-side-item${active ? " is-active" : ""}`} title={collapsed ? it.label : undefined} aria-current={active ? "page" : undefined}>
              <Icon size={20} />
              {!collapsed && <span className="rl-side-label">{it.label}</span>}
              {badge != null && (collapsed ? <i className="rl-side-dot" /> : <b className="rl-side-badge">{badge}</b>)}
            </button>
          );
        })}
      </nav>

      <div className="rl-side-foot">
        <button onClick={logout} className="rl-side-item" title={collapsed ? "Sign out" : undefined}>
          <LogOut size={20} />
          {!collapsed && <span className="rl-side-label">{tr("Sign out")}</span>}
        </button>
      </div>
    </div>
  );
}

function Topbar({ onMenu }) {
  const { role, name, logout } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const roleLabel = role === "super_admin" ? "Super Admin" : "Admin";
  return (
    <div className="relay-topbar rl-top shrink-0" style={{ position: "relative", zIndex: 30 }}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button type="button" className="relay-mobile-menu-btn" onClick={onMenu} aria-label="Open navigation">
          <Menu size={20} color={C.inkSoft} />
        </button>

        <div className="relay-topbar-search rl-search">
          <Search size={18} color="#8A94A8" />
          <input placeholder="Search contacts, numbers, campaigns..." aria-label="Search" />
        </div>
      </div>

      <div className="relay-topbar-actions flex items-center gap-3 ml-3 shrink-0">
        <div style={{ position: "relative" }}>
          <button type="button" onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }} className="rl-bell" aria-label="Notifications" title="Notifications">
            <Bell size={20} color="#33405C" />
          </button>
          {notifOpen && (
            <div className="rl-pop" style={{ width: 240 }}>
              <div className="text-[13px] font-semibold" style={{ fontFamily: F.d, color: C.ink }}>Notifications</div>
              <div className="text-[12px] mt-1" style={{ fontFamily: F.b, color: C.inkSoft }}>No new notifications.</div>
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <button type="button" onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }} className="rl-user" aria-label="Profile menu" title="Profile menu">
            <span className="rl-avatar">{initials(name)}</span>
            <span className="relay-topbar-user-details">
              <span className="rl-user-name">{name}</span>
              <span className="rl-user-role">{roleLabel}</span>
            </span>
            <ChevronDown className="relay-topbar-chevron" size={16} color="#5B6882" />
          </button>
          {profileOpen && (
            <div className="rl-pop" style={{ width: 200 }}>
              <div className="px-2 py-1.5">
                <div className="text-[13px] font-medium" style={{ fontFamily: F.b, color: C.ink }}>{name}</div>
                <div className="text-[11.5px]" style={{ fontFamily: F.b, color: C.inkFaint }}>{roleLabel}</div>
              </div>
              <button type="button" onClick={logout} className="w-full text-left px-2 py-2 text-[12.5px]" style={{ fontFamily: F.b, color: C.rust, borderRadius: 6 }}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARDS
// ============================================================
const pctOf = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
const Dot = ({ c }) => <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: c, marginRight: 6 }} />;

function SuperAdminDashboard() {
  const admins = useApiList("/admins");
  const numbers = useApiList("/numbers");
  const summary = useApiList("/analytics/summary");

  if (admins.error || numbers.error || summary.error) {
    return <ErrorBanner message={admins.error || numbers.error || summary.error} onRetry={() => { admins.reload(); numbers.reload(); summary.reload(); }} />;
  }
  if (admins.loading || numbers.loading || summary.loading) return <TableSkeleton rows={8} />;

  const nums = numbers.data;
  const s = summary.data;
  const activeCount = nums.filter((n) => n.status === "active").length;
  const warnErr = nums.filter((n) => n.status === "warning" || n.status === "error").length;
  const inactive = nums.filter((n) => n.status === "inactive").length;
  const activeAdmins = admins.data.filter((a) => a.status === "active").length;
  const deliveryRate = pctOf(s.delivered, s.messages_sent);
  const failRate = pctOf(s.failed, s.messages_sent);

  return (
    <div>
      <PageHeader title="Control center" desc={`Monitoring ${admins.data.length} admins across ${nums.length} WhatsApp numbers`} />

      <div className="rl-kpi-grid">
        <KpiCard icon={UserCog} label="Total Admins" value={admins.data.length} accent="#12A06B" soft="#E3F4EA"
          sub={<><Dot c="#12A06B" />{activeAdmins} active</>} ratio={pctOf(activeAdmins, admins.data.length)} />
        <KpiCard icon={MessageCircle} label="WhatsApp Numbers" value={nums.length} accent="#0E8A7A" soft="#DDF3F0"
          sub={<><Dot c="#12A06B" />{activeCount} active</>} ratio={pctOf(activeCount, nums.length)} />
        <KpiCard icon={AlertCircle} label="Warning / Error" value={warnErr} accent="#E5484D" soft="#FDE8E8"
          sub={`${pctOf(warnErr, nums.length)}% of numbers`} ratio={pctOf(warnErr, nums.length)} />
        <KpiCard icon={Power} label="Inactive" value={inactive} accent="#7C5CE0" soft="#EEE8FD"
          sub={`${pctOf(inactive, nums.length)}% of numbers`} ratio={pctOf(inactive, nums.length)} />

        <KpiCard icon={Send} label="Messages Sent" value={s.messages_sent.toLocaleString()} accent="#12A06B" soft="#E3F4EA" sub="Sent today, all numbers" />
        <KpiCard icon={CheckCheck} label="Delivered" value={s.delivered.toLocaleString()} accent="#2F7DE1" soft="#E4EEFC"
          sub={`${deliveryRate}% delivery rate`} ratio={deliveryRate} />
        <KpiCard icon={X} label="Failed" value={s.failed.toLocaleString()} accent="#E5484D" soft="#FDE8E8"
          sub={`${failRate}% failure rate`} ratio={failRate} />
        <KpiCard icon={Zap} label="Conversion Rate" value={`${s.conversion_rate}%`} accent="#F0A020" soft="#FDF1DB"
          sub={`${s.leads} lead${s.leads === 1 ? "" : "s"}`} ratio={s.conversion_rate} bar />
      </div>

      <DashPanel title="Admin performance">
        <DashTable cols={[["Admin", Users], ["Numbers", Phone], ["Sent", Send], ["Replies", MessageCircle], ["Leads", Contact], ["Conversion", BarChart3], ["Status", CircleDot]]}>
          {admins.data.map((a) => (
            <tr key={a.id}>
              <td>
                <span className="rl-person">
                  <span className="rl-person-av" style={{ background: colorForId(a.id) }}>{initials(a.name)}</span>
                  <span className="rl-person-name">{a.name}</span>
                </span>
              </td>
              <td>{a.numbers_count}</td>
              <td>{a.messages_sent.toLocaleString()}</td>
              <td>{a.replies.toLocaleString()}</td>
              <td>{a.leads}</td>
              <td>{a.conversion_rate}%</td>
              <td><StatusPill status={a.status} /></td>
            </tr>
          ))}
        </DashTable>
      </DashPanel>

      <DashPanel title="WhatsApp number monitoring" foot={`Showing ${Math.min(8, nums.length)} of ${nums.length} numbers — full table on the WhatsApp Numbers page.`}>
        <DashTable cols={[["Number", Phone], ["Status", CircleDot], ["Messages Today", Send], ["Delivery Rate", CheckCheck], ["Reply Rate", MessageCircle], ["Last Activity", Clock]]}>
          {nums.slice(0, 8).map((n) => (
            <tr key={n.id}>
              <td><span className="rl-person-name">{n.phone}</span></td>
              <td><StatusPill status={n.status} /></td>
              <td>{n.messages_today.toLocaleString()}</td>
              <td>{n.delivery_rate}%</td>
              <td>{n.reply_rate}%</td>
              <td>{fmtDateTime(n.last_activity_at)}</td>
            </tr>
          ))}
        </DashTable>
      </DashPanel>
    </div>
  );
}

function AdminDashboard() {
  const numbers = useApiList("/numbers");
  const automations = useApiList("/automations");
  const summary = useApiList("/analytics/summary");

  if (numbers.error || automations.error || summary.error) {
    return <ErrorBanner message={numbers.error || automations.error || summary.error} onRetry={() => { numbers.reload(); automations.reload(); summary.reload(); }} />;
  }
  if (numbers.loading || automations.loading || summary.loading) return <TableSkeleton rows={6} />;

  const s = summary.data;
  const runningCount = automations.data.filter((a) => a.status === "Running").length;
  const deliveryRate = pctOf(s.delivered, s.messages_sent);

  return (
    <div>
      <PageHeader title="Your workspace" desc={`${numbers.data.length} WhatsApp numbers \u00b7 ${runningCount} active automations`} />

      <div className="rl-kpi-grid rl-kpi-grid-5">
        <KpiCard icon={Send} label="Messages Sent" value={s.messages_sent.toLocaleString()} accent="#12A06B" soft="#E3F4EA" sub="Sent today" />
        <KpiCard icon={CheckCheck} label="Delivered" value={s.delivered.toLocaleString()} accent="#2F7DE1" soft="#E4EEFC" sub={`${deliveryRate}% delivery rate`} ratio={deliveryRate} />
        <KpiCard icon={MessageCircle} label="Replies" value={s.replies.toLocaleString()} accent="#0E8A7A" soft="#DDF3F0" sub={`${pctOf(s.replies, s.messages_sent)}% of sent`} ratio={pctOf(s.replies, s.messages_sent)} />
        <KpiCard icon={Contact} label="Leads" value={s.leads} accent="#F0A020" soft="#FDF1DB" />
        <KpiCard icon={Zap} label="Conversion Rate" value={`${s.conversion_rate}%`} accent="#7C5CE0" soft="#EEE8FD" ratio={s.conversion_rate} bar />
      </div>

      <DashPanel title="Automation progress">
        <DashTable cols={[["Automation", Workflow], ["Status", CircleDot], ["Recipients", Users], ["Sent", Send], ["Delivered", CheckCheck], ["Replies", MessageCircle], ["Progress", BarChart3]]}>
          {automations.data.map((a) => {
            const progress = a.recipients ? Math.round((a.sent / a.recipients) * 100) : 0;
            return (
              <tr key={a.id}>
                <td><span className="rl-person-name">{a.name}</span></td>
                <td><StatusPill status={a.status} /></td>
                <td>{a.recipients.toLocaleString()}</td>
                <td>{a.sent.toLocaleString()}</td>
                <td>{a.delivered.toLocaleString()}</td>
                <td>{a.replies}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div style={{ width: 90, height: 6, background: "#E8EDF5", borderRadius: 3 }}><div style={{ width: `${progress}%`, height: 6, background: "#12A06B", borderRadius: 3 }} /></div>
                    <span className="text-[12px]" style={{ fontFamily: F.b, color: C.inkSoft }}>{progress}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </DashTable>
      </DashPanel>
    </div>
  );
}

// ============================================================
// WHATSAPP NUMBERS
// ============================================================
const NUM_STATUS_ORDER = { active: 0, warning: 1, error: 2, inactive: 3 };
const NUM_COLS = [["phone", "Phone Number"], ["display_name", "Display Name"], ["status", "Status"], ["messages_today", "Messages Today"], ["delivery_rate", "Delivery Rate"], ["reply_rate", "Reply Rate"], ["last_activity_at", "Last Activity"]];
const NUM_SORT = {
  phone: (n) => n.phone, display_name: (n) => (n.display_name || "").toLowerCase(), status: (n) => NUM_STATUS_ORDER[n.status] ?? 9,
  messages_today: (n) => n.messages_today, delivery_rate: (n) => n.delivery_rate, reply_rate: (n) => n.reply_rate,
  last_activity_at: (n) => new Date(n.last_activity_at).getTime() || 0,
};

function SortIcon({ dir }) {
  return (
    <svg width="9" height="13" viewBox="0 0 10 14" aria-hidden="true">
      <path d="M5 1 L9 5.5 H1 Z" fill={dir === "asc" ? "#1B2B55" : "#B5BED0"} />
      <path d="M5 13 L1 8.5 H9 Z" fill={dir === "desc" ? "#1B2B55" : "#B5BED0"} />
    </svg>
  );
}

function NumbersPage({ role }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const perPage = 10;

  const numbers = useApiList("/numbers");
  const admins = useApiList("/admins", { enabled: role === "super_admin" });

  const all = numbers.data;
  const countOf = (st) => all.filter((n) => n.status === st).length;
  const counts = { all: all.length, active: countOf("active"), warning: countOf("warning"), error: countOf("error"), inactive: countOf("inactive") };
  const filtered = statusFilter === "all" ? all : all.filter((n) => n.status === statusFilter);
  const rows = sort.key
    ? [...filtered].sort((x, y) => { const a = NUM_SORT[sort.key](x), b = NUM_SORT[sort.key](y); const r = a < b ? -1 : a > b ? 1 : 0; return sort.dir === "asc" ? r : -r; })
    : filtered;
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const cur = Math.min(pageNum, totalPages);
  const paged = rows.slice((cur - 1) * perPage, cur * perPage);
  const winSize = Math.min(5, totalPages);
  const winStart = Math.max(1, Math.min(cur - 2, totalPages - winSize + 1));
  const pages = Array.from({ length: winSize }, (_, i) => winStart + i);

  const toggleSort = (key) => { setSort((sv) => (sv.key === key ? { key, dir: sv.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })); setPageNum(1); };
  const pick = (k) => { setStatusFilter(k); setPageNum(1); };

  if (numbers.error) return <ErrorBanner message={numbers.error} onRetry={numbers.reload} />;
  if (numbers.loading) return <TableSkeleton rows={8} />;

  const pct = (n) => pctOf(n, counts.all);

  return (
    <div>
      <div className="rl-kpi-grid rl-kpi-grid-5">
        <KpiCard icon={Phone} label="Total Numbers" value={counts.all} accent="#0E8A7A" soft="#DDF3F0" sub="All connected numbers" />
        <KpiCard icon={MessageCircle} label="Active" value={counts.active} accent="#12A06B" soft="#E3F4EA" sub={`${pct(counts.active)}% of numbers`} ratio={pct(counts.active)} />
        <KpiCard icon={AlertCircle} label="Warnings" value={counts.warning} accent="#F0A020" soft="#FDF1DB" sub={`${pct(counts.warning)}% of numbers`} ratio={pct(counts.warning)} />
        <KpiCard icon={X} label="Errors" value={counts.error} accent="#E5484D" soft="#FDE8E8" sub={`${pct(counts.error)}% of numbers`} ratio={pct(counts.error)} />
        <KpiCard icon={Power} label="Inactive" value={counts.inactive} accent="#6B7A99" soft="#EDF1F7" sub={`${pct(counts.inactive)}% of numbers`} ratio={pct(counts.inactive)} />
      </div>

      <section className="rl-panel rl-nm-panel">
        <div className="rl-nm-head">
          <div>
            <h2 className="rl-nm-title">{counts.all} {counts.all === 1 ? "number" : "numbers"} connected</h2>
            <p className="rl-nm-sub">Monitor and manage your WhatsApp numbers</p>
          </div>
          {role === "super_admin" && <button type="button" className="rl-ad-add" onClick={() => setShowAdd(true)}><Plus size={16} /> Add number</button>}
        </div>

        <div className="rl-pills">
          {[["all", "All"], ["active", "Active"], ["warning", "Warning"], ["error", "Error"], ["inactive", "Inactive"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => pick(k)} className={`rl-pill rl-pill-${k}${statusFilter === k ? " is-on" : ""}`}>{l}<b>{counts[k]}</b></button>
          ))}
        </div>

        <div className="rl-table-wrap">
          <table className="rl-table rl-table-nm">
            <thead>
              <tr>
                {NUM_COLS.map(([k, label]) => (
                  <th key={k} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" className="rl-sortbtn" onClick={() => toggleSort(k)}>{label}<SortIcon dir={sort.key === k ? sort.dir : null} /></button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((n) => (
                <tr key={n.id}>
                  <td><span className="rl-ad-cell"><Phone size={16} color="#12A06B" />{n.phone}</span></td>
                  <td>{n.display_name}</td>
                  <td><StatusPill status={n.status} /></td>
                  <td>{n.messages_today.toLocaleString()}</td>
                  <td>{n.delivery_rate}%</td>
                  <td>{n.reply_rate}%</td>
                  <td><span className="rl-ad-cell"><Clock size={15} color="#5B6882" />{fmtDateTime(n.last_activity_at)}</span></td>
                </tr>
              ))}
              {paged.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#7A859D", padding: "28px 18px" }}>No numbers with this status.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rl-pager">
          <span className="rl-pager-info">Page {cur} of {totalPages} · {rows.length} {rows.length === 1 ? "number" : "numbers"}</span>
          <div className="rl-pager-btns">
            <button type="button" className="rl-pg" disabled={cur === 1} onClick={() => setPageNum(cur - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
            {pages.map((n) => <button key={n} type="button" className={`rl-pg${n === cur ? " is-on" : ""}`} onClick={() => setPageNum(n)} aria-current={n === cur ? "page" : undefined}>{n}</button>)}
            <button type="button" className="rl-pg" disabled={cur === totalPages} onClick={() => setPageNum(cur + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
          </div>
        </div>
      </section>

      {showAdd && (
        <AddNumberModal admins={admins.data} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); numbers.reload(); }} />
      )}
    </div>
  );
}

function AddNumberModal({ admins, onClose, onAdded }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ phone: "", display_name: "", waba_id: "", phone_number_id: "", admin_id: admins[0]?.id || "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/numbers", { method: "POST", token, body: form });
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add WhatsApp number" onClose={onClose}>
      <Field label="Phone number"><input style={inputStyle} placeholder="+91 98XXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
      <Field label="Display name"><input style={inputStyle} placeholder="Sales Line — Mumbai" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></Field>
      <Field label="WhatsApp Business Account ID"><input style={inputStyle} placeholder="WABA ID" value={form.waba_id} onChange={(e) => setForm({ ...form, waba_id: e.target.value })} /></Field>
      <Field label="Phone Number ID"><input style={inputStyle} placeholder="Meta phone number ID" value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} /></Field>
      <Field label="Assigned admin">
        <select style={inputStyle} value={form.admin_id} onChange={(e) => setForm({ ...form, admin_id: e.target.value })}>
          {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      {error && <div className="text-[11.5px] mb-3" style={{ fontFamily: F.b, color: C.rust }}>{error}</div>}
      <div className="flex gap-2 mt-4">
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn disabled={submitting || !form.phone || !form.admin_id} onClick={submit}>{submitting ? "Adding..." : "Add number"}</PrimaryBtn>
      </div>
    </Modal>
  );
}

// ============================================================
// ADMINS PAGE (super admin only)
// ============================================================
const AVATAR_GRADS = [
  "linear-gradient(145deg,#7C6CF6,#5B4BD8)", "linear-gradient(145deg,#FF5C93,#EF2F6E)", "linear-gradient(145deg,#FFA13D,#F2711C)",
  "linear-gradient(145deg,#2DD4BF,#0E9AA7)", "linear-gradient(145deg,#B26BF5,#8B3FE0)", "linear-gradient(145deg,#4F9BFF,#2563EB)",
  "linear-gradient(145deg,#FFC24D,#F29B12)", "linear-gradient(145deg,#34D3A0,#0E9F77)",
];
function avatarGrad(id) {
  let h = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_GRADS[h % AVATAR_GRADS.length];
}
function TrendUp({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function AdminsPage() {
  const admins = useApiList("/admins");
  const [showAdd, setShowAdd] = useState(false);
  const count = admins.data.length;

  return (
    <div>
      {admins.error && <ErrorBanner message={admins.error} onRetry={admins.reload} />}
      {admins.loading && <TableSkeleton rows={8} />}
      {!admins.loading && !admins.error && (
        <section className="rl-ad-panel">
          <div className="rl-ad-head">
            <div className="rl-ad-title">
              <span className="rl-ad-ico"><Users size={22} /></span>
              <span className="rl-ad-count">{count}</span>
              <span className="rl-ad-word">{count === 1 ? "admin" : "admins"}</span>
            </div>
            <button type="button" className="rl-ad-add" onClick={() => setShowAdd(true)}><Plus size={16} /> Add admin</button>
          </div>

          <DashTable variant="blue" cols={[["Admin", Users, "#2F6FE0"], ["Email", Mail, "#2F6FE0"], ["Phone", Phone, "#2F6FE0"], ["Numbers", Tag, "#2F6FE0"], ["Messages", MessageCircle, "#2F6FE0"], ["Leads", Contact, "#2F6FE0"], ["Conversion", TrendUp, "#12A06B"], ["Status", CircleDot, "#12A06B"]]}>
            {admins.data.map((a) => (
              <tr key={a.id}>
                <td>
                  <span className="rl-person">
                    <span className="rl-person-av rl-ad-av" style={{ background: avatarGrad(a.id) }}>{initials(a.name)}</span>
                    <span className="rl-ad-name">{a.name}</span>
                  </span>
                </td>
                <td><span className="rl-ad-cell"><Mail size={16} />{a.email}</span></td>
                <td><span className="rl-ad-cell"><Phone size={16} />{a.phone}</span></td>
                <td>{a.numbers_count}</td>
                <td>{a.messages_sent.toLocaleString()}</td>
                <td>{a.leads}</td>
                <td><span className="rl-ad-conv"><TrendUp size={17} />{a.conversion_rate}%</span></td>
                <td><StatusPill status={a.status} /></td>
              </tr>
            ))}
            {count === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#7A859D", padding: "28px 18px" }}>No admins yet. Use Add admin to invite the first one.</td></tr>}
          </DashTable>
        </section>
      )}

      {showAdd && <AddAdminModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); admins.reload(); }} />}
    </div>
  );
}

function AddAdminModal({ onClose, onAdded }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/admins", { method: "POST", token, body: form });
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add admin" onClose={onClose}>
      <Field label="Name"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></Field>
      <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" /></Field>
      <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 ..." /></Field>
      <Field label="Temporary password"><input style={inputStyle} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" /></Field>
      {error && <div className="text-[11.5px] mb-3" style={{ fontFamily: F.b, color: C.rust }}>{error}</div>}
      <div className="flex gap-2 mt-4">
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn disabled={submitting || !form.name || !form.email || !form.password} onClick={submit}>{submitting ? "Adding..." : "Add admin"}</PrimaryBtn>
      </div>
    </Modal>
  );
}

// ============================================================
// INBOX — real conversations/messages, sends actually POST through the
// mock WhatsApp service on the backend (which logs a fake success).
// ============================================================
const STICKERS = ["🎉", "😊", "👍", "❤️", "🙏", "😂", "🔥", "✅"];

function VoiceComposer({ onCancel, onSend }) {
  const [recording, setRecording] = useState(true);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (recording) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5" style={{ border: `1px solid ${C.rust}`, borderRadius: 10, background: C.rustSoft }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.rust }} />
        <span className="text-[12.5px] flex-1" style={{ fontFamily: F.m, color: C.rust }}>Recording... {mm}:{ss}</span>
        <button onClick={onCancel} className="text-[11.5px] font-medium px-2.5 py-1" style={{ fontFamily: F.b, color: C.inkSoft }}>Delete</button>
        <button onClick={() => setRecording(false)} className="flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1 text-white" style={{ fontFamily: F.b, background: C.rust, borderRadius: 6 }}><Square size={11} /> Stop</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-3 py-2.5" style={{ border: `1px solid ${C.hairline}`, borderRadius: 10 }}>
      <Play size={16} color={C.jade} />
      <div className="flex-1 h-[3px]" style={{ background: C.hairlineSoft, borderRadius: 3 }}><div style={{ width: "40%", height: 3, background: C.jade, borderRadius: 3 }} /></div>
      <span className="text-[11px]" style={{ fontFamily: F.m, color: C.inkSoft }}>{mm}:{ss}</span>
      <button onClick={onCancel}><Trash2 size={14} color={C.inkSoft} /></button>
      <button onClick={() => onSend(seconds)} className="p-1.5" style={{ background: C.jade, borderRadius: 7 }}><Send size={13} color="white" /></button>
    </div>
  );
}

const CONVO_STATUS = {
  needs_human: { label: "Needs human", color: "#EF6A1B", soft: "#FDEBDD" },
  bot: { label: "Bot", color: "#2F7DE1", soft: "#E4EEFC" },
  human: { label: "Active", color: "#12A06B", soft: "#E3F4EA" },
};
function dayLabel(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const now = new Date(); const yest = new Date(); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Bubble({ msg }) {
  if (msg.sender === "system") {
    return <div className="flex justify-center my-3"><span className="text-[11px] px-3 py-1" style={{ fontFamily: F.b, color: C.inkSoft, background: "rgba(255,255,255,0.8)", borderRadius: 8 }}>{msg.text}</span></div>;
  }
  const isCustomer = msg.sender === "customer";
  const isBot = msg.sender === "bot";
  const cls = isCustomer ? "rl-bub rl-bub-c" : isBot ? "rl-bub rl-bub-b" : "rl-bub rl-bub-h";
  return (
    <div className={`flex mb-3 ${isCustomer ? "justify-start" : "justify-end"}`}>
      <div className={cls}>
        {isBot && <div className="rl-bub-tag"><Bot size={11} /> Automated reply</div>}
        {msg.type === "voice" ? (
          <div className="flex items-center gap-2">
            <Play size={14} />
            <div style={{ width: 90, height: 3, background: "currentColor", opacity: 0.3, borderRadius: 3 }} />
            <span className="text-[11px]" style={{ fontFamily: F.m }}>{msg.duration_seconds}s</span>
          </div>
        ) : (msg.text || <span style={{ opacity: 0.7 }}>[{msg.type}]</span>)}
        <div className="rl-bub-meta"><span>{fmtDateTime(msg.created_at)}</span>{!isCustomer && <CheckCheck size={14} />}</div>
      </div>
    </div>
  );
}

function CustomerPanel({ contact, detail }) {
  const { token } = useAuth();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { setNote(""); setMsg(null); }, [contact.id]);

  const save = async () => {
    if (!note.trim()) return;
    setSaving(true); setMsg(null);
    try {
      await apiFetch(`/contacts/${contact.id}/notes`, { method: "POST", token, body: { note } });
      setNote(""); setMsg({ ok: true, text: "Note saved." });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const real = (detail.messages || []).filter((m) => m.sender !== "system");
  const fromCustomer = real.filter((m) => m.sender === "customer").length;
  const fromBot = real.filter((m) => m.sender === "bot").length;
  const fromAgent = real.length - fromCustomer - fromBot;
  const last = real[real.length - 1];
  const st = CONVO_STATUS[detail.status] || CONVO_STATUS.human;
  const tiles = [
    [real.length, "Messages", MessageCircle, "#2F7DE1", "#E4EEFC"],
    [fromCustomer, "Customer", UserIcon, "#12A06B", "#E3F4EA"],
    [fromAgent, "Agent", Send, "#EF6A1B", "#FDEBDD"],
    [fromBot, "Bot", Bot, "#7C5CE0", "#EEE8FD"],
  ];

  return (
    <aside className="relay-customer-panel rl-ib-side">
      <div className="rl-ib-card rl-prof">
        <span className="rl-av rl-av-lg" style={{ background: avatarGrad(contact.id) }}>{initials(contact.name)}</span>
        <div className="rl-prof-name">{contact.name}</div>
        <span className="rl-status-pill" style={{ color: st.color, background: st.soft }}><i style={{ background: st.color }} />{st.label}</span>
        <div className="rl-prof-line"><Phone size={16} color="#5B6882" />{contact.phone}</div>
        {contact.email && <div className="rl-prof-line"><Mail size={16} color="#5B6882" />{contact.email}</div>}
        <div className="rl-tiles-4">
          {tiles.map(([n, l, Icon, fg, bg]) => (
            <div key={l} className="rl-tile-s"><span style={{ background: bg, color: fg }}><Icon size={16} /></span><b>{n}</b><em>{l}</em></div>
          ))}
        </div>
      </div>

      <div className="rl-ib-card rl-sec">
        <div className="rl-sec-title"><Pencil size={16} /> Notes</div>
        <textarea className="rl-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note about this customer..." />
        <div className="rl-note-row">
          <span style={{ color: msg ? (msg.ok ? "#0A7A4F" : C.rust) : "transparent" }}>{msg ? msg.text : "."}</span>
          <button type="button" className="rl-btn-primary" disabled={saving || !note.trim()} onClick={save}>{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>

      <div className="rl-ib-card rl-sec">
        <div className="rl-sec-title"><Clock size={16} /> Recent activity</div>
        <div className="rl-act"><span><MessageCircle size={15} /></span><div><b>Last message</b><em>{last ? `${fmtDateTime(last.created_at)} · ${(last.text || `[${last.type}]`).slice(0, 44)}` : "No messages yet"}</em></div></div>
        <div className="rl-act"><span><UserIcon size={15} /></span><div><b>Handled by</b><em>{st.label}</em></div></div>
        <div className="rl-act"><span><Phone size={15} /></span><div><b>Via number</b><em>{detail.whatsapp_number_phone || "—"}</em></div></div>
        <div className="rl-act"><span><MessageCircle size={15} /></span><div><b>Messages in this chat</b><em>{real.length}</em></div></div>
      </div>
    </aside>
  );
}

function InboxPage() {
  const { token } = useAuth();
  const [filter, setFilter] = useState("all");
  const conversations = useApiList("/inbox/conversations");
  const [activeConvId, setActiveConvId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);

  // pick the first conversation once the list loads
  useEffect(() => {
    if (!activeConvId && conversations.data.length > 0) setActiveConvId(conversations.data[0].id);
  }, [conversations.data, activeConvId]);

  useEffect(() => {
    if (!activeConvId || !token) return;
    let cancelled = false;
    setDetailLoading(true);
    apiFetch(`/inbox/conversations/${activeConvId}`, { token }).then(
      (d) => { if (!cancelled) { setDetail(d); setDetailLoading(false); } },
      () => { if (!cancelled) setDetailLoading(false); }
    );
    return () => { cancelled = true; };
  }, [activeConvId, token]);

  const sendMessage = async (payload) => {
    if (!activeConvId) return;
    setSending(true);
    try {
      await apiFetch(`/inbox/conversations/${activeConvId}/messages`, { method: "POST", token, body: payload });
      const fresh = await apiFetch(`/inbox/conversations/${activeConvId}`, { token });
      setDetail(fresh);
      setDraft("");
    } catch (err) {
      // surfaced inline near the composer rather than blowing away the thread
      setDetail((d) => d && { ...d, _sendError: err.message });
    } finally {
      setSending(false);
    }
  };

  if (conversations.error) return <ErrorBanner message={conversations.error} onRetry={conversations.reload} />;

  const list = conversations.data;
  const counts = { all: list.length, needs_human: list.filter((c) => c.status === "needs_human").length, bot: list.filter((c) => c.status === "bot").length };
  const shown = filter === "all" ? list : list.filter((c) => c.status === filter);
  const st = detail ? (CONVO_STATUS[detail.status] || CONVO_STATUS.human) : null;

  return (
    <div className={`relay-inbox rl-inbox flex${mobileThreadOpen ? " relay-inbox-show-thread" : ""}`}>
      <div className="relay-inbox-list rl-ib-card rl-ib-list flex flex-col shrink-0">
        <div className="rl-ib-filters">
          {[["all", "All"], ["needs_human", "Needs human"], ["bot", "Bot"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={`rl-pill rl-pill-${k}${filter === k ? " is-on" : ""}`}>{l}<b>{counts[k]}</b></button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {conversations.loading && <div className="px-3.5 py-6 text-[12.5px]" style={{ fontFamily: F.b, color: C.inkFaint }}>Loading conversations...</div>}
          {!conversations.loading && shown.length === 0 && <div className="px-3.5 py-6 text-[12.5px]" style={{ fontFamily: F.b, color: C.inkFaint }}>No conversations here yet.</div>}
          {shown.map((c) => {
            const active = c.id === activeConvId;
            const cs = CONVO_STATUS[c.status] || CONVO_STATUS.human;
            return (
              <button key={c.id} type="button" onClick={() => { setActiveConvId(c.id); setMobileThreadOpen(true); }} className={`rl-conv${active ? " is-active" : ""}`}>
                <span className="rl-av" style={{ background: avatarGrad(c.contact.id) }}>{initials(c.contact.name)}</span>
                <span className="rl-conv-main">
                  <span className="rl-conv-name">{c.contact.name}</span>
                  <span className="rl-conv-phone">{c.contact.phone}</span>
                  <span className="rl-conv-st" style={{ color: cs.color }}><i style={{ background: cs.color }} />{cs.label}</span>
                </span>
                <span className="rl-conv-side">
                  <span className="rl-conv-time">{fmtDateTime(c.last_message_at)}</span>
                  {c.unread_count > 0 && <b className="rl-unread">{c.unread_count}</b>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relay-inbox-thread rl-ib-card rl-ib-thread flex-1 flex flex-col min-w-0">
        {!detail || detailLoading ? (
          <div className="flex-1 flex items-center justify-center text-[13px]" style={{ fontFamily: F.b, color: C.inkFaint }}>{detailLoading ? "Loading conversation..." : "Select a conversation"}</div>
        ) : (
          <>
            <div className="rl-chat-head">
              <div className="flex items-center gap-3 min-w-0">
                <button type="button" className="relay-inbox-back p-1.5 shrink-0" onClick={() => setMobileThreadOpen(false)} aria-label="Back to conversations" title="Back to conversations"><ChevronLeft size={20} color={C.inkSoft} /></button>
                <span className="rl-av rl-av-md" style={{ background: avatarGrad(detail.contact.id) }}>{initials(detail.contact.name)}</span>
                <div className="min-w-0">
                  <div className="rl-chat-name">{detail.contact.name}</div>
                  <div className="rl-chat-sub">{detail.contact.phone}<span style={{ color: "#B5BED0" }}> · </span>via {detail.whatsapp_number_phone}</div>
                </div>
              </div>
              <span className="rl-status-pill" style={{ color: st.color, background: st.soft }}><i style={{ background: st.color }} />{st.label}</span>
            </div>

            <div className="relay-thread-messages rl-chat-bg flex-1 overflow-y-auto px-6 py-4">
              {detail.messages.length === 0 && <div className="text-[12.5px] text-center py-8" style={{ fontFamily: F.b, color: C.inkFaint }}>No messages yet.</div>}
              {(() => {
                let prev = "";
                return detail.messages.map((m) => {
                  const label = dayLabel(m.created_at);
                  const chip = label && label !== prev ? <div className="rl-day"><span>{label}</span></div> : null;
                  if (label) prev = label;
                  return <React.Fragment key={m.id}>{chip}<Bubble msg={m} /></React.Fragment>;
                });
              })()}
            </div>

            <div className="relay-thread-composer rl-composer-wrap">
              {detail._sendError && <div className="text-[12px] mb-2" style={{ fontFamily: F.b, color: C.rust }}>{detail._sendError}</div>}
              {showVoice ? (
                <VoiceComposer onCancel={() => setShowVoice(false)} onSend={(secs) => { setShowVoice(false); sendMessage({ type: "voice", duration_seconds: secs, media_url: "mock://voice.ogg" }); }} />
              ) : (
                <div className="rl-composer">
                  <div className="relay-composer-icons flex items-center">
                    <IconBtn icon={Paperclip} />
                    <IconBtn icon={ImageIcon} onClick={() => sendMessage({ type: "image", media_url: "mock://image.jpg" })} />
                    <IconBtn icon={Video} onClick={() => sendMessage({ type: "video", media_url: "mock://video.mp4" })} />
                    <IconBtn icon={Smile} onClick={() => setShowStickers(!showStickers)} active={showStickers} />
                  </div>
                  <div className="rl-comp-input">
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." rows={1}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && draft.trim()) { e.preventDefault(); sendMessage({ type: "text", text: draft }); } }}
                      className="relay-thread-input" style={{ fontFamily: F.b, color: C.ink }} />
                  </div>
                  <IconBtn icon={Mic} onClick={() => setShowVoice(true)} />
                  <button type="button" className="rl-send" disabled={sending || !draft.trim()} onClick={() => sendMessage({ type: "text", text: draft })} aria-label="Send"><Send size={20} color="white" /></button>
                  {showStickers && (
                    <div className="absolute bottom-[72px] left-4 grid grid-cols-4 gap-1 p-2" style={{ background: C.white, border: `1px solid ${C.hairline}`, borderRadius: 12, boxShadow: CARD_SHADOW, zIndex: 5 }}>
                      {STICKERS.map((e) => <button key={e} type="button" onClick={() => { setShowStickers(false); sendMessage({ type: "sticker", media_url: `mock://sticker/${e}` }); }} className="text-[20px] p-1.5">{e}</button>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {detail && <CustomerPanel contact={detail.contact} detail={detail} />}
    </div>
  );
}

// ============================================================
// CRM — server-side pagination and filtering (matches /contacts exactly).
// ============================================================
const CONTACT_STATUSES = ["New", "Contacted", "Replied", "Qualified", "Demo", "Converted", "Lost"];

function CrmPage() {
  const { token } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState({ items: [], total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    apiFetch("/contacts", { token, params: { page: pageNum, per_page: 10, status: statusFilter === "all" ? undefined : statusFilter, search: search || undefined } })
      .then((d) => { if (!cancelled) { setResult(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, pageNum, statusFilter, search]);

  const statusColor = { New: C.blue, Contacted: C.amber, Replied: C.jade, Qualified: C.jade, Demo: C.blue, Converted: C.jade, Lost: C.rust };

  return (
    <div>
      <PageHeader title="Contacts / CRM" desc={loading ? "Loading..." : `${result.total} contacts`} />
      <div className="flex items-center gap-2 mb-3">
        <input placeholder="Search name or phone..." value={search} onChange={(e) => { setSearch(e.target.value); setPageNum(1); }} style={{ ...inputStyle, width: 220 }} />
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => { setStatusFilter("all"); setPageNum(1); }} className="text-[11.5px] px-3 py-1.5 font-medium" style={{ fontFamily: F.b, borderRadius: 6, color: statusFilter === "all" ? "white" : C.inkSoft, background: statusFilter === "all" ? C.ink : C.panel, border: `1px solid ${statusFilter === "all" ? C.ink : C.hairline}` }}>All</button>
          {CONTACT_STATUSES.map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPageNum(1); }} className="text-[11.5px] px-3 py-1.5 font-medium" style={{ fontFamily: F.b, borderRadius: 6, color: statusFilter === s ? "white" : C.inkSoft, background: statusFilter === s ? C.ink : C.panel, border: `1px solid ${statusFilter === s ? C.ink : C.hairline}` }}>{s}</button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => setPageNum((p) => p)} />}
      {loading && <TableSkeleton rows={8} />}
      {!loading && !error && (
        <>
          <Table columns={["Name", "Phone", "Status", "Tags", "Last Contact", ""]}>
            {result.items.map((c) => (
              <tr key={c.id}>
                <Td><button onClick={() => setSelected(c)} className="font-medium" style={{ color: C.ink }}>{c.name}</button></Td>
                <Td mono>{c.phone}</Td>
                <Td><span className="text-[11px] font-medium px-2 py-0.5" style={{ fontFamily: F.b, color: statusColor[c.status], background: C.panelDeep, borderRadius: 5 }}>{c.status}</span></Td>
                <Td><div className="flex gap-1">{(c.tags || []).slice(0, 2).map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5" style={{ fontFamily: F.b, color: C.jade, background: C.jadeSoft, borderRadius: 4 }}>{t}</span>)}</div></Td>
                <Td>{fmtDate(c.last_contact_at)}</Td>
                <Td><Eye size={13} color={C.inkSoft} /></Td>
              </tr>
            ))}
          </Table>
          <div className="flex items-center justify-between mt-3">
            <span className="text-[11.5px]" style={{ fontFamily: F.b, color: C.inkSoft }}>Page {pageNum} of {result.total_pages} · {result.total} contacts</span>
            <div className="flex gap-1.5">
              <button onClick={() => setPageNum(Math.max(1, pageNum - 1))} className="p-1.5" style={{ border: `1px solid ${C.hairline}`, borderRadius: 6 }}><ChevronLeft size={14} color={C.inkSoft} /></button>
              <button onClick={() => setPageNum(Math.min(result.total_pages, pageNum + 1))} className="p-1.5" style={{ border: `1px solid ${C.hairline}`, borderRadius: 6 }}><ChevronRight size={14} color={C.inkSoft} /></button>
            </div>
          </div>
        </>
      )}

      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)} width={440}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 flex items-center justify-center text-[14px] font-semibold text-white" style={{ background: colorForId(selected.id), borderRadius: 9 }}>{initials(selected.name)}</div>
            <div><div className="text-[13px] font-medium" style={{ fontFamily: F.b, color: C.ink }}>{selected.name}</div><div className="text-[11.5px]" style={{ fontFamily: F.m, color: C.inkSoft }}>{selected.phone}</div></div>
          </div>
          {[["Email", selected.email || "—"], ["City", selected.city || "—"], ["Status", selected.status], ["Last Contact", fmtDate(selected.last_contact_at)], ["Created", fmtDate(selected.created_at)]].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-1.5" style={{ borderBottom: `1px solid ${C.hairlineSoft}` }}>
              <span className="text-[12px]" style={{ fontFamily: F.b, color: C.inkSoft }}>{k}</span>
              <span className="text-[12px] font-medium" style={{ fontFamily: F.b, color: C.ink }}>{v}</span>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// CAMPAIGNS — list is real; the wizard really POSTs then launches.
// ============================================================
const CAMPAIGN_STEPS = ["Details", "Number", "Message", "Schedule", "Review", "Launch"];

function CreateCampaignModal({ numbers, onClose, onCreated }) {
  const { token } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", whatsapp_number_id: numbers[0]?.id || "", message_type: "text", message_text: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const last = step === CAMPAIGN_STEPS.length - 1;

  const launch = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiFetch("/campaigns", { method: "POST", token, body: { name: form.name, whatsapp_number_id: form.whatsapp_number_id, message_type: form.message_type, message_text: form.message_text } });
      await apiFetch(`/campaigns/${created.id}/launch`, { method: "POST", token });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Create campaign" onClose={onClose} width={520}>
      <div className="flex items-center gap-1 mb-5 flex-wrap">
        {CAMPAIGN_STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 flex items-center justify-center text-[10px] font-semibold" style={{ fontFamily: F.b, borderRadius: 999, background: i <= step ? C.jade : C.hairlineSoft, color: i <= step ? "white" : C.inkSoft }}>{i + 1}</div>
              <span className="text-[10.5px] font-medium" style={{ fontFamily: F.b, color: i === step ? C.ink : C.inkFaint }}>{s}</span>
            </div>
            {i < CAMPAIGN_STEPS.length - 1 && <div style={{ width: 10, height: 1, background: C.hairline }} />}
          </React.Fragment>
        ))}
      </div>

      {step === 0 && <Field label="Campaign name"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali Offers Broadcast" /></Field>}
      {step === 1 && (
        <Field label="Send from WhatsApp number">
          <select style={inputStyle} value={form.whatsapp_number_id} onChange={(e) => setForm({ ...form, whatsapp_number_id: e.target.value })}>
            {numbers.map((n) => <option key={n.id} value={n.id}>{n.phone} — {n.display_name}</option>)}
          </select>
        </Field>
      )}
      {step === 2 && <Field label="Message text"><textarea style={{ ...inputStyle, minHeight: 80 }} value={form.message_text} onChange={(e) => setForm({ ...form, message_text: e.target.value })} placeholder="Write your campaign message..." /></Field>}
      {step === 3 && <div className="text-[12px] px-3 py-2" style={{ fontFamily: F.b, color: C.inkSoft, background: C.panelDeep, borderRadius: 6 }}>This build launches immediately on confirm — scheduling UI is here for review, wiring to a delayed send needs a background worker (see backend README).</div>}
      {step === 4 && (
        <div className="space-y-2">
          {[["Name", form.name || "—"], ["Number", numbers.find((n) => n.id === form.whatsapp_number_id)?.phone || "—"], ["Message", form.message_text || "—"]].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-1.5" style={{ borderBottom: `1px solid ${C.hairlineSoft}` }}>
              <span className="text-[12px]" style={{ fontFamily: F.b, color: C.inkSoft }}>{k}</span>
              <span className="text-[12px] font-medium" style={{ fontFamily: F.b, color: C.ink }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      {last && (
        <div className="flex flex-col items-center py-6 text-center">
          <div className="w-11 h-11 flex items-center justify-center mb-3" style={{ background: C.jadeSoft, borderRadius: 999 }}><Zap size={18} color={C.jade} /></div>
          <div className="text-[13.5px] font-semibold mb-1" style={{ fontFamily: F.d, color: C.ink }}>Ready to launch</div>
          <div className="text-[12px]" style={{ fontFamily: F.b, color: C.inkSoft }}>This creates a real Campaign row and calls the launch endpoint — no messages actually go out while the WhatsApp integration is mocked.</div>
        </div>
      )}
      {error && <div className="text-[11.5px] mt-2" style={{ fontFamily: F.b, color: C.rust }}>{error}</div>}
      <div className="flex justify-between mt-5">
        <GhostBtn onClick={() => (step > 0 ? setStep(step - 1) : onClose())}>{step > 0 ? "Back" : "Cancel"}</GhostBtn>
        <PrimaryBtn disabled={submitting || (step === 0 && !form.name)} onClick={() => (last ? launch() : setStep(step + 1))}>{submitting ? "Launching..." : last ? "Launch campaign" : "Next"}</PrimaryBtn>
      </div>
    </Modal>
  );
}

const CAMP_COLS = [["name", "Campaign"], ["recipients", "Recipients"], ["sent", "Sent"], ["delivered", "Delivered"], ["read", "Read"], ["replies", "Replies"], ["failed", "Failed"], ["status", "Status"], ["created_at", "Created"]];
const CAMP_SORT = {
  name: (c) => (c.name || "").toLowerCase(), recipients: (c) => c.recipients, sent: (c) => c.sent, delivered: (c) => c.delivered,
  read: (c) => c.read, replies: (c) => c.replies, failed: (c) => c.failed, status: (c) => c.status || "", created_at: (c) => new Date(c.created_at).getTime() || 0,
};

function Metric({ value, base, color }) {
  const pct = base ? Math.round((value / base) * 100) : 0;
  return (
    <div className="rl-metric">
      <b>{value.toLocaleString()}</b>
      <span className="rl-metric-row"><em>{pct}%</em><span className="rl-bar"><i style={{ width: `${Math.min(100, pct)}%`, background: color }} /></span></span>
    </div>
  );
}

function CampaignsPage() {
  const campaigns = useApiList("/campaigns");
  const numbers = useApiList("/numbers");
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [statusSel, setStatusSel] = useState("all");
  const [range, setRange] = useState("all");
  const [sort, setSort] = useState({ key: "created_at", dir: "desc" });
  const [pageNum, setPageNum] = useState(1);
  const perPage = 10;

  const all = campaigns.data;
  const countOf = (st) => all.filter((c) => c.status === st).length;
  const statuses = [...new Set(all.map((c) => c.status))];

  const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
  const q = query.trim().toLowerCase();
  const filtered = all.filter((c) => (statusSel === "all" || c.status === statusSel) && (!q || (c.name || "").toLowerCase().includes(q)) && (!cutoff || new Date(c.created_at).getTime() >= cutoff));
  const rows = [...filtered].sort((x, y) => { const a = CAMP_SORT[sort.key](x), b = CAMP_SORT[sort.key](y); const r = a < b ? -1 : a > b ? 1 : 0; return sort.dir === "asc" ? r : -r; });
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const cur = Math.min(pageNum, totalPages);
  const paged = rows.slice((cur - 1) * perPage, cur * perPage);
  const winSize = Math.min(5, totalPages);
  const winStart = Math.max(1, Math.min(cur - 2, totalPages - winSize + 1));
  const pages = Array.from({ length: winSize }, (_, i) => winStart + i);

  const toggleSort = (key) => { setSort((sv) => (sv.key === key ? { key, dir: sv.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })); setPageNum(1); };

  const exportCsv = () => {
    // values starting with = + - @ are prefixed so spreadsheets don't run them as formulas
    const esc = (v) => { let t = String(v ?? ""); if (/^[=+\-@]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
    const head = ["Campaign", "Recipients", "Sent", "Delivered", "Read", "Replies", "Failed", "Status", "Created"];
    const lines = [head, ...rows.map((c) => [c.name, c.recipients, c.sent, c.delivered, c.read, c.replies, c.failed, c.status, c.created_at])].map((r) => r.map(esc).join(","));
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "campaigns.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="rl-pghead">
        <div className="rl-pghead-l">
          <span className="rl-pgicon"><Megaphone size={26} /></span>
          <div>
            <div className="rl-page-title">Campaigns</div>
            <div className="rl-page-desc" style={{ marginTop: 2 }}>{campaigns.loading ? "Loading..." : `${all.length} ${all.length === 1 ? "campaign" : "campaigns"}`}</div>
          </div>
        </div>
        <button type="button" className="rl-btn-primary rl-btn-lg" onClick={() => setShowCreate(true)}><Plus size={18} /> Create campaign</button>
      </div>

      {campaigns.error && <ErrorBanner message={campaigns.error} onRetry={campaigns.reload} />}
      {campaigns.loading && <TableSkeleton rows={6} />}
      {!campaigns.loading && !campaigns.error && (
        <>
          <div className="rl-kpi-grid rl-kpi-grid-c6">
            <KpiCard icon={Megaphone} label="Total campaigns" value={all.length} accent="#12A06B" soft="#E3F4EA" />
            <KpiCard icon={Play} label="Running" value={countOf("Running")} accent="#12A06B" soft="#E3F4EA" />
            <KpiCard icon={CheckCheck} label="Completed" value={countOf("Completed")} accent="#2F7DE1" soft="#E4EEFC" />
            <KpiCard icon={Clock} label="Scheduled" value={countOf("Scheduled")} accent="#7C5CE0" soft="#EEE8FD" />
            <KpiCard icon={X} label="Failed" value={countOf("Failed")} accent="#E5484D" soft="#FDE8E8" />
            <KpiCard icon={Pencil} label="Draft" value={countOf("Draft")} accent="#6B7A99" soft="#EDF1F7" />
          </div>

          <section className="rl-panel rl-nm-panel">
            <div className="rl-toolbar">
              <label className="rl-tsearch"><Search size={17} /><input value={query} onChange={(e) => { setQuery(e.target.value); setPageNum(1); }} placeholder="Search campaigns..." aria-label="Search campaigns" /></label>
              <select className="rl-tselect" value={statusSel} onChange={(e) => { setStatusSel(e.target.value); setPageNum(1); }} aria-label="Filter by status">
                <option value="all">All Statuses</option>
                {statuses.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
              <select className="rl-tselect" value={range} onChange={(e) => { setRange(e.target.value); setPageNum(1); }} aria-label="Date range">
                <option value="all">All time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
              <button type="button" className="rl-btn-ghost rl-export" onClick={exportCsv} disabled={rows.length === 0}><Download size={16} /> Export</button>
            </div>

            <div className="rl-table-wrap">
              <table className="rl-table rl-table-nm rl-table-cm">
                <thead>
                  <tr>
                    {CAMP_COLS.map(([k, label]) => (
                      <th key={k} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" className="rl-sortbtn" onClick={() => toggleSort(k)}>{label}<SortIcon dir={sort.key === k ? sort.dir : null} /></button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => (
                    <tr key={c.id}>
                      <td><span className="rl-person"><span className="rl-cm-ico" style={{ background: avatarGrad(c.id) }}><Megaphone size={16} /></span><span className="rl-person-name">{c.name}</span></span></td>
                      <td>{c.recipients.toLocaleString()}</td>
                      <td>{c.sent.toLocaleString()}</td>
                      <td><Metric value={c.delivered} base={c.sent} color="#12A06B" /></td>
                      <td><Metric value={c.read} base={c.sent} color="#2F7DE1" /></td>
                      <td><Metric value={c.replies} base={c.sent} color="#8B5CF6" /></td>
                      <td><Metric value={c.failed} base={c.sent} color="#E5484D" /></td>
                      <td><StatusPill status={c.status} /></td>
                      <td><div className="rl-date"><b>{fmtDate(c.created_at)}</b><em>{fmtDateTime(c.created_at)}</em></div></td>
                    </tr>
                  ))}
                  {paged.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "#7A859D", padding: "28px 18px" }}>{all.length === 0 ? "No campaigns yet. Create your first one." : "No campaigns match these filters."}</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="rl-pager">
              <span className="rl-pager-info">Page {cur} of {totalPages} · {rows.length} {rows.length === 1 ? "campaign" : "campaigns"}</span>
              <div className="rl-pager-btns">
                <button type="button" className="rl-pg" disabled={cur === 1} onClick={() => setPageNum(cur - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
                {pages.map((n) => <button key={n} type="button" className={`rl-pg${n === cur ? " is-on" : ""}`} onClick={() => setPageNum(n)} aria-current={n === cur ? "page" : undefined}>{n}</button>)}
                <button type="button" className="rl-pg" disabled={cur === totalPages} onClick={() => setPageNum(cur + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
              </div>
            </div>
          </section>
        </>
      )}
      {showCreate && !numbers.loading && (
        <CreateCampaignModal numbers={numbers.data} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); campaigns.reload(); }} />
      )}
    </div>
  );
}

// ============================================================
// AUTOMATIONS — list + status are real; the visual canvas below is
// illustrative (the backend stores `flow` as JSON but there's no field-level
// edit endpoint yet — activating/pausing is real, editing nodes isn't).
// ============================================================
function FlowNode({ label, sub, color, icon: Icon }) {
  return (
    <div className="px-3.5 py-2.5 flex items-center gap-2.5" style={{ background: C.white, border: `1px solid ${C.hairline}`, borderLeft: `3px solid ${color}`, borderRadius: 8, minWidth: 200 }}>
      <div className="w-6 h-6 flex items-center justify-center shrink-0" style={{ background: `${color}1A`, borderRadius: 6 }}><Icon size={12} color={color} /></div>
      <div><div className="text-[12px] font-medium" style={{ fontFamily: F.b, color: C.ink }}>{label}</div>{sub && <div className="text-[10.5px]" style={{ fontFamily: F.b, color: C.inkSoft }}>{sub}</div>}</div>
    </div>
  );
}
function FlowArrow() { return <div className="flex justify-center py-1"><ArrowDown size={14} color={C.inkFaint} /></div>; }

const AUTO_ICONS = [[Zap, "#12A06B", "#E3F4EA"], [Send, "#2F7DE1", "#E4EEFC"], [Clock, "#EF6A1B", "#FDEBDD"], [Megaphone, "#7C5CE0", "#EEE8FD"], [MessageCircle, "#0E8A7A", "#DDF3F0"]];
function autoIcon(id) {
  let h = 0; const str = String(id);
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AUTO_ICONS[h % AUTO_ICONS.length];
}
function triggerLabel(t) {
  const x = String(t || "").replace(/_/g, " ").trim();
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : "Automation";
}
const AUTO_SORT = { recipients: (a) => a.recipients, sent: (a) => a.sent, delivered: (a) => a.delivered, replies: (a) => a.replies, progress: (a) => (a.recipients ? a.sent / a.recipients : 0) };
const AUTO_COLS = [["name", "Automation", false], ["status", "Status", false], ["recipients", "Recipients", true], ["sent", "Sent", true], ["delivered", "Delivered", true], ["replies", "Replies", true], ["progress", "Progress", true], ["actions", "Actions", false]];
const TRIGGERS = [["new_customer", "New customer"], ["order_shipped", "Order shipped"], ["cart_abandoned", "Cart abandoned"], ["no_response", "No response"]];

function CreateAutomationModal({ onClose, onCreated }) {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("new_customer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const created = await apiFetch("/automations", { method: "POST", token, body: { name: name.trim(), trigger_type: trigger } });
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Create automation" onClose={onClose} width={420}>
      <Field label="Automation name"><input style={inputStyle} value={name} placeholder="e.g. Welcome — New Customer" onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      <Field label="Starts when">
        <select style={inputStyle} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          {TRIGGERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      {error && <div className="text-[12px] mb-3" style={{ fontFamily: F.b, color: C.rust }}>{error}</div>}
      <div className="flex gap-2 mt-4"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn disabled={busy || !name.trim()} onClick={submit}>{busy ? "Creating..." : "Create"}</PrimaryBtn></div>
    </Modal>
  );
}

function AutomationsPage() {
  const { token } = useAuth();
  const automations = useApiList("/automations");
  const [openBuilder, setOpenBuilder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flowNodes, setFlowNodes] = useState([]);
  const [editingNode, setEditingNode] = useState(null);
  const [editForm, setEditForm] = useState({ label: "", sub: "" });
  const [nameDraft, setNameDraft] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [showCreate, setShowCreate] = useState(false);

  const defaultNodes = [
    { id: "trigger", type: "trigger", label: "New customer", sub: "Trigger", icon: "Zap", color: C.blue },
    { id: "welcome", type: "action", label: "Send welcome message", sub: "Text + image", icon: "Send", color: C.jade },
    { id: "delay", type: "delay", label: "Wait 2 hours", sub: "Delay", icon: "Clock", color: C.gray },
    { id: "condition", type: "condition", label: "Customer replied?", sub: "Condition", icon: "GitBranch", color: C.amber },
    { id: "yes", type: "action", label: "Transfer to human", sub: "YES", icon: "UserCog", color: C.jade },
    { id: "no", type: "action", label: "Send follow-up", sub: "NO", icon: "Send", color: C.rust },
  ];

  const openAutomation = (automation) => {
    const saved = Array.isArray(automation.flow?.nodes) ? automation.flow.nodes : [];
    const merged = saved.length >= 4
      ? saved.map((n, i) => ({
          id: n.id || `node-${i}`,
          type: n.type || "action",
          label: n.label || "Step",
          sub: n.sub || n.type || "Action",
          icon: n.icon || (n.type === "trigger" ? "Zap" : "Send"),
          color: n.color || (n.type === "trigger" ? C.blue : C.jade),
        }))
      : defaultNodes;
    setFlowNodes(merged);
    setNameDraft(automation.name || "");
    setOpenBuilder(automation);
  };

  const toggleStatus = async (automation) => {
    const next = automation.status === "Running" ? "Paused" : "Running";
    setBusy(true);
    try {
      const updated = await apiFetch(`/automations/${automation.id}`, { method: "PATCH", token, body: { status: next } });
      automations.reload();
      setOpenBuilder((current) => current?.id === automation.id ? { ...current, ...updated } : current);
    } catch (err) {
      alert(err.message || "Could not update automation status");
    } finally {
      setBusy(false);
    }
  };

  const saveAutomation = async () => {
    if (!openBuilder) return;
    setBusy(true);
    try {
      const updated = await apiFetch(`/automations/${openBuilder.id}`, {
        method: "PATCH",
        token,
        body: {
          name: nameDraft.trim() || openBuilder.name,
          flow: { nodes: flowNodes.map(({ id, type, label, sub, icon }) => ({ id, type, label, sub, icon })) },
        },
      });
      setOpenBuilder({ ...openBuilder, ...updated });
      setEditingNode(null);
      automations.reload();
    } catch (err) {
      alert(err.message || "Could not save automation");
    } finally {
      setBusy(false);
    }
  };

  const iconMap = { Zap, Send, Clock, GitBranch, UserCog };

  const editNode = (node) => {
    setEditingNode(node.id);
    setEditForm({ label: node.label, sub: node.sub || "" });
  };

  const saveNode = () => {
    setFlowNodes((nodes) => nodes.map((n) => n.id === editingNode ? { ...n, label: editForm.label, sub: editForm.sub } : n));
    setEditingNode(null);
  };

  if (openBuilder) {
    return (
      <div>
        <button onClick={() => { setOpenBuilder(null); setEditingNode(null); }} className="flex items-center gap-1 text-[12px] font-medium mb-3" style={{ fontFamily: F.b, color: C.inkSoft }}><ChevronLeft size={14} /> Back to automations</button>
        <PageHeader title="Edit automation" desc="Edit the automation name, timing/action labels, then save changes." action={
          <div className="flex gap-2 flex-wrap justify-end">
            <GhostBtn onClick={() => toggleStatus(openBuilder)}>{openBuilder.status === "Running" ? "Pause" : "Activate"}</GhostBtn>
            <PrimaryBtn disabled={busy} onClick={saveAutomation}><span className="flex items-center gap-1.5"><Save size={13} /> {busy ? "Saving..." : "Save changes"}</span></PrimaryBtn>
          </div>
        } />

        <div className="mb-4" style={{ background: C.panel, border: `1px solid ${C.hairline}`, borderRadius: 14, boxShadow: CARD_SHADOW }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${C.hairline}` }}>
            <Field label="Automation name"><input style={inputStyle} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} /></Field>
          </div>
          <div className="flex flex-col items-center py-6 px-3">
            {flowNodes.map((node, index) => {
              const Icon = iconMap[node.icon] || Send;
              const isBranch = node.id === "yes" || node.id === "no";
              return (
                <React.Fragment key={node.id}>
                  {index > 0 && <FlowArrow />}
                  {isBranch ? null : (
                    <div className="relay-flow-edit-row flex items-center gap-2">
                      <FlowNode label={node.label} sub={node.sub} color={node.color} icon={Icon} />
                      <button type="button" onClick={() => editNode(node)} className="p-2 shrink-0" title="Edit this step" aria-label={`Edit ${node.label}`} style={{ border: `1px solid ${C.hairline}`, borderRadius: 7, background: C.white }}><Pencil size={13} color={C.inkSoft} /></button>
                    </div>
                  )}
                  {node.id === "condition" && (
                    <div className="relay-flow-branches flex gap-10 mt-1">
                      {flowNodes.filter((n) => n.id === "yes" || n.id === "no").map((branch) => {
                        const BIcon = iconMap[branch.icon] || Send;
                        return <div key={branch.id} className="flex flex-col items-center"><span className="text-[10px] font-semibold mb-1" style={{ fontFamily: F.b, color: branch.color }}>{branch.sub}</span><div style={{ width: 1, height: 14, background: C.hairline }} /><div className="relay-flow-edit-row flex items-center gap-2"><FlowNode label={branch.label} sub="Action" color={branch.color} icon={BIcon} /><button type="button" onClick={() => editNode(branch)} className="p-2 shrink-0" title="Edit action" aria-label={`Edit ${branch.label}`} style={{ border: `1px solid ${C.hairline}`, borderRadius: 7, background: C.white }}><Pencil size={13} color={C.inkSoft} /></button></div></div>;
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {editingNode && (
          <Modal title="Edit step" onClose={() => setEditingNode(null)} width={420}>
            <Field label="Action / step"><input style={inputStyle} value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} /></Field>
            <Field label="Time / description"><input style={inputStyle} value={editForm.sub} onChange={(e) => setEditForm({ ...editForm, sub: e.target.value })} placeholder="e.g. Wait 2 hours or Text + image" /></Field>
            <div className="flex gap-2 mt-4"><GhostBtn onClick={() => setEditingNode(null)}>Cancel</GhostBtn><PrimaryBtn onClick={saveNode}>Save step</PrimaryBtn></div>
          </Modal>
        )}
      </div>
    );
  }

  const all = automations.data;
  const nRunning = all.filter((a) => a.status === "Running").length;
  const nPaused = all.filter((a) => a.status === "Paused").length;
  const nOther = all.length - nRunning - nPaused;
  const totalRecipients = all.reduce((n, a) => n + a.recipients, 0);
  const q = query.trim().toLowerCase();
  const filtered = all.filter((a) => (filter === "all" || (filter === "other" ? a.status !== "Running" && a.status !== "Paused" : a.status === filter)) && (!q || a.name.toLowerCase().includes(q)));
  const rows = sort.key
    ? [...filtered].sort((x, y) => { const a1 = AUTO_SORT[sort.key](x), b1 = AUTO_SORT[sort.key](y); const r = a1 < b1 ? -1 : a1 > b1 ? 1 : 0; return sort.dir === "asc" ? r : -r; })
    : filtered;
  const toggleSort = (key) => setSort((sv) => (sv.key === key ? { key, dir: sv.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const pills = [["all", "All", all.length], ["Running", "Running", nRunning], ["Paused", "Paused", nPaused], ...(nOther > 0 ? [["other", "Other", nOther]] : [])];

  return (
    <div>
      <div className="rl-pghead">
        <div>
          <div className="rl-page-title">Automations</div>
          <div className="rl-page-desc">{automations.loading ? "Loading..." : `${all.length} ${all.length === 1 ? "automation" : "automations"}`}</div>
        </div>
        <button type="button" className="rl-btn-primary rl-btn-lg" onClick={() => setShowCreate(true)}><Plus size={18} /> Create automation</button>
      </div>

      {automations.error && <ErrorBanner message={automations.error} onRetry={automations.reload} />}
      {automations.loading && <TableSkeleton rows={5} />}
      {!automations.loading && !automations.error && (
        <>
          <div className="rl-kpi-grid">
            <KpiCard icon={Zap} label="Total automations" value={all.length} accent="#12A06B" soft="#E3F4EA" sub={`${nRunning} running`} ratio={pctOf(nRunning, all.length)} />
            <KpiCard icon={Play} label="Running" value={nRunning} accent="#2F7DE1" soft="#E4EEFC" sub={`${pctOf(nRunning, all.length)}% of automations`} ratio={pctOf(nRunning, all.length)} />
            <KpiCard icon={Pause} label="Paused" value={nPaused} accent="#F0A020" soft="#FDF1DB" sub={`${pctOf(nPaused, all.length)}% of automations`} ratio={pctOf(nPaused, all.length)} />
            <KpiCard icon={Users} label="Recipients" value={totalRecipients.toLocaleString()} accent="#7C5CE0" soft="#EEE8FD" sub="Across all automations" />
          </div>

          <section className="rl-panel rl-nm-panel">
            <div className="rl-toolbar" style={{ justifyContent: "space-between" }}>
              <div className="rl-pills">
                {pills.map(([k, l, n]) => <button key={k} type="button" onClick={() => setFilter(k)} className={`rl-pill rl-pill-${k === "Running" ? "active" : k === "Paused" ? "warning" : k === "other" ? "inactive" : "all"}${filter === k ? " is-on" : ""}`}>{l}<b>{n}</b></button>)}
              </div>
              <label className="rl-tsearch" style={{ maxWidth: 320 }}><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search automation..." aria-label="Search automation" /></label>
            </div>

            <div className="rl-table-wrap">
              <table className="rl-table rl-table-nm rl-table-au">
                <thead>
                  <tr>
                    {AUTO_COLS.map(([k, label, sortable]) => (
                      <th key={k} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                        {sortable
                          ? <button type="button" className="rl-sortbtn" onClick={() => toggleSort(k)}>{label}<SortIcon dir={sort.key === k ? sort.dir : null} /></button>
                          : <span style={{ padding: "6px 4px", display: "inline-block" }}>{label}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const progress = a.recipients ? Math.min(100, Math.round((a.sent / a.recipients) * 100)) : 0;
                    const [Ico, fg, bg] = autoIcon(a.id);
                    const running = a.status === "Running";
                    const bar = running ? "#12A06B" : "#F0A020";
                    return (
                      <tr key={a.id}>
                        <td>
                          <button type="button" className="rl-auto-cell" onClick={() => openAutomation(a)}>
                            <span className="rl-auto-ico" style={{ background: bg, color: fg }}><Ico size={20} /></span>
                            <span><b>{a.name}</b><em>Trigger: {triggerLabel(a.trigger_type)}</em></span>
                          </button>
                        </td>
                        <td><StatusPill status={a.status} /></td>
                        <td>{a.recipients.toLocaleString()}</td>
                        <td>{a.sent.toLocaleString()}</td>
                        <td>{a.delivered.toLocaleString()}</td>
                        <td>{a.replies.toLocaleString()}</td>
                        <td><div className="rl-prog"><b>{progress}%</b><span><i style={{ width: `${progress}%`, background: bar }} /></span></div></td>
                        <td>
                          <div className="rl-actions">
                            <button type="button" disabled={busy} onClick={() => toggleStatus(a)} className={`rl-act-btn ${running ? "is-pause" : "is-resume"}`}>
                              {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> {a.status === "Paused" ? "Resume" : "Activate"}</>}
                            </button>
                            <button type="button" className="rl-icon-btn" onClick={() => openAutomation(a)} title="Edit automation" aria-label={`Edit ${a.name}`}><Pencil size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#7A859D", padding: "28px 18px" }}>{all.length === 0 ? "No automations yet. Create your first one." : "No automations match."}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="rl-pager"><span className="rl-pager-info">Showing {rows.length} {rows.length === 1 ? "automation" : "automations"}</span></div>
          </section>
        </>
      )}

      {showCreate && <CreateAutomationModal onClose={() => setShowCreate(false)} onCreated={(created) => { setShowCreate(false); automations.reload(); openAutomation(created); }} />}
    </div>
  );
}

// ============================================================
// CHATBOT — same pattern: list/status real, flow canvas illustrative.
// ============================================================
function CreateBotModal({ numbers, onClose, onCreated }) {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [numberId, setNumberId] = useState(numbers[0]?.id || "");
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const created = await apiFetch("/chatbots", {
        method: "POST", token,
        body: { name: name.trim(), whatsapp_number_id: numberId, keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) },
      });
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Create bot" onClose={onClose} width={440}>
      <Field label="Bot name"><input style={inputStyle} value={name} placeholder="e.g. Support Bot" onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      <Field label="WhatsApp number">
        {numbers.length === 0
          ? <div className="text-[12.5px]" style={{ fontFamily: F.b, color: C.rust }}>No WhatsApp numbers yet. Add a number first, then create a bot for it.</div>
          : <select style={inputStyle} value={numberId} onChange={(e) => setNumberId(e.target.value)}>{numbers.map((n) => <option key={n.id} value={n.id}>{n.phone}{n.display_name ? ` — ${n.display_name}` : ""}</option>)}</select>}
      </Field>
      <Field label="Trigger keywords (optional, comma separated)"><input style={inputStyle} value={keywords} placeholder="hi, pricing, order status" onChange={(e) => setKeywords(e.target.value)} /></Field>
      {error && <div className="text-[12px] mb-3" style={{ fontFamily: F.b, color: C.rust }}>{error}</div>}
      <div className="flex gap-2 mt-4"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn disabled={busy || !name.trim() || !numberId} onClick={submit}>{busy ? "Creating..." : "Create bot"}</PrimaryBtn></div>
    </Modal>
  );
}

function ChatbotPage() {
  const { token } = useAuth();
  const chatbots = useApiList("/chatbots");
  const numbers = useApiList("/numbers");
  const [openBot, setOpenBot] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const toggleBot = async (b) => {
    setBusyId(b.id); setActionError(null);
    try {
      await apiFetch(`/chatbots/${b.id}`, { method: "PATCH", token, body: { status: b.status === "active" ? "paused" : "active" } });
      chatbots.reload();
    } catch (err) {
      setActionError(err.message || "Could not update the bot");
    } finally {
      setBusyId(null);
    }
  };

  if (openBot) {
    return (
      <div>
        <button onClick={() => setOpenBot(null)} className="flex items-center gap-1 text-[12px] font-medium mb-3" style={{ fontFamily: F.b, color: C.inkSoft }}><ChevronLeft size={14} /> Back to chatbots</button>
        <PageHeader title={openBot.name} desc={`Connected to ${chatbots.data.find((b) => b.id === openBot.id)?.whatsapp_number_id ? "a WhatsApp number" : ""}`} />
        <div style={{ background: C.panel, border: `1px solid ${C.hairline}`, borderRadius: 14, boxShadow: CARD_SHADOW }} className="flex flex-col items-center py-6">
          <FlowNode label="START" color={C.blue} icon={Zap} />
          <FlowArrow />
          <FlowNode label="Welcome message" color={C.jade} icon={Send} />
          <FlowArrow />
          <FlowNode label="Main menu" sub="4 options" color={C.amber} icon={ListTree} />
          <div style={{ width: 1, height: 14, background: C.hairline }} className="mt-1" />
          <div className="flex gap-6 flex-wrap justify-center mt-1">
            {(openBot.flow?.menu || ["Product Information", "Pricing", "FAQ", "Talk to Human"]).map((label) => (
              <FlowNode key={label} label={label} sub={label === "Talk to Human" ? "Assign agent" : "Automated answer"} color={label === "Talk to Human" ? C.rust : C.jade} icon={label === "Talk to Human" ? UserCog : MessageCircle} />
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(openBot.keywords || []).map((k) => <span key={k} className="text-[10.5px] px-2 py-1" style={{ fontFamily: F.b, color: C.amber, background: C.amberSoft, borderRadius: 5 }}>{k}</span>)}
        </div>
      </div>
    );
  }

  const bots = chatbots.data;
  const nActive = bots.filter((b) => b.status === "active").length;
  const nPaused = bots.length - nActive;
  const sum = (k) => bots.reduce((n, b) => n + (b[k] || 0), 0);
  const convos = sum("conversations"), autos = sum("automated_responses"), handoffs = sum("human_handoffs");
  const phoneOf = Object.fromEntries(numbers.data.map((n) => [n.id, n.phone]));
  const perConvo = convos ? Math.round((autos / convos) * 10) / 10 : 0;

  return (
    <div>
      <div className="rl-pghead">
        <div className="rl-pghead-l">
          <span className="rl-pgicon is-teal"><Bot size={34} /></span>
          <div>
            <div className="rl-page-title">Chatbot</div>
            <div className="rl-page-desc" style={{ marginTop: 2 }}>{chatbots.loading ? "Loading..." : `${bots.length} ${bots.length === 1 ? "bot" : "bots"}`}</div>
          </div>
        </div>
        <button type="button" className="rl-btn-primary rl-btn-lg rl-btn-teal" onClick={() => setShowCreate(true)}><Plus size={18} /> Create Bot</button>
      </div>

      {chatbots.error && <ErrorBanner message={chatbots.error} onRetry={chatbots.reload} />}
      {actionError && <div className="mb-3 text-[12.5px]" role="alert" style={{ fontFamily: F.b, color: C.rust }}>{actionError}</div>}
      {chatbots.loading && <TableSkeleton rows={4} />}
      {!chatbots.loading && !chatbots.error && (
        <>
          <div className="rl-kpi-grid">
            <KpiCard icon={Bot} label="Total Bots" value={bots.length} accent="#2F7DE1" soft="#E4EEFC" sub={`${nActive} active · ${nPaused} paused`} ratio={pctOf(nActive, bots.length)} />
            <KpiCard icon={MessageCircle} label="Total Conversations" value={convos.toLocaleString()} accent="#12A06B" soft="#E3F4EA" sub="Across all bots" />
            <KpiCard icon={Zap} label="Automated Responses" value={autos.toLocaleString()} accent="#7C5CE0" soft="#EEE8FD" sub={`${perConvo} per conversation`} />
            <KpiCard icon={UserCog} label="Human Handoffs" value={handoffs.toLocaleString()} accent="#EF6A1B" soft="#FDEBDD" sub={`${pctOf(handoffs, convos)}% of conversations`} ratio={pctOf(handoffs, convos)} />
          </div>

          <section className="rl-panel rl-nm-panel">
            <div className="rl-table-wrap">
              <table className="rl-table rl-table-nm rl-table-au">
                <thead>
                  <tr>{["Bot Name", "Status", "Conversations", "Automated Responses", "Human Handoffs", "Actions"].map((h) => <th key={h}><span style={{ padding: "6px 4px", display: "inline-block" }}>{h}</span></th>)}</tr>
                </thead>
                <tbody>
                  {bots.map((b) => {
                    const on = b.status === "active";
                    const kw = (b.keywords || []).length;
                    return (
                      <tr key={b.id}>
                        <td>
                          <button type="button" className="rl-auto-cell" onClick={() => setOpenBot(b)}>
                            <span className="rl-bot-ico" style={{ background: avatarGrad(b.id) }}><Bot size={22} /></span>
                            <span><b>{b.name}</b><em>{phoneOf[b.whatsapp_number_id] || "WhatsApp number"} · {kw} {kw === 1 ? "keyword" : "keywords"}</em></span>
                          </button>
                        </td>
                        <td><StatusPill status={b.status} /></td>
                        <td>{b.conversations.toLocaleString()}</td>
                        <td>{b.automated_responses.toLocaleString()}</td>
                        <td>{b.human_handoffs.toLocaleString()}</td>
                        <td>
                          <div className="rl-actions">
                            <button type="button" className="rl-act-btn is-open" onClick={() => setOpenBot(b)}>Open builder <ChevronRight size={14} /></button>
                            <button type="button" disabled={busyId === b.id} onClick={() => toggleBot(b)} className={`rl-act-btn ${on ? "is-pause" : "is-resume"}`}>
                              {on ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {bots.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#7A859D", padding: "28px 18px" }}>No bots yet. Create your first bot.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {showCreate && !numbers.loading && <CreateBotModal numbers={numbers.data} onClose={() => setShowCreate(false)} onCreated={(created) => { setShowCreate(false); chatbots.reload(); setOpenBot(created); }} />}
    </div>
  );
}

// ============================================================
// ANALYTICS — KPIs, funnel, and campaign-performance chart are real
// (backed by /analytics/summary, /analytics/funnel, /campaigns). The
// messages-over-time and delivery/read/reply-by-day charts need a per-day
// events table the backend doesn't have yet (only rolling today-counters
// exist) — those two stay clearly-labeled synthetic data until that exists.
// ============================================================
function ChartCard({ title, icon, children, height = 260, note, raw }) {
  return (
    <section className="rl-chart-card">
      <div className="rl-chart-head">
        <span className="rl-chart-title">{icon}{title}</span>
        {note && <span className="rl-pill-note">{note}</span>}
      </div>
      {raw ? children : <div style={{ height }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>}
    </section>
  );
}
const axisStyle = { fontSize: 11.5, fontFamily: F.b, fill: "#6A7B9B" };

function ChartTip({ active, payload, label, colors }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rl-tip">
      <div className="rl-tip-title">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: (colors && colors[p.dataKey]) || p.stroke || p.color }}>{p.name} : {Number(p.value).toLocaleString()}</div>
      ))}
    </div>
  );
}

function synthTimeSeries(seed) {
  return Array.from({ length: 14 }, (_, i) => {
    const day = i + 1;
    const sent = seed + Math.round(Math.sin(i / 2) * (seed * 0.1)) + i * (seed * 0.01);
    return { day: `Day ${day}`, sent: Math.round(sent), delivered: Math.round(sent * 0.94), read: Math.round(sent * 0.61), replies: Math.round(sent * 0.14) };
  });
}

const FUNNEL_COLORS = ["#12A06B", "#14B8A6", "#2F7DE1", "#F0A020", "#7C5CE0"];
function fmtPct(p) { return p >= 10 ? `${Math.round(p)}%` : `${Math.round(p * 10) / 10}%`; }

/** Real funnel numbers drawn as a stacked inverted triangle with labelled leader lines. */
function FunnelGraphic({ stages }) {
  const W = 520, H = 280, CX = 150, TOP = 300, BOT = 24, GAP = 4;
  const n = stages.length;
  if (!n) return <div className="rl-empty">No funnel data yet.</div>;
  const h = H / n;
  const width = (y) => TOP - (TOP - BOT) * (y / H);
  const first = stages[0].value || 0;
  return (
    <div className="rl-funnel">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {stages.map((st, i) => {
          const yT = i * h + (i ? GAP / 2 : 0);
          const yB = (i + 1) * h - (i < n - 1 ? GAP / 2 : 0);
          const wT = width(yT), wB = width(yB), yM = (yT + yB) / 2, wM = width(yM);
          const col = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
          return (
            <g key={st.name}>
              <polygon points={`${CX - wT / 2},${yT} ${CX + wT / 2},${yT} ${CX + wB / 2},${yB} ${CX - wB / 2},${yB}`} fill={col} />
              <line x1={CX + wM / 2 + 8} y1={yM} x2={338} y2={yM} stroke={col} strokeOpacity="0.55" strokeWidth="1.5" />
              <circle cx="338" cy={yM} r="5" fill={col} />
            </g>
          );
        })}
      </svg>
      {stages.map((st, i) => {
        const yM = i * h + h / 2;
        return (
          <div key={st.name} className="rl-funnel-label" style={{ top: `${(yM / H) * 100}%` }}>
            <span className="rl-funnel-name">{st.name}</span>
            <span className="rl-funnel-val">{(st.value || 0).toLocaleString()} <em>({first ? fmtPct((st.value / first) * 100) : "0%"})</em></span>
          </div>
        );
      })}
    </div>
  );
}

function HeroStat({ icon: Icon, label, value, acc, tint, bd, grad, stat, caption }) {
  return (
    <div className="rl-hero" style={{ "--acc": acc, "--tint": tint, "--bd": bd, "--grad": grad }}>
      <span className="rl-hero-icon"><Icon size={30} /></span>
      <div className="rl-hero-main">
        <div className="rl-hero-label">{label}</div>
        <div className="rl-hero-value">{value}</div>
      </div>
      <div className="rl-hero-stat">
        <div className="rl-hero-stat-top">{stat}</div>
        <div className="rl-hero-stat-cap">{caption}</div>
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const summary = useApiList("/analytics/summary");
  const funnel = useApiList("/analytics/funnel");
  const campaigns = useApiList("/campaigns");

  if (summary.error) return <ErrorBanner message={summary.error} onRetry={() => { summary.reload(); funnel.reload(); campaigns.reload(); }} />;
  if (summary.loading || funnel.loading || campaigns.loading) return <TableSkeleton rows={6} />;

  const s = summary.data;
  const series = synthTimeSeries(Math.max(s.messages_sent / 14, 200));
  const topCampaigns = [...campaigns.data].sort((x, y) => y.delivered - x.delivered).slice(0, 5)
    .map((c) => ({ name: c.name.length > 16 ? c.name.slice(0, 16) + "…" : c.name, delivered: c.delivered }));
  const deliveryRate = pctOf(s.delivered, s.messages_sent);
  const replyRate = pctOf(s.replies, s.messages_sent);
  const readRate = pctOf(s.read, s.delivered);
  const tipColors = { sent: "#12A06B", replies: "#F0A020", delivered: "#12A06B", read: "#2F7DE1" };

  return (
    <div>
      <PageHeader title="Analytics" desc="Live totals from every WhatsApp number and campaign" />

      <div className="rl-hero-grid">
        <HeroStat icon={Send} label="Messages Sent" value={s.messages_sent.toLocaleString()} acc="#12A06B" tint="#E4F6EC" bd="#D3EEDF" grad="linear-gradient(145deg,#34D27A,#0E8A5A)" stat="Today" caption="across all numbers" />
        <HeroStat icon={CheckCheck} label="Delivered" value={s.delivered.toLocaleString()} acc="#2F7DE1" tint="#E6F0FD" bd="#D2E3FA" grad="linear-gradient(145deg,#5BA4FF,#2563EB)" stat={`${deliveryRate}%`} caption="delivery rate" />
        <HeroStat icon={Eye} label="Read" value={s.read.toLocaleString()} acc="#0E9AA7" tint="#DDF4F5" bd="#C8ECEE" grad="linear-gradient(145deg,#2DD4BF,#0E8A9A)" stat={`~${readRate}%`} caption="of delivered (estimate)" />
        <HeroStat icon={MessageCircle} label="Replies" value={s.replies.toLocaleString()} acc="#7C5CE0" tint="#EEE8FD" bd="#E0D6FA" grad="linear-gradient(145deg,#B26BF5,#6D4BD8)" stat={`${replyRate}%`} caption="of messages sent" />
        <HeroStat icon={Users} label="Leads" value={s.leads} acc="#12A06B" tint="#E3F6EC" bd="#D0EEDD" grad="linear-gradient(145deg,#34D3A0,#0E9F77)" stat="Qualified+" caption="demo or converted" />
        <HeroStat icon={BarChart3} label="Conversion Rate" value={`${s.conversion_rate}%`} acc="#EF6A1B" tint="#FDEBDD" bd="#F9D9BF" grad="linear-gradient(145deg,#FBA33C,#EF6A1B)" stat="Leads ÷ sent" caption="today's messages" />
      </div>

      <div className="relay-chart-grid rl-chart-grid">
        <ChartCard title="Messages over time" note="Illustrative" height={290} icon={<span className="rl-chart-ico" style={{ background: "#E4EEFC", color: "#2F7DE1" }}><MessageCircle size={16} /></span>}>
          <AreaChart data={series} margin={{ top: 8, right: 14, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="an-sent" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#12A06B" stopOpacity="0.22" /><stop offset="1" stopColor="#12A06B" stopOpacity="0" /></linearGradient>
            </defs>
            <CartesianGrid stroke="#E8EDF5" vertical={false} />
            <XAxis dataKey="day" tick={axisStyle} interval={2} axisLine={{ stroke: "#E1E7F1" }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={<ChartTip colors={tipColors} />} cursor={{ stroke: "#9BB4D9", strokeDasharray: "4 4" }} />
            <Legend iconType="circle" iconSize={10} verticalAlign="bottom" height={34} />
            <Area type="monotone" dataKey="sent" name="Sent" stroke="#12A06B" strokeWidth={2.5} fill="url(#an-sent)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
            <Area type="monotone" dataKey="replies" name="Replies" stroke="#F0A020" strokeWidth={2.5} fill="none" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Delivery vs read vs reply" note="Illustrative" height={290} icon={<span className="rl-chart-ico" style={{ background: "#E4EEFC", color: "#2F7DE1" }}><BarChart3 size={16} /></span>}>
          <BarChart data={series.slice(-7)} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4} barCategoryGap="22%">
            <defs>
              <linearGradient id="bar-del" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14B87A" /><stop offset="1" stopColor="#0B7F66" /></linearGradient>
              <linearGradient id="bar-read" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3B8CFF" /><stop offset="1" stopColor="#1D5FE0" /></linearGradient>
              <linearGradient id="bar-rep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFC24D" /><stop offset="1" stopColor="#F29B12" /></linearGradient>
            </defs>
            <CartesianGrid stroke="#E8EDF5" vertical={false} />
            <XAxis dataKey="day" tick={axisStyle} axisLine={{ stroke: "#E1E7F1" }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={<ChartTip colors={tipColors} />} cursor={{ fill: "rgba(47,125,225,0.06)" }} />
            <Legend iconType="circle" iconSize={10} verticalAlign="bottom" height={34} />
            <Bar dataKey="delivered" name="Delivered" fill="url(#bar-del)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="read" name="Read" fill="url(#bar-read)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="replies" name="Replied" fill="url(#bar-rep)" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Conversion funnel" raw icon={<span className="rl-chart-ico" style={{ background: "#EEE8FD" }}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18l-7 8v6l-4 2v-8z" fill="#7C5CE0" /></svg></span>}>
          <FunnelGraphic stages={funnel.data} />
        </ChartCard>

        <ChartCard title="Campaign performance" height={290} icon={<span className="rl-chart-ico" style={{ background: "#EEE8FD", color: "#7C5CE0" }}><Megaphone size={16} /></span>} raw={!topCampaigns.length}>
          {topCampaigns.length === 0 ? (
            <div className="rl-empty">No campaigns yet. Delivered counts will appear here once you launch one.</div>
          ) : (
            <BarChart layout="vertical" data={topCampaigns} margin={{ left: 4, right: 56, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="cp-0" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5B4BD8" /><stop offset="1" stopColor="#B05CF0" /></linearGradient>
                <linearGradient id="cp-1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2563EB" /><stop offset="1" stopColor="#3B8CFF" /></linearGradient>
                <linearGradient id="cp-2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1CB5CF" /><stop offset="1" stopColor="#6BE6D2" /></linearGradient>
                <linearGradient id="cp-3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#C77DFF" /><stop offset="1" stopColor="#F0B3FF" /></linearGradient>
              </defs>
              <CartesianGrid stroke="#E8EDF5" horizontal={false} />
              <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={axisStyle} width={118} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(124,92,224,0.06)" }} />
              <Bar dataKey="delivered" name="Delivered" radius={[0, 8, 8, 0]} barSize={24}>
                {topCampaigns.map((_, i) => <Cell key={i} fill={`url(#cp-${i % 4})`} />)}
                <LabelList dataKey="delivered" position="right" formatter={(v) => Number(v).toLocaleString()} style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, fill: "#1B2338" }} />
              </Bar>
            </BarChart>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// ============================================================
// API KEYS — super admin only, values always masked.
// ============================================================
function ApiKeysPage() {
  const { token } = useAuth();
  const keys = useApiList("/api-keys");
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const test = async (id) => {
    setBusyId(id);
    try { await apiFetch(`/api-keys/${id}/test`, { method: "POST", token }); keys.reload(); } finally { setBusyId(null); }
  };
  const remove = async (id) => {
    setBusyId(id);
    try { await apiFetch(`/api-keys/${id}`, { method: "DELETE", token }); keys.reload(); } finally { setBusyId(null); }
  };

  return (
    <div>
      <PageHeader title="API Keys" desc="Manage WhatsApp API provider connections" action={<PrimaryBtn onClick={() => setShowAdd(true)}><span className="flex items-center gap-1.5"><Plus size={13} /> Add API key</span></PrimaryBtn>} />
      {keys.error && <ErrorBanner message={keys.error} onRetry={keys.reload} />}
      {keys.loading && <TableSkeleton rows={2} />}
      {!keys.loading && !keys.error && (
        <div className="space-y-2.5">
          {keys.data.map((k) => (
            <div key={k.id} className="flex items-center justify-between px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.hairline}`, borderRadius: 14, boxShadow: CARD_SHADOW }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center" style={{ background: C.jadeSoft, borderRadius: 7 }}><Key size={14} color={C.jade} /></div>
                <div><div className="text-[13px] font-medium" style={{ fontFamily: F.b, color: C.ink }}>{k.provider}</div><div className="text-[11.5px]" style={{ fontFamily: F.m, color: C.inkSoft }}>{k.masked}</div></div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={k.status} />
                <button disabled={busyId === k.id} onClick={() => test(k.id)} className="text-[11.5px] font-medium" style={{ fontFamily: F.b, color: C.jade }}>Test</button>
                <button disabled={busyId === k.id} onClick={() => remove(k.id)} className="text-[11.5px] font-medium" style={{ fontFamily: F.b, color: C.rust }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd && <AddApiKeyModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); keys.reload(); }} />}
    </div>
  );
}

function AddApiKeyModal({ onClose, onAdded }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ provider: "Meta", api_key: "", business_account_id: "", phone_number_id: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api-keys", { method: "POST", token, body: form });
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add API key" onClose={onClose}>
      <Field label="Provider">
        <select style={inputStyle} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
          <option>Meta</option><option>360dialog</option><option>Twilio</option><option>Gupshup</option>
        </select>
      </Field>
      <Field label="API Key"><input style={inputStyle} type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="Paste API key" /></Field>
      <Field label="Business Account ID"><input style={inputStyle} value={form.business_account_id} onChange={(e) => setForm({ ...form, business_account_id: e.target.value })} placeholder="WABA ID" /></Field>
      <Field label="Phone Number ID"><input style={inputStyle} value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} placeholder="Phone number ID" /></Field>
      {error && <div className="text-[11.5px] mb-3" style={{ fontFamily: F.b, color: C.rust }}>{error}</div>}
      <div className="flex gap-2 mt-4"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn disabled={submitting || !form.api_key} onClick={submit}>{submitting ? "Saving..." : "Save & connect"}</PrimaryBtn></div>
    </Modal>
  );
}

const LOG_TYPES = {
  auth: { label: "Authentication", icon: UserIcon, fg: "#2F6FE0", bg: "#E4EEFC" },
  automation: { label: "Automation", icon: Zap, fg: "#7C5CE0", bg: "#EEE8FD" },
  campaign: { label: "Campaign", icon: Megaphone, fg: "#D9640E", bg: "#FDEBDD" },
  whatsapp_number: { label: "WhatsApp number", icon: Phone, fg: "#0A7A4F", bg: "#E3F4EA" },
  api_key: { label: "API key", icon: Key, fg: "#0E8A7A", bg: "#DDF3F0" },
  customer: { label: "Customer", icon: Users, fg: "#2F6FE0", bg: "#E4EEFC" },
  system: { label: "System", icon: SettingsIcon, fg: "#4A5876", bg: "#EDF1F7" },
};
const logType = (t) => LOG_TYPES[t] || { label: triggerLabel(t), icon: ActivityIcon, fg: "#4A5876", bg: "#EDF1F7" };
const roleLabel = (r) => (r === "super_admin" ? "Super Admin" : r === "admin" ? "Admin" : "");
const LOG_COLS = [["created_at", "Time"], ["type", "Type"], ["message", "Event"], ["actor", "Admin"]];

function ActivityLogsPage() {
  const logs = useApiList("/activity-logs", { params: { limit: 200 } });
  const admins = useApiList("/admins");
  const [query, setQuery] = useState("");
  const [typeSel, setTypeSel] = useState("all");
  const [adminSel, setAdminSel] = useState("all");
  const [range, setRange] = useState("all");
  const [sort, setSort] = useState({ key: "created_at", dir: "desc" });
  const [pageNum, setPageNum] = useState(1);
  const [viewing, setViewing] = useState(null);
  const perPage = 10;

  const adminMap = Object.fromEntries(admins.data.map((u) => [u.id, u]));
  // one normalised row per log entry (name/role come from the server when it sends them, otherwise from the admins list)
  const all = logs.data.map((l) => {
    const known = adminMap[l.actor_id];
    const name = l.actor_name || known?.name || (l.actor_id ? "Unknown user" : "System");
    const role = l.actor_role || known?.role || "";
    return { ...l, actor: name, role };
  });

  const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
  const q = query.trim().toLowerCase();
  const filtered = all.filter((l) =>
    (typeSel === "all" || l.type === typeSel) &&
    (adminSel === "all" || (l.actor_id || "system") === adminSel) &&
    (!cutoff || new Date(l.created_at).getTime() >= cutoff) &&
    (!q || l.message.toLowerCase().includes(q) || l.actor.toLowerCase().includes(q)));
  const val = { created_at: (l) => new Date(l.created_at).getTime() || 0, type: (l) => logType(l.type).label, message: (l) => l.message.toLowerCase(), actor: (l) => l.actor.toLowerCase() };
  const rows = [...filtered].sort((x, y) => { const a1 = val[sort.key](x), b1 = val[sort.key](y); const r = a1 < b1 ? -1 : a1 > b1 ? 1 : 0; return sort.dir === "asc" ? r : -r; });
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const cur = Math.min(pageNum, totalPages);
  const paged = rows.slice((cur - 1) * perPage, cur * perPage);
  const winSize = Math.min(5, totalPages);
  const winStart = Math.max(1, Math.min(cur - 2, totalPages - winSize + 1));
  const pages = Array.from({ length: winSize }, (_, i) => winStart + i);

  const typesPresent = [...new Set(all.map((l) => l.type))];
  const actors = [...new Map(all.map((l) => [l.actor_id || "system", l.actor])).entries()].sort((x, y) => x[1].localeCompare(y[1]));
  const inRange = cutoff ? all.filter((l) => new Date(l.created_at).getTime() >= cutoff) : all;
  const nType = (t) => inRange.filter((l) => l.type === t).length;
  const share = (n) => pctOf(n, inRange.length);
  const dirty = query || typeSel !== "all" || adminSel !== "all" || range !== "all";

  const toggleSort = (key) => { setSort((sv) => (sv.key === key ? { key, dir: sv.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "created_at" ? "desc" : "asc" })); setPageNum(1); };
  const reset = () => { setQuery(""); setTypeSel("all"); setAdminSel("all"); setRange("all"); setPageNum(1); };

  const exportCsv = () => {
    // values starting with = + - @ are prefixed so spreadsheets don't run them as formulas
    const esc = (v) => { let t = String(v ?? ""); if (/^[=+\-@]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
    const lines = [["Time", "Type", "Event", "Admin", "Role"], ...rows.map((l) => [l.created_at, logType(l.type).label, l.message, l.actor, roleLabel(l.role)])].map((r) => r.map(esc).join(","));
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "activity-logs.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const Who = ({ l }) => (
    <span className="rl-person">
      <span className="rl-person-av rl-ad-av" style={{ background: l.actor_id ? avatarGrad(l.actor_id) : "linear-gradient(145deg,#8A94A8,#5B6882)", width: 36, height: 36, flexBasis: 36, fontSize: 12 }}>{l.actor_id ? initials(l.actor) : "SY"}</span>
      <span className="rl-date"><b>{l.actor}</b>{roleLabel(l.role) && <em>{roleLabel(l.role)}</em>}</span>
    </span>
  );

  return (
    <div>
      <div className="rl-pghead">
        <div className="rl-pghead-l">
          <span className="rl-pgicon is-blue"><ActivityIcon size={26} /></span>
          <div>
            <div className="rl-page-title">Activity Logs</div>
            <div className="rl-page-desc" style={{ marginTop: 2 }}>System-wide activity across all admins and numbers</div>
          </div>
        </div>
        <button type="button" className="rl-btn-primary rl-btn-lg" onClick={exportCsv} disabled={rows.length === 0}><Download size={18} /> Export Logs</button>
      </div>

      {logs.error && <ErrorBanner message={logs.error} onRetry={logs.reload} />}
      {logs.loading && <TableSkeleton rows={6} />}
      {!logs.loading && !logs.error && (
        all.length === 0 ? (
          <div style={{ background: C.panel, border: `1px solid ${C.hairline}`, borderRadius: 14, boxShadow: CARD_SHADOW }}>
            <EmptyState icon={ScrollText} title="No activity yet" desc="Actions like adding a number, launching a campaign, or starting an automation will show up here." />
          </div>
        ) : (
          <>
            <div className="rl-kpi-grid">
              <KpiCard icon={Users} label="Total Activities" value={inRange.length.toLocaleString()} accent="#2F7DE1" soft="#E4EEFC" sub={range === "all" ? "All recorded events" : "In the selected period"} />
              <KpiCard icon={Lock} label="Sign-ins" value={nType("auth").toLocaleString()} accent="#12A06B" soft="#E3F4EA" sub={`${share(nType("auth"))}% of activity`} ratio={share(nType("auth"))} />
              <KpiCard icon={SettingsIcon} label="Automations" value={nType("automation").toLocaleString()} accent="#7C5CE0" soft="#EEE8FD" sub={`${share(nType("automation"))}% of activity`} ratio={share(nType("automation"))} />
              <KpiCard icon={Megaphone} label="Campaigns" value={nType("campaign").toLocaleString()} accent="#EF6A1B" soft="#FDEBDD" sub={`${share(nType("campaign"))}% of activity`} ratio={share(nType("campaign"))} />
            </div>

            <section className="rl-panel rl-nm-panel">
              <div className="rl-toolbar">
                <label className="rl-tsearch"><Search size={17} /><input value={query} onChange={(e) => { setQuery(e.target.value); setPageNum(1); }} placeholder="Search by admin or event..." aria-label="Search logs" /></label>
                <select className="rl-tselect" value={typeSel} onChange={(e) => { setTypeSel(e.target.value); setPageNum(1); }} aria-label="Event type">
                  <option value="all">All event types</option>
                  {typesPresent.map((t) => <option key={t} value={t}>{logType(t).label}</option>)}
                </select>
                <select className="rl-tselect" value={adminSel} onChange={(e) => { setAdminSel(e.target.value); setPageNum(1); }} aria-label="Admin">
                  <option value="all">All admins</option>
                  {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <select className="rl-tselect" value={range} onChange={(e) => { setRange(e.target.value); setPageNum(1); }} aria-label="Date range">
                  <option value="all">All time</option>
                  <option value="1">Last 24 hours</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                </select>
                <button type="button" className="rl-btn-ghost rl-export" onClick={reset} disabled={!dirty}>Reset</button>
              </div>

              <div className="rl-table-wrap">
                <table className="rl-table rl-table-nm rl-table-lg">
                  <thead>
                    <tr>
                      {LOG_COLS.map(([k, label]) => (
                        <th key={k} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                          <button type="button" className="rl-sortbtn" onClick={() => toggleSort(k)}>{label}<SortIcon dir={sort.key === k ? sort.dir : null} /></button>
                        </th>
                      ))}
                      <th><span style={{ padding: "6px 4px", display: "inline-block" }}>Details</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((l) => {
                      const t = logType(l.type); const TI = t.icon;
                      return (
                        <tr key={l.id}>
                          <td><div className="rl-date"><b>{fmtDateTime(l.created_at)}</b><em>{fmtDate(l.created_at)}</em></div></td>
                          <td><span className="rl-type" style={{ color: t.fg, background: t.bg }}><TI size={15} />{t.label}</span></td>
                          <td style={{ maxWidth: 380, whiteSpace: "normal" }}>{l.message}</td>
                          <td><Who l={l} /></td>
                          <td><button type="button" className="rl-viewbtn" onClick={() => setViewing(l)}><Eye size={15} /> View</button></td>
                        </tr>
                      );
                    })}
                    {paged.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#7A859D", padding: "28px 18px" }}>No events match these filters. Try All time or Reset.</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="rl-pager">
                <span className="rl-pager-info">Page {cur} of {totalPages} · {rows.length} {rows.length === 1 ? "event" : "events"}{logs.data.length >= 200 ? " · showing the 200 most recent" : ""}</span>
                <div className="rl-pager-btns">
                  <button type="button" className="rl-pg" disabled={cur === 1} onClick={() => setPageNum(cur - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
                  {pages.map((n) => <button key={n} type="button" className={`rl-pg${n === cur ? " is-on" : ""}`} onClick={() => setPageNum(n)} aria-current={n === cur ? "page" : undefined}>{n}</button>)}
                  <button type="button" className="rl-pg" disabled={cur === totalPages} onClick={() => setPageNum(cur + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
                </div>
              </div>
            </section>
          </>
        )
      )}

      {viewing && (
        <Modal title="Event details" onClose={() => setViewing(null)} width={460}>
          <div className="rl-detail">
            <div><span>Event</span><b>{viewing.message}</b></div>
            <div><span>Type</span><b>{logType(viewing.type).label}</b></div>
            <div><span>Admin</span><b>{viewing.actor}{roleLabel(viewing.role) ? ` · ${roleLabel(viewing.role)}` : ""}</b></div>
            <div><span>Date</span><b>{fmtDate(viewing.created_at)}</b></div>
            <div><span>Time</span><b>{fmtDateTime(viewing.created_at)}</b></div>
            <div><span>Event ID</span><b style={{ fontFamily: F.m, fontSize: 12 }}>{viewing.id}</b></div>
          </div>
          <div className="flex gap-2 mt-4"><GhostBtn onClick={() => setViewing(null)}>Close</GhostBtn></div>
        </Modal>
      )}
    </div>
  );
}

// ---- Edit these three before publishing ----
const APP_VERSION = "1.0.0";
const PRIVACY_URL = "https://your-website.com/privacy";
const SUPPORT_EMAIL = "support@your-domain.com";

function DeleteAccountRow() {
  const { token, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      await apiFetch("/auth/delete-account", { method: "POST", token, body: { password: pw } });
      logout();
    } catch (e) {
      // Older servers don't have this feature yet - fall back to an email request.
      if (e && (e.status === 404 || e.status === 405)) setUnsupported(true);
      else setErr((e && e.message) || "Could not delete the account.");
      setBusy(false);
    }
  };
  const base = { display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", fontFamily: F.b, fontSize: 13, color: C.ink };
  if (!open) {
    return (
      <div style={base}>
        <span style={{ color: C.inkSoft }}>Delete my account</span>
        <button type="button" onClick={() => setOpen(true)} style={{ border: 0, background: "none", color: "#B3261E", fontWeight: 600, fontSize: 13 }}>Delete</button>
      </div>
    );
  }
  return (
    <div style={{ padding: "11px 0", fontFamily: F.b }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#B3261E" }}>Delete your account?</div>
      <div style={{ fontSize: 12, color: C.inkSoft, margin: "4px 0 8px" }}>Your login and personal details are erased and cannot be recovered. Enter your password to confirm.</div>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoComplete="current-password" style={inputStyle} />
      {err && <div role="alert" style={{ fontSize: 12, color: "#B3261E", marginTop: 6 }}>{err}</div>}
      {unsupported && (
        <div role="alert" style={{ fontSize: 12, color: C.ink, marginTop: 8 }}>
          Instant deletion is not available on this server yet.{" "}
          <a style={{ color: "#0E9461", fontWeight: 600 }} href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request&body=Please%20delete%20my%20account%20and%20data.`}>Send a deletion request by email</a>.
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <button type="button" disabled={busy || !pw} onClick={submit} style={{ flex: 1, padding: "10px", borderRadius: 8, border: 0, background: "#B3261E", color: "#fff", fontWeight: 600, fontSize: 13, opacity: busy || !pw ? .6 : 1 }}>{busy ? "Deleting..." : "Delete account"}</button>
        <button type="button" onClick={() => { setOpen(false); setPw(""); setErr(""); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${C.hairline}`, background: C.white, color: C.ink, fontWeight: 600, fontSize: 13 }}>Cancel</button>
      </div>
    </div>
  );
}

function AboutPanel() {
  const { logout, name } = useAuth();
  const row = { display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: `1px solid ${C.hairline}`, fontFamily: F.b, fontSize: 13, color: C.ink };
  const link = { color: "#0E9461", fontWeight: 600, textDecoration: "none" };
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.hairline}`, borderRadius: 14, boxShadow: CARD_SHADOW, maxWidth: 420 }} className="px-5 py-2">
      <div style={row}><span style={{ color: C.inkSoft }}>App</span><span>Ramorra.io</span></div>
      <div style={row}><span style={{ color: C.inkSoft }}>Version</span><span>{APP_VERSION}</span></div>
      <div style={row}><span style={{ color: C.inkSoft }}>Signed in as</span><span>{name}</span></div>
      <div style={row}><span style={{ color: C.inkSoft }}>Privacy policy</span><a style={link} href={PRIVACY_URL} target="_blank" rel="noreferrer">Open</a></div>
      <div style={row}><span style={{ color: C.inkSoft }}>Help and support</span><a style={link} href={`mailto:${SUPPORT_EMAIL}?subject=Ramorra%20support`}>Email us</a></div>
      <DeleteAccountRow />
      <div className="pt-3 pb-3"><PrimaryBtn full onClick={logout}>{tr("Sign out")}</PrimaryBtn></div>
    </div>
  );
}


function PanelCard({ children }) {
  return <div style={{ background: C.panel, border: `1px solid ${C.hairline}`, borderRadius: 14, boxShadow: CARD_SHADOW, maxWidth: 460 }} className="px-5 py-4">{children}</div>;
}
function Seg({ value, options, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className="text-[12.5px] px-3.5 py-2 font-medium" style={{ fontFamily: F.b, borderRadius: 10, color: value === v ? "white" : C.inkSoft, background: value === v ? C.sidebar : C.white, border: `1px solid ${value === v ? C.sidebar : C.hairline}` }}>{l}</button>
      ))}
    </div>
  );
}
function PrefRow({ title, desc, children }) {
  return (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${C.hairline}` }}>
      <div style={{ fontFamily: F.b, fontSize: 13, fontWeight: 600, color: C.ink }}>{title}</div>
      {desc && <div style={{ fontFamily: F.b, fontSize: 11.5, color: C.inkFaint, margin: "2px 0 8px" }}>{desc}</div>}
      <div style={{ marginTop: desc ? 0 : 8 }}>{children}</div>
    </div>
  );
}
function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} style={{ width: 46, height: 26, borderRadius: 99, border: 0, padding: 3, background: checked ? "#0E9461" : "#B8C1D1", display: "flex", justifyContent: checked ? "flex-end" : "flex-start", transition: "background .15s" }}>
      <span style={{ width: 20, height: 20, borderRadius: 99, background: "#fff", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );
}
function usePrefs() {
  const [p, setP] = useState(PREFS);
  const set = (patch) => {
    const n = { ...p, ...patch };
    setP(n);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(n)); } catch { /* storage unavailable */ }
    applyPrefs(n);
  };
  return [p, set];
}

function AppearancePanel() {
  const [p, set] = usePrefs();
  return (
    <PanelCard>
      <PrefRow title="Theme" desc="Dark mode is in beta — some charts and colours may look different.">
        <Seg value={p.theme} onChange={(v) => set({ theme: v })} options={[["light", "Light"], ["dark", "Dark"], ["system", "Match phone"]]} />
      </PrefRow>
      <div style={{ fontFamily: F.b, fontSize: 11.5, color: C.inkFaint, paddingTop: 10 }}>Saved on this device only.</div>
    </PanelCard>
  );
}

function AccessibilityPanel() {
  const [p, set] = usePrefs();
  return (
    <PanelCard>
      <PrefRow title="Text size" desc="Makes page content larger. The menu stays the same size.">
        <Seg value={p.textSize} onChange={(v) => set({ textSize: v })} options={[["normal", "Normal"], ["large", "Large"], ["xlarge", "Extra large"]]} />
      </PrefRow>
      <PrefRow title="High contrast" desc="Sharper text and borders for easier reading.">
        <Switch checked={p.contrast} onChange={(v) => set({ contrast: v })} label="High contrast" />
      </PrefRow>
      <PrefRow title="Reduce motion" desc="Turns off animations and transitions.">
        <Switch checked={p.reduceMotion} onChange={(v) => set({ reduceMotion: v })} label="Reduce motion" />
      </PrefRow>
    </PanelCard>
  );
}

function LanguagePanel() {
  const [p, set] = usePrefs();
  const choose = (v) => { set({ lang: v }); setTimeout(() => window.location.reload(), 150); };
  return (
    <PanelCard>
      <PrefRow title="App language" desc="Menus and settings are translated. Other screens are still in English.">
        <Seg value={p.lang} onChange={choose} options={LANGS} />
      </PrefRow>
      <div style={{ fontFamily: F.b, fontSize: 11.5, color: C.inkFaint, paddingTop: 10 }}>The app reloads when you change language.</div>
    </PanelCard>
  );
}

function fmtBytes(n) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
function StoragePanel() {
  const { logout } = useAuth();
  const [used, setUsed] = useState(null);
  const [msg, setMsg] = useState("");
  const measure = () => {
    try { if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then((e) => setUsed(e.usage ?? 0)).catch(() => {}); } catch { /* not supported */ }
  };
  useEffect(measure, []);
  let host = "";
  try { host = new URL(API_BASE).host; } catch { host = API_BASE; }
  const clearCache = async () => {
    try {
      if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); }
      sessionStorage.clear();
      setMsg("Temporary files cleared. You stay signed in.");
    } catch { setMsg("Nothing to clear."); }
    measure();
  };
  const resetPrefs = () => { try { localStorage.removeItem(PREFS_KEY); } catch { /* ignore */ } window.location.reload(); };
  const wipe = () => {
    if (!window.confirm("Remove all data stored on this device and sign out?")) return;
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
    logout();
    window.location.reload();
  };
  const row = { display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: `1px solid ${C.hairline}`, fontFamily: F.b, fontSize: 13, color: C.ink };
  const btn = { fontFamily: F.b, fontSize: 13, fontWeight: 600, padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.hairline}`, background: C.white, color: C.ink, width: "100%", textAlign: "left" };
  return (
    <PanelCard>
      <div style={row}><span style={{ color: C.inkSoft }}>Stored on this device</span><span>{fmtBytes(used)}</span></div>
      <div style={{ ...row, borderBottom: 0 }}><span style={{ color: C.inkSoft }}>Connected server</span><span style={{ wordBreak: "break-all", textAlign: "right" }}>{host}</span></div>
      <div className="flex flex-col gap-2 pt-2">
        <button type="button" style={btn} onClick={clearCache}>Clear temporary files</button>
        <button type="button" style={btn} onClick={resetPrefs}>Reset appearance, accessibility and language</button>
        <button type="button" style={{ ...btn, color: "#B3261E" }} onClick={wipe}>Clear all data and sign out</button>
      </div>
      {msg && <div role="status" style={{ fontFamily: F.b, fontSize: 12, color: "#0E9461", paddingTop: 10 }}>{msg}</div>}
      <div style={{ fontFamily: F.b, fontSize: 11.5, color: C.inkFaint, paddingTop: 10 }}>Your messages and contacts live on the server, so clearing this device never deletes them.</div>
    </PanelCard>
  );
}

function StatusMsg({ msg }) {
  if (!msg) return null;
  return <div role={msg.ok ? "status" : "alert"} style={{ fontFamily: F.b, fontSize: 12.5, color: msg.ok ? "#0E9461" : C.rust, margin: "4px 0 12px" }}>{msg.text}</div>;
}

function ProfilePanel() {
  const { token, name, setName } = useAuth();
  const [form, setForm] = useState({ name: name || "", phone: "" });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError(null);
    apiFetch("/auth/me", { token }).then(
      (me) => { if (!cancelled) { setForm({ name: me.name, phone: me.phone || "" }); setEmail(me.email); setLoading(false); } },
      (err) => { if (!cancelled) { setLoadError(err); setLoading(false); } }
    );
    return () => { cancelled = true; };
  }, [token, tries]);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const me = await apiFetch("/auth/me", { method: "PATCH", token, body: { name: form.name, phone: form.phone } });
      setName(me.name);
      setForm({ name: me.name, phone: me.phone || "" });
      setMsg({ ok: true, text: "Profile saved." });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const outdated = loadError && (loadError.status === 404 || loadError.status === 405);
  const locked = loading || !!loadError;

  return (
    <div className="rl-pf-card">
      <div className="rl-pf-row">
        <span className="rl-pf-ico"><UserIcon size={22} /></span>
        <div className="rl-pf-field">
          <label htmlFor="pf-name">Full name</label>
          <input id="pf-name" className="rl-pf-input" value={form.name} disabled={locked} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
      </div>

      <div className="rl-pf-row">
        <span className="rl-pf-ico"><Phone size={22} /></span>
        <div className="rl-pf-field">
          <label htmlFor="pf-phone">Phone</label>
          <input id="pf-phone" className="rl-pf-input" value={form.phone} disabled={locked} maxLength={30} placeholder="+91 98765 43210" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </div>

      <div className="rl-pf-row">
        <span className="rl-pf-ico"><Mail size={22} /></span>
        <div className="rl-pf-field">
          <label htmlFor="pf-email">Email</label>
          <div className="rl-pf-input-wrap">
            <input id="pf-email" className="rl-pf-input is-locked" value={email} disabled placeholder="Your login email" />
            <Lock size={17} className="rl-pf-lock" />
          </div>
        </div>
      </div>

      <div className="rl-pf-note"><Info size={16} /> Email is your login and can't be changed here.</div>

      {loadError && (
        <div className="rl-pf-banner" role="alert">
          <AlertCircle size={20} />
          <span className="grow">
            Unable to load profile details. Please try again.
            {outdated && <small>This server doesn't support profile editing yet. Update the backend and restart it.</small>}
          </span>
          <button type="button" className="rl-pf-retry" onClick={() => setTries((t) => t + 1)}><RefreshCw size={16} /> Retry</button>
        </div>
      )}
      {msg && <div className={`rl-pf-banner ${msg.ok ? "is-ok" : ""}`} role={msg.ok ? "status" : "alert"}><span className="grow">{msg.text}</span></div>}

      <button type="button" className="rl-pf-save" disabled={saving || locked || !form.name.trim()} onClick={save}>
        <Save size={19} /> {saving ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}

function SecurityPanel() {
  const { token } = useAuth();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const problem =
    f.next && f.next.length < 8 ? "New password must be at least 8 characters." :
    f.next && f.current && f.next === f.current ? "New password must be different from the current one." :
    f.confirm && f.next !== f.confirm ? "The two new passwords don't match." : null;
  const ready = f.current && f.next.length >= 8 && f.next === f.confirm && f.next !== f.current;

  const submit = async () => {
    setSaving(true); setMsg(null);
    try {
      await apiFetch("/auth/change-password", { method: "POST", token, body: { current_password: f.current, new_password: f.next } });
      setF({ current: "", next: "", confirm: "" });
      setMsg({ ok: true, text: "Password changed. Use the new password next time you sign in." });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };
  const type = show ? "text" : "password";

  return (
    <PanelCard>
      <Field label="Current password"><input style={inputStyle} type={type} autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
      <Field label="New password"><input style={inputStyle} type={type} autoComplete="new-password" placeholder="At least 8 characters" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
      <Field label="Confirm new password"><input style={inputStyle} type={type} autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F.b, fontSize: 12.5, color: C.inkSoft, marginBottom: 12 }}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords
      </label>
      {problem && <div style={{ fontFamily: F.b, fontSize: 12.5, color: C.rust, marginBottom: 10 }}>{problem}</div>}
      <StatusMsg msg={msg} />
      <PrimaryBtn disabled={saving || !ready} onClick={submit}>{saving ? "Changing..." : "Change password"}</PrimaryBtn>
    </PanelCard>
  );
}

function PreferencesPanel() {
  const [p, set] = usePrefs();
  return (
    <PanelCard>
      <PrefRow title="Open this page after sign-in" desc="The screen you land on when you open the app.">
        <Seg value={p.landing} onChange={(v) => set({ landing: v })} options={[["dashboard", "Dashboard"], ["inbox", "Inbox"], ["crm", "Contacts"], ["campaigns", "Campaigns"], ["analytics", "Analytics"]]} />
      </PrefRow>
      <PrefRow title="Sidebar" desc="How the menu looks when the app opens (desktop and tablet).">
        <Seg value={p.sidebar} onChange={(v) => set({ sidebar: v })} options={[["expanded", "Expanded"], ["collapsed", "Collapsed"]]} />
      </PrefRow>
      <PrefRow title="Table density" desc="Row spacing in the dashboard and admin tables.">
        <Seg value={p.density} onChange={(v) => set({ density: v })} options={[["comfortable", "Comfortable"], ["compact", "Compact"]]} />
      </PrefRow>
      <PrefRow title="Time format" desc="How times are shown in tables.">
        <Seg value={p.timeFormat} onChange={(v) => set({ timeFormat: v })} options={[["12h", "12-hour"], ["24h", "24-hour"]]} />
      </PrefRow>
      <div style={{ fontFamily: F.b, fontSize: 11.5, color: C.inkFaint, paddingTop: 10 }}>Saved on this device only. Page and sidebar choices apply the next time you open the app.</div>
    </PanelCard>
  );
}

function NotificationsPanel() {
  const [p, set] = usePrefs();
  return (
    <PanelCard>
      <PrefRow title="Unread badge on Inbox" desc="Show the green unread count next to Inbox in the menu.">
        <Switch checked={p.inboxBadge !== false} onChange={(v) => set({ inboxBadge: v })} label="Show unread badge on Inbox" />
      </PrefRow>
      <div style={{ fontFamily: F.b, fontSize: 12, color: C.inkFaint, paddingTop: 12, lineHeight: 1.55 }}>
        Email and push alerts (new messages, a number going into warning, a campaign finishing) aren't available yet. They need server-side support. This setting is saved on this device only and applies when you change pages.
      </div>
    </PanelCard>
  );
}

function ShortcutPanel({ icon: Icon, text, action, onOpen }) {
  return (
    <PanelCard>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span className="rl-chart-ico" style={{ width: 40, height: 40, borderRadius: 12, background: C.jadeSoft, color: C.jade, flex: "0 0 40px" }}><Icon size={20} /></span>
        <div style={{ fontFamily: F.b, fontSize: 13.5, color: C.inkSoft, lineHeight: 1.55 }}>{text}</div>
      </div>
      <div style={{ marginTop: 16 }}><PrimaryBtn onClick={onOpen}>{action}</PrimaryBtn></div>
    </PanelCard>
  );
}

// ---- Backups: a real, manual export of your data (downloaded to this device) ----
const BACKUP_SETS = [
  { key: "contacts", label: "Contacts", desc: "Names, phones, emails, tags and stages", icon: Contact },
  { key: "campaigns", label: "Campaigns", desc: "Campaign details and results", icon: Megaphone },
  { key: "automations", label: "Automations", desc: "Automations and their steps", icon: Workflow },
  { key: "chatbots", label: "Chatbots", desc: "Bots, keywords and flows", icon: Bot },
  { key: "numbers", label: "WhatsApp numbers", desc: "Your numbers and their statistics", icon: Phone },
  { key: "admins", label: "Admins", desc: "Team members (passwords are never included)", icon: Users },
  { key: "logs", label: "Activity logs", desc: "The 200 most recent events", icon: ScrollText },
];
const BACKUP_FETCH = {
  contacts: async (token) => {
    const items = []; let page = 1, totalPages = 1;
    do {
      const r = await apiFetch("/contacts", { token, params: { page, per_page: 100 } });
      items.push(...r.items); totalPages = r.total_pages; page += 1;
    } while (page <= totalPages && page <= 500);
    return items;
  },
  campaigns: (token) => apiFetch("/campaigns", { token }),
  automations: (token) => apiFetch("/automations", { token }),
  chatbots: (token) => apiFetch("/chatbots", { token }),
  numbers: (token) => apiFetch("/numbers", { token }),
  admins: (token) => apiFetch("/admins", { token }),
  logs: (token) => apiFetch("/activity-logs", { token, params: { limit: 200 } }),
};
const REMINDER_DAYS = { weekly: 7, monthly: 30 };
function daysSince(iso) { const t = new Date(iso).getTime(); return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : null; }
/** Is a backup reminder due? Based on the last backup made from this device. */
function backupDue(p) {
  const need = REMINDER_DAYS[p.backupReminder];
  if (!need) return { due: false, days: null };
  const d = p.lastBackupAt ? daysSince(p.lastBackupAt) : null;
  return { due: d === null || d >= need, days: d };
}
function downloadFile(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function BackupPanel() {
  const { token } = useAuth();
  const [p, set] = usePrefs();
  const [chosen, setChosen] = useState(() => Object.fromEntries(BACKUP_SETS.map((b) => [b.key, true])));
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [msg, setMsg] = useState(null);

  const picked = BACKUP_SETS.filter((b) => chosen[b.key]);
  const due = backupDue(p);
  const last = p.lastBackupAt ? new Date(p.lastBackupAt) : null;
  const lastDays = p.lastBackupAt ? daysSince(p.lastBackupAt) : null;

  const run = async () => {
    setBusy(true); setMsg(null);
    const out = { app: "Ramorra.io", exported_at: new Date().toISOString(), counts: {}, data: {} };
    let current = "";
    try {
      for (const b of picked) {
        current = b.label; setStep(`Reading ${b.label.toLowerCase()}...`);
        const rows = await BACKUP_FETCH[b.key](token);
        out.data[b.key] = rows; out.counts[b.key] = rows.length;
      }
      const total = Object.values(out.counts).reduce((n, c) => n + c, 0);
      downloadFile(`ramorra-backup-${out.exported_at.slice(0, 10)}.json`, JSON.stringify(out, null, 2), "application/json");
      set({ lastBackupAt: out.exported_at });
      setMsg({ ok: true, text: `Backup downloaded: ${total.toLocaleString()} records from ${picked.length} ${picked.length === 1 ? "section" : "sections"}.` });
    } catch (err) {
      setMsg({ ok: false, text: `Could not back up ${current.toLowerCase() || "your data"}: ${err.message}. Nothing was downloaded.` });
    } finally {
      setBusy(false); setStep("");
    }
  };

  return (
    <div className="rl-bk">
      <div className="rl-bk-card">
        <div className="rl-bk-title">Back up now</div>
        <p className="rl-bk-sub">Download a copy of your data as one file. You choose what goes in it.</p>
        <div className="rl-bk-list">
          {BACKUP_SETS.map((b) => { const I = b.icon; return (
            <label key={b.key} className="rl-bk-item">
              <input type="checkbox" checked={!!chosen[b.key]} disabled={busy} onChange={(e) => setChosen({ ...chosen, [b.key]: e.target.checked })} />
              <span className="rl-bk-ico"><I size={18} /></span>
              <span className="rl-bk-text"><b>{b.label}</b><em>{b.desc}</em></span>
            </label>
          ); })}
        </div>
        <div className="rl-bk-links">
          <button type="button" onClick={() => setChosen(Object.fromEntries(BACKUP_SETS.map((b) => [b.key, true])))} disabled={busy}>Select all</button>
          <button type="button" onClick={() => setChosen(Object.fromEntries(BACKUP_SETS.map((b) => [b.key, false])))} disabled={busy}>Clear</button>
        </div>
        <div className="rl-bk-warn"><Lock size={15} /> The file contains customer details and is not encrypted. Keep it private and store it somewhere safe.</div>
        {msg && <div className={`rl-pf-banner ${msg.ok ? "is-ok" : ""}`} style={{ marginLeft: 0 }} role={msg.ok ? "status" : "alert"}><span className="grow">{msg.text}</span></div>}
        <button type="button" className="rl-pf-save" style={{ width: "100%", marginLeft: 0 }} disabled={busy || picked.length === 0} onClick={run}>
          <Download size={19} /> {busy ? step || "Preparing..." : "Download backup"}
        </button>
      </div>

      <div className="rl-bk-card">
        <div className="rl-bk-title">Backup reminder</div>
        <p className="rl-bk-sub">The app can remind you to back up. Saved on this device only.</p>
        <div className="rl-bk-last"><span>Last backup from this device</span><b>{last ? `${fmtDate(p.lastBackupAt)}, ${fmtDateTime(p.lastBackupAt)}${lastDays !== null ? ` (${lastDays === 0 ? "today" : `${lastDays} day${lastDays === 1 ? "" : "s"} ago`})` : ""}` : "Never"}</b></div>
        <Seg value={p.backupReminder} onChange={(v) => set({ backupReminder: v })} options={[["off", "Off"], ["weekly", "Every week"], ["monthly", "Every month"]]} />
        {due.due && <div className="rl-bk-due" role="status"><AlertCircle size={17} /> {due.days === null ? "You haven't made a backup from this device yet." : `Your last backup was ${due.days} days ago.`} Use Back up now above.</div>}
      </div>

      <div className="rl-bk-card">
        <div className="rl-bk-title">Not available yet</div>
        <div className="rl-bk-soon"><div><b>Automatic backups</b><em>Daily or weekly copies kept on the server. This needs a scheduled job on the server.</em></div><span>Planned</span></div>
        <div className="rl-bk-soon"><div><b>Restore from a backup file</b><em>Importing a file back into the app needs a server feature that doesn't exist yet. Keep your downloaded files safe in the meantime.</em></div><span>Planned</span></div>
      </div>
    </div>
  );
}

const SETTINGS_GROUPS = [
  { title: "Account", items: [
    { key: "profile", label: "Profile", icon: UserIcon, desc: "Your name, phone and login email." },
    { key: "security", label: "Security", icon: Lock, desc: "Change your password." },
    { key: "language", label: "Language", icon: Globe, desc: "Choose the language the app menus use." },
  ] },
  { title: "Personalization", items: [
    { key: "appearance", label: "Appearance", icon: Palette, desc: "Theme, start page, sidebar, table spacing and time format." },
    { key: "accessibility", label: "Accessibility", icon: AccessIcon, desc: "Text size, contrast and motion." },
    { key: "notifications", label: "Notifications", icon: Bell, desc: "What the app tells you about." },
  ] },
  { title: "Workspace & Integrations", items: [
    { key: "whatsapp", label: "WhatsApp", icon: Phone, desc: "Your connected WhatsApp numbers." },
    { key: "apikeys", label: "API Keys", icon: Key, desc: "WhatsApp provider keys. Values stay masked.", roles: ["super_admin"] },
    { key: "automations", label: "Automations", icon: Workflow, desc: "Rules that send messages for you." },
    { key: "team", label: "Team", icon: Users, desc: "The admins in your workspace.", roles: ["super_admin"] },
  ] },
  { title: "Data & System", items: [
    { key: "storage", label: "Storage", icon: Database, desc: "Space used on this device, and resetting local data." },
    { key: "backups", label: "Backups", icon: Archive, desc: "Download a copy of your data and set a reminder.", roles: ["super_admin"] },
    { key: "audit", label: "Audit Logs", icon: ScrollText, desc: "A record of who did what.", roles: ["super_admin"] },
    { key: "about", label: "About", icon: Info, desc: "App version, privacy and account deletion." },
  ] },
];

function SettingsPage({ role, setPage }) {
  const [tab, setTab] = useState("profile");
  const [open, setOpen] = useState(false); // phones: false = menu list, true = a section is open

  const groups = SETTINGS_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.roles || it.roles.includes(role)) }))
    .filter((g) => g.items.length);
  const all = groups.flatMap((g) => g.items);
  const current = all.find((it) => it.key === tab) || all[0];
  const go = (page) => () => setPage && setPage(page);
  const HeroIcon = current.icon;

  const content = {
    profile: <ProfilePanel />,
    security: <SecurityPanel />,
    language: <LanguagePanel />,
    appearance: <div className="flex flex-col gap-4"><AppearancePanel /><PreferencesPanel /></div>,
    accessibility: <AccessibilityPanel />,
    notifications: <NotificationsPanel />,
    whatsapp: <ShortcutPanel icon={Phone} text="Add, connect and monitor your WhatsApp numbers, including their status and delivery rates." action="Open WhatsApp Numbers" onOpen={go("numbers")} />,
    apikeys: <ApiKeysPage />,
    automations: <ShortcutPanel icon={Workflow} text="Create and manage rules that send WhatsApp messages automatically." action="Open Automations" onOpen={go("automations")} />,
    team: <ShortcutPanel icon={Users} text="See every admin, their numbers and performance, and add new admins." action="Open Admins" onOpen={go("admins")} />,
    storage: <StoragePanel />,
    backups: <BackupPanel />,
    audit: <ShortcutPanel icon={ScrollText} text="Review a record of sign-ins and actions taken in your workspace." action="Open Activity Logs" onOpen={go("activity")} />,
    about: <AboutPanel />,
  };

  return (
    <div>
      <div className={`rl-set${open ? " is-detail" : ""}`}>
        <nav className="rl-set-nav" aria-label="Settings sections">
          <div className="rl-set-nav-head"><SettingsIcon size={22} /><span>{tr("Settings")}</span></div>
          {groups.map((g) => (
            <div key={g.title}>
              <div className="rl-set-group">{g.title}</div>
              {g.items.map((it) => {
                const Icon = it.icon;
                const active = current.key === it.key;
                return (
                  <button key={it.key} type="button" className={`rl-set-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}
                    onClick={() => { setTab(it.key); setOpen(true); }}>
                    <Icon size={18} />
                    <span className="rl-set-label">{tr(it.label)}</span>
                    {it.key === "backups" && backupDue(LIVE_PREFS).due && <i className="rl-set-dot" title="Backup reminder" />}
                    <ChevronRight size={16} className="rl-set-chev" />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <section className="rl-set-content">
          <button type="button" className="rl-set-back" onClick={() => setOpen(false)}><ChevronLeft size={16} /> Settings</button>
          <div className="rl-set-hero">
            <span className="rl-set-hero-ico"><HeroIcon size={32} /></span>
            <div>
              <div className="rl-set-title">{tr(current.label)}</div>
              <div className="rl-set-desc">{current.desc}</div>
            </div>
          </div>
          {content[current.key]}
        </section>
      </div>
    </div>
  );
}

// ============================================================
// ROOT APP
// ============================================================
function BottomNav({ role, page, setPage, onMore }) {
  const nav = role === "super_admin" ? NAV_SUPER : NAV_ADMIN;
  const keys = ["dashboard", "inbox", "crm", "campaigns"];
  const tabs = keys.map((k) => nav.find((n) => n.key === k)).filter(Boolean);
  const short = { crm: tr("Contacts") };
  return (
    <nav className="relay-bottom-nav" aria-label="Primary">
      {tabs.map((t) => (
        <button key={t.key} type="button" className={page === t.key ? "is-active" : ""} onClick={() => setPage(t.key)} aria-current={page === t.key ? "page" : undefined}>
          <t.icon size={20} />
          <span>{short[t.key] || t.label}</span>
        </button>
      ))}
      <button type="button" className={tabs.some((t) => t.key === page) ? "" : "is-active"} onClick={onMore} aria-label="More">
        <Menu size={20} />
        <span>More</span>
      </button>
    </nav>
  );
}

function Shell() {
  const { isAuthed, role } = useAuth();
  const [page, setPage] = useState(() => (["dashboard", "inbox", "crm", "campaigns", "analytics"].includes(LIVE_PREFS.landing) ? LIVE_PREFS.landing : "dashboard"));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => LIVE_PREFS.sidebar === "collapsed");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pageRef = useRef(page);
  const menuRef = useRef(mobileMenuOpen);
  pageRef.current = page;
  menuRef.current = mobileMenuOpen;

  // Android back button: close the menu, then go back to the dashboard, then exit.
  useEffect(() => {
    let handle;
    CapApp.addListener("backButton", () => {
      if (menuRef.current) { setMobileMenuOpen(false); return; }
      if (pageRef.current !== "dashboard") { setPage("dashboard"); return; }
      try { CapApp.exitApp(); } catch { /* not available in a browser */ }
    }).then((h) => { handle = h; }).catch(() => {});
    return () => { if (handle) handle.remove(); };
  }, []);

  if (!isAuthed) return <div className="relay-auth-screen"><LoginScreen /></div>;

  const pageMap = {
    dashboard: role === "super_admin" ? <SuperAdminDashboard /> : <AdminDashboard />,
    admins: <AdminsPage />,
    numbers: <NumbersPage role={role} />,
    inbox: <InboxPage />,
    crm: <CrmPage />,
    campaigns: <CampaignsPage />,
    automations: <AutomationsPage />,
    chatbot: <ChatbotPage />,
    analytics: <AnalyticsPage />,
    activity: <ActivityLogsPage />,
    settings: <SettingsPage role={role} setPage={setPage} />,
  };

  return (
    <div className="relay-shell flex" style={{ background: "#F2F5FA", overflow: "hidden" }}>
      {mobileMenuOpen && (
        <button
          type="button"
          className="relay-mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <Sidebar
        role={role}
        page={page}
        setPage={setPage}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      <div className="relay-main flex-1 flex flex-col min-w-0 min-h-0">
        <Topbar onMenu={() => { setSidebarCollapsed(false); setMobileMenuOpen(true); }} />
        <div className="relay-page flex-1 px-5 py-5" key={page}>{pageMap[page]}</div>
        <BottomNav role={role} page={page} setPage={setPage} onMore={() => { setSidebarCollapsed(false); setMobileMenuOpen(true); }} />
      </div>
    </div>
  );
}

export default function RelayCrmApp() {
  return (
    <div style={{ fontFamily: F.b, background: C.bg }}>
      <style>{FONT_IMPORT + RESPONSIVE_CSS}</style>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </div>
  );
}