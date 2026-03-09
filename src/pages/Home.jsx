/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function Home({ setSelectedFile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [fetchError, setFetchError] = useState(false);
  const [importURL, setImportURL] = useState(null);
  const [showModelList, setShowModelList] = useState(false);

  const predefinedModels = [
    { name: "Xiaomi SmartBand 8", url: "assets/models/xiaomi-band-8.uvl" },
    { name: "SmartWatch", url: "assets/models/smart-watch.uvl" },
    { name: "Data VIZ", url: "assets/models/visualization.uvl" },

    // Add more models as needed
  ];

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has("import")) {
      const url = searchParams.get("import");
      setImportURL(url);

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
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center space-y-4">
        {fetchError && (
          <div className="max-w-xl bg-yellow-700 text-white text-center py-3 px-4 rounded-md mb-4">
            {`An error has occurred when trying to import the requested model. If the problem persists, try to import the model from your system.`}
          </div>
        )}
        <button
          className="w-full bg-[#356C99] text-white py-2 px-4 rounded active:bg-[#0D486C] shadow-lg"
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
          className="w-full bg-[#356C99] text-white py-2 px-4 rounded shadow-lg"
          onClick={() => document.getElementById("fileInput").click()}
        >
          Import model
        </button>

        {/* New Button to Show Model List */}
        <button
          className="w-full bg-[#356C99] text-white py-2 px-4 rounded shadow-lg"
          onClick={() => setShowModelList(true)}
        >
          Start from a sample model
        </button>

        {/* Modal for Model Selection */}
        {showModelList && (
          <div className="modal fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-4 rounded-md">
              <h2 className="text-lg font-semibold mb-2">Select a Model to Import</h2>
              <ul>
                {predefinedModels.map((model, index) => (
                  <li key={index} className="mb-2">
                    <button
                      className="text-blue-500 underline"
                      onClick={() => handleModelImport(model.url)}
                    >
                      {model.name}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="mt-4 bg-red-500 text-white py-1 px-3 rounded"
                onClick={() => setShowModelList(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div className="text-center text-sm italic">
          <p>
            Supported feature models: UVL (.uvl), Glencoe (.gfm.json), AFM
            (.afm), FeatureIDE (.fide), JSON (.json), FaMa (.xml)
          </p>
        </div>
      </div>
    </div>
  );
}

export default Home;
