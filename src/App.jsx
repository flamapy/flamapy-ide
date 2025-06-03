import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import EditorPage from "./pages/editor/EditorPage";
import "./App.css";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import { Link } from "react-router-dom";
import HowToCiteUs from "./pages/HowToCiteUs";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <BrowserRouter>
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
        </Navbar>

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
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
