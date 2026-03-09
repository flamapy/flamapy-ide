const bibtex = `@inproceedings{10.1145/3715340.3715436,
  author = {Benitez, Francisco Sebastian and Galindo, José A. and Romero Organvídez, David and Benavides, David},
  title = {UVL web-based editing and analysis with flamapy.ide},
  year = {2025},
  isbn = {9798400714412},
  publisher = {Association for Computing Machinery},
  address = {New York, NY, USA},
  url = {https://doi.org/10.1145/3715340.3715436},
  doi = {10.1145/3715340.3715436},
  abstract = {Feature modeling is widely used to represent variability in software systems, but as feature models grow in size and complexity, manual analysis becomes infeasible. Automated Analysis of Feature Models (AAFM) is a set of tools and algorithms that enable the computer-aided analysis of such models. Recently, the AAFM community has made an effort to enable the interoperability of tools by means of the UVL language, however, most of the supporting tools need to execute the operations in a server. This have two main drawbacks, first it requires users to upload the model to remote servers, imposing security concerns and second, limits the complexity of the operations that an online tool can offer. In this paper, we introduce flamapy.ide, an integrated development environment (IDE) based on the flamapy framework, and designed to perform AAFM directly within the browser by relying on WASM technologies. flamapy.ide provides SAT and BDD solvers for efficient feature model analysis and offers support for handling UVL files. Also, enables the configuration and visualization of such models relying on a fully client-side approach. This tool brings AAFM capabilities to web-based platforms, eliminating the need for server-side computation while ensuring ease of use and accessibility.},
  booktitle = {Proceedings of the 19th International Working Conference on Variability Modelling of Software-Intensive Systems},
  pages = {121–125},
  numpages = {5},
  series = {VaMoS '25}
}`;

const HowToCiteUs = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-3xl font-semibold text-gray-800 mb-4">How to Cite Us</h1>
      <p className="text-gray-700 mb-6">
        If you use <span className="font-medium">flamapy.ide</span> in your research, please cite the following paper:
      </p>

      <div className="bg-gray-100 rounded-md p-4 overflow-auto text-sm text-gray-800 font-mono border border-gray-300 whitespace-pre-wrap">
        {bibtex}
      </div>

      <p className="mt-4 text-sm text-gray-600">
        DOI:{" "}
        <a
          href="https://doi.org/10.1145/3715340.3715436"
          className="text-blue-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://doi.org/10.1145/3715340.3715436
        </a>
      </p>
    </div>
  );
};

export default HowToCiteUs;
