/* eslint-disable react/prop-types */
import Cookies from "js-cookie";

const CookiePreferences = ({consent, setConsent}) => {


  const updateConsent = (value) => {
    Cookies.set("ga_cookie_consent", value, { expires: 365 });

    if (!value) {
        [
            "_ga",
            "_ga_" + import.meta.env?.REACT_APP_GA_MEASUREMENT_ID?.split("-")[1]
        ].forEach((cookie) => Cookies.remove(cookie));
    }
    setConsent(value);
    window.location.reload(); // Reload to apply change (e.g. GA scripts)
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Cookie Preferences</h1>
      <p className="text-gray-700 mb-6">
        FlamapyIDE uses <strong>Google Analytics</strong> to help us improve usability by collecting anonymous usage statistics.
        You can choose whether to allow these analytics cookies below.
      </p>

      <div className="bg-white border border-gray-200 rounded-md shadow p-6 mb-6">
        <p className="mb-4 text-gray-800 font-medium">Google Analytics:</p>
        <div className="flex gap-4">
          <button
            onClick={() => updateConsent(true)}
            className={`px-4 py-2 rounded ${
              consent === true
                ? "bg-green-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-green-100"
            }`}
          >
            Allow
          </button>
          <button
            onClick={() => updateConsent(false)}
            className={`px-4 py-2 rounded ${
              consent === false
                ? "bg-red-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-red-100"
            }`}
          >
            Decline
          </button>
        </div>
        {consent !== null && (
          <p className="mt-4 text-sm text-gray-600">
            Current preference:{" "}
            <span className="font-semibold">
              {consent ? "Allowed" : "Declined"}
            </span>
          </p>
        )}
      </div>

      <p className="text-sm text-gray-500">
        You can change your preference at any time by revisiting this page.
      </p>
    </div>
  );
};

export default CookiePreferences;
