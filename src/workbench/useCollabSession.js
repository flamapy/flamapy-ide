import { useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Collaboration endpoint when VITE_COLLAB_URL is not set: derive it from the page's
// own origin so the all-in-one Docker image (nginx proxies /collab to the bundled
// collab server) works on localhost or any domain without a rebuild. Falls back to
// the local dev server when there is no window (e.g. tests).
function defaultCollabEndpoint() {
  if (typeof window === "undefined") return "ws://localhost:1234";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/collab`;
}

// Real-time collaboration session state (yjs over websocket): URL ?doc= drives the
// session; starting one health-checks the backend first. `onBeforeStart` lets the
// caller snapshot the editor content before navigation remounts monaco in collab mode.
export function useCollabSession({ onBeforeStart }) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const docIdFromQuery = searchParams.get("doc");
  const collabFeatureAvailable = import.meta.env.VITE_ENABLE_COLLAB === "true";
  const collabEnabled = collabFeatureAvailable && !!docIdFromQuery;
  const collabEndpoint = import.meta.env.VITE_COLLAB_URL || defaultCollabEndpoint();
  const collabConfig = collabEnabled
    ? { enabled: true, docId: docIdFromQuery, endpoint: collabEndpoint }
    : { enabled: false };

  const [copyMessage, setCopyMessage] = useState("");
  const [collabStatus, setCollabStatus] = useState("");

  const generateDocId = useCallback(() => {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }, []);

  async function checkCollabHealth() {
    try {
      const wsUrl = new URL(collabEndpoint);
      const healthUrl = new URL(wsUrl);
      healthUrl.protocol = wsUrl.protocol === "wss:" ? "https:" : "http:";
      // Append /health to the endpoint path so it works for both a same-origin
      // proxied endpoint (…/collab -> …/collab/health) and a bare host:port one.
      healthUrl.pathname = `${wsUrl.pathname.replace(/\/+$/, "")}/health`;
      const res = await fetch(healthUrl.toString(), { mode: "cors" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function handleCopySessionLink() {
    if (!collabEnabled || !docIdFromQuery) return;
    const url = new URL(window.location.href);
    url.searchParams.set("doc", docIdFromQuery);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopyMessage("Session link copied");
    } catch {
      setCopyMessage("Unable to copy link");
    }
    setTimeout(() => setCopyMessage(""), 2000);
  }

  async function handleStartCollab() {
    if (!collabFeatureAvailable) {
      setCollabStatus("Enable VITE_ENABLE_COLLAB=true to use collaboration.");
      return;
    }
    const warning =
      "This feature relies on a backend server. Your file will no longer be sandboxed to this machine. Continue?";
    if (!window.confirm(warning)) { setCollabStatus(""); return; }
    setCollabStatus("Checking collaboration backend…");
    if (!(await checkCollabHealth())) {
      setCollabStatus("Collaboration backend is not responding.");
      return;
    }
    onBeforeStart?.();
    const newDocId = generateDocId();
    const nextSearch = new URLSearchParams(location.search);
    nextSearch.set("doc", newDocId);
    navigate({ pathname: location.pathname, search: nextSearch.toString() });
    setCollabStatus("Session created. Share the link to collaborate.");
  }

  return {
    collabConfig,
    collab: {
      enabled: collabEnabled,
      available: collabFeatureAvailable,
      onCopySession: handleCopySessionLink,
      copyMessage,
      onStart: handleStartCollab,
      status: collabStatus,
    },
    searchParams,
  };
}
