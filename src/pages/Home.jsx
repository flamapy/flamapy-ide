/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { vsBtnPrimary, vsBtn, vsCard } from "../components/ui/styles";

function Home({ setSelectedFile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [fetchError, setFetchError] = useState(false);
  const [showModelList, setShowModelList] = useState(false);

  const predefinedModels = [
    { name: "Xiaomi SmartBand 8 (Boolean Level)", url: "assets/models/xiaomi-band-8.uvl" },
    { name: "SmartWatch (Boolean Level)", url: "assets/models/smart-watch.uvl" },
    { name: "Data VIZ (Boolean Level)", url: "assets/models/visualization.uvl" },
    { name: "Pizza (Type Level)", url: "assets/models/pizza.uvl" },


    // Add more models as needed
  ];

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has("import")) {
      const url = searchParams.get("import");

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error();
          }
          const contentDisposition = response.headers.get("Content-Disposition");
          let filename = "imported-file.uvl"; // Default filename, assuming it is a UVL file
          // Extract filename from 'Content-Disposition' header if present
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(
              /filename[^;=\n]*=(['"]?)([^'"\n]*)\1/
            );
            if (filenameMatch && filenameMatch.length > 2) {
              filename = filenameMatch[2];
            }
          }
          return response.blob().then((fileBlob) => {
            const file = new File([fileBlob], filename, {
              type: fileBlob.type,
            });

            setSelectedFile(file);
            navigate("/editor");
          });
        })
        .catch(() => {
          setFetchError(true);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      navigate("/editor");
    }
  };

  const handleModelImport = (url) => {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error();
        }
        return response.blob();
      })
      .then((blob) => {
        const file = new File([blob], "imported-model.uvl", { type: blob.type });
        setSelectedFile(file);
        navigate("/editor");
        setShowModelList(false);
      })
      .catch(() => {
        setFetchError(true);
        setShowModelList(false);
      });
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-surface dark:bg-gray-900 px-4 py-10">
      <div className={`${vsCard} w-full max-w-md p-8`}>
        <div className="flex flex-col items-center text-center">
          <img
            src="assets/flamapy_horizontal_logo_white.svg"
            alt="Flamapy logo"
            width="200"
            className="mb-2"
          />
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Welcome to the Flamapy IDE
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create, import or explore a feature model to get started.
          </p>
        </div>

        {fetchError && (
          <div className="mt-6 bg-yellow-700/90 text-white text-center text-sm py-2.5 px-4 rounded-md">
            {`An error has occurred when trying to import the requested model. If the problem persists, try to import the model from your system.`}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            className={`${vsBtnPrimary} justify-center w-full py-2 text-[13px]`}
            onClick={() => {
              setSelectedFile(null);
              navigate("/editor");
            }}
          >
            Create new model
          </button>
          <input
            type="file"
            id="fileInput"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <button
            className={`${vsBtn} justify-center w-full py-2 text-[13px] border border-black/10 dark:border-white/10`}
            onClick={() => document.getElementById("fileInput").click()}
          >
            Import model
          </button>
          <button
            className={`${vsBtn} justify-center w-full py-2 text-[13px] border border-black/10 dark:border-white/10`}
            onClick={() => setShowModelList(true)}
          >
            Start from a sample model
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-gray-400 dark:text-gray-500">
          Supported feature models: UVL (.uvl), Glencoe (.gfm.json), AFM (.afm),
          FeatureIDE (.fide), JSON (.json), FaMa (.xml)
        </p>
      </div>

      {/* Modal for Model Selection */}
      {showModelList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className={`${vsCard} w-full max-w-sm p-6`}>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">
              Select a model to import
            </h2>
            <ul className="flex flex-col gap-1">
              {predefinedModels.map((model, index) => (
                <li key={index}>
                  <button
                    className={`${vsBtn} w-full justify-start py-2`}
                    onClick={() => handleModelImport(model.url)}
                  >
                    {model.name}
                  </button>
                </li>
              ))}
            </ul>
            <button
              className={`${vsBtn} justify-center w-full py-2 mt-4 border border-black/10 dark:border-white/10`}
              onClick={() => setShowModelList(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
