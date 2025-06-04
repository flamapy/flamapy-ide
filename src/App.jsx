import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import EditorPage from "./pages/editor/EditorPage";
import "./App.css";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import { Link } from "react-router-dom";
import HowToCiteUs from "./pages/HowToCiteUs";
import { initGA } from "./utils/analytics";
import CookieConsent from "react-cookie-consent";
import PageTracker from "./components/PageTracker";
import getCookie from "./utils/getCookieValue";
import CookiePreferences from "./pages/CookiePreferences";
import PrivacyPolicy from "./pages/PivacyPolicy";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [hasConsented, setHasConsented] = useState(() => getCookie('ga_cookie_consent') === 'true' ? true: false );

  useEffect(() => {
		if (hasConsented) {
			initGA();
		}
	}, [hasConsented]);

  return (
    <BrowserRouter>
      <PageTracker />
      <div className="h-screen w-screen flex flex-col">
        <Navbar>
          <Link
            to="/how-to-cite-us"
            className="text-m font-medium text-gray-600 hover:text-blue-600 transition-colors duration-200"
          >
            How to cite us
          </Link>
          <Link
            to="https://github.com/flamapy/flamapy-ide"
            className="text-m font-medium text-gray-600 hover:text-blue-600 transition-colors duration-200"
          >
            GitHub
          </Link>
          <Link
            to="/privacy"
            className="text-m font-medium text-gray-600 hover:text-blue-600 transition-colors duration-200"
          >
            Privacy
          </Link>
        </Navbar>

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
            path="/"
            element={<Home setSelectedFile={setSelectedFile} />}
          ></Route>
          <Route
            path="/editor"
            element={<EditorPage selectedFile={selectedFile} />}
          ></Route>
          <Route
            path="/how-to-cite-us"
            element={<HowToCiteUs />}
          ></Route>
          <Route
            path="/privacy"
            element={<PrivacyPolicy />}
          ></Route>
          <Route
            path="/cookie-preferences"
            element={<CookiePreferences consent={hasConsented} setConsent={setHasConsented} />}
          ></Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
