import { useState } from "react";

// Browsers and intermediaries start rejecting URLs in the low tens of KB;
// stay safely below that when embedding the whole model in a link.
const MAX_SHARE_URL_LENGTH = 8000;

// Share-link and UVLHub flows: pure document concerns (base64 of the model text in a
// URL), no engine dependency beyond the validity gate for UVLHub uploads.
export function useShareLinks({ getText, ensureValidated }) {
  const [shareMessage, setShareMessage] = useState("");
  const [uvlhubMessage, setUvlhubMessage] = useState("");

  async function handleCopyModelLink() {
    const encoded = btoa(unescape(encodeURIComponent(getText() || "")));
    if (encoded.length > MAX_SHARE_URL_LENGTH) {
      setShareMessage("Model too large to share as a link");
      setTimeout(() => setShareMessage(""), 3000);
      return;
    }
    const url = new URL("/editor", window.location.href);
    url.searchParams.set("model", encoded);
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareMessage("Link copied!");
    } catch {
      setShareMessage("Unable to copy");
    }
    setTimeout(() => setShareMessage(""), 2000);
  }

  async function handleSaveToUVLHub() {
    const currentValidation = await ensureValidated();
    if (!currentValidation?.valid) {
      setUvlhubMessage("Model must be valid");
      setTimeout(() => setUvlhubMessage(""), 2000);
      return;
    }
    const encoded = btoa(unescape(encodeURIComponent(getText() || "")));
    if (encoded.length > MAX_SHARE_URL_LENGTH) {
      setUvlhubMessage("Model too large to send as a link");
      setTimeout(() => setUvlhubMessage(""), 3000);
      return;
    }
    const rawEndpoint = new URL("/raw/model.uvl", window.location.href);
    rawEndpoint.searchParams.set("model", encoded);
    const uvlhubBase = import.meta.env.VITE_UVLHUB_URL || "https://www.uvlhub.io";
    const uvlhubUrl = new URL("/dataset/import/", uvlhubBase);
    uvlhubUrl.searchParams.set("import", rawEndpoint.toString());
    window.open(uvlhubUrl.toString(), "_blank", "noopener,noreferrer");
  }

  return { shareMessage, uvlhubMessage, handleCopyModelLink, handleSaveToUVLHub };
}
