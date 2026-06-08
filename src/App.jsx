/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet, Link } from "react-router-dom";
import EditorPage from "./pages/editor/EditorPage";
import "./App.css";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import HowToCiteUs from "./pages/HowToCiteUs";
import { initGA } from "./utils/analytics";
import CookieConsent from "react-cookie-consent";
import PageTracker from "./components/PageTracker";
import getCookie from "./utils/getCookieValue";
import CookiePreferences from "./pages/CookiePreferences";
import PrivacyPolicy from "./pages/PivacyPolicy";

// Marketing / info pages keep the classic Navbar; the editor owns its own
// VSCode-style chrome (title bar + toolbar + activity bar + status bar), so it
// renders outside this layout.
function NavbarLayout({ darkMode, toggleDark }) {
  return (
    <>
      <Navbar darkMode={darkMode} toggleDark={toggleDark}>
        <Link
          to="/how-to-cite-us"
          className="text-m font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors duration-200"
        >
          How to cite us
        </Link>
        <a
          href="https://github.com/flamapy/flamapy-ide"
          target="_blank"
          rel="noreferrer"
          className="text-m font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors duration-200"
        >
          GitHub
        </a>
        <Link
          to="/privacy"
          className="text-m font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors duration-200"
        >
          Privacy
        </Link>
      </Navbar>
      <div className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </div>
    </>
  );
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [hasConsented, setHasConsented] = useState(
    () => getCookie("ga_cookie_consent") === "true"
  );
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("flamapy-dark-mode") === "true"
  );
  const toggleDark = () => setDarkMode((d) => !d);

  useEffect(() => {
    if (hasConsented) {
      initGA();
    }
  }, [hasConsented]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("flamapy-dark-mode", darkMode);
  }, [darkMode]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PageTracker />
      <div className="h-screen w-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <CookieConsent
          location="bottom"
          buttonText="I accept"
          cookieName="ga_cookie_consent"
          onAccept={() => setHasConsented(true)}
          enableDeclineButton
          declineButtonText="Decline"
          onDecline={() => console.log("User declined GA tracking")}
        >
          We use cookies to analyze traffic. You can opt in or out anytime.
        </CookieConsent>

        <Routes>
          <Route
            path="/editor"
            element={<EditorPage selectedFile={selectedFile} darkMode={darkMode} toggleDark={toggleDark} />}
          />
          <Route element={<NavbarLayout darkMode={darkMode} toggleDark={toggleDark} />}>
            <Route path="/" element={<Home setSelectedFile={setSelectedFile} />} />
            <Route path="/how-to-cite-us" element={<HowToCiteUs />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route
              path="/cookie-preferences"
              element={<CookiePreferences consent={hasConsented} setConsent={setHasConsented} />}
            />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
