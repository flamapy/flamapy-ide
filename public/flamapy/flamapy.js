/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
importScripts("/pyodide/pyodide.js");

class Flamapy {
  constructor() {
    this.pyodide = null;
    this.isValid = false;
  }

  async loadFlamapy() {
    const pythonFile = await fetch("/flamapy/flamapy_ide.py");
    const pyodideInstance = await loadPyodide({
      indexURL: "pyodide",
    });
    await pyodideInstance.loadPackage("micropip");
    await pyodideInstance.loadPackage("python-sat");
    await pyodideInstance.runPythonAsync(`
  import micropip
  await micropip.install("flamapy/flamapy-2.0.1-py3-none-any.whl", deps=False)
  await micropip.install("flamapy/flamapy_fw-2.0.2.dev0-py3-none-any.whl", deps=False)
  await micropip.install("flamapy/flamapy_fm-2.0.2.dev0-py3-none-any.whl", deps=False)
  await micropip.install("flamapy/flamapy_sat-2.0.1-py3-none-any.whl", deps=False)
  await micropip.install("flamapy/flamapy_bdd-2.0.1-py3-none-any.whl", deps=False)
  await micropip.install("flamapy/dd-0.5.7-py3-none-any.whl", deps=False)
  await micropip.install("flamapy/ply-3.11-py2.py3-none-any.whl", deps=False)
  await micropip.install("flamapy/astutils-0.0.6-py3-none-any.whl", deps=False)
  await micropip.install("flamapy/graphviz-0.20-py3-none-any.whl", deps=False)
  await micropip.install("flamapy/uvlparser-2.0.1-py3-none-any.whl", deps=False)
  await micropip.install("flamapy/afmparser-1.0.3-py3-none-any.whl", deps=False)
  await micropip.install("flamapy/antlr4_python3_runtime-4.13.1-py3-none-any.whl", deps=False)
  await micropip.install("flamapy/flamapy_configurator-2.0.1-py3-none-any.whl", deps=False)
  `);
    await pyodideInstance.runPythonAsync(await pythonFile.text());
    pyodideInstance.FS.mkdir("export");

    this.pyodide = pyodideInstance;
  }

  async validateModel(code) {
    this.pyodide.globals.set("code", code);
    const jsonResult = await this.pyodide.runPythonAsync(
      `
  with open("uvlfile.uvl", "w") as text_file:
      text_file.write(code)
  
  process_uvl_file('uvlfile.uvl')
      `
    );
    const result = JSON.parse(jsonResult);
    this.isValid = result.valid;
    return result;
  }

  async executeAction(action) {
    if (this.isValid) {
      const result = await this.pyodide.runPythonAsync(
        `
  execute_pysat_operation('${action.value}')
          `
      );
      if (result.toJs) {
        return { label: action.label, result: result.toJs() };
      } else {
        return { label: action.label, result };
      }
    }
  }

  async downloadFile(action) {
    if (this.isValid) {
      const result = await this.pyodide.runPythonAsync(
        `
  execute_export_transformation('${action.value}')
          `
      );
      return result;
    }
  }

  async importModel(fileExtension, fileContent) {
    this.pyodide.globals.set("file_content", fileContent);
    const result = await this.pyodide.runPythonAsync(
      `
  execute_import_transformation('${fileExtension}', file_content)
        `
    );
    return result;
  }

  async getfeatureTree() {
    const jsonResult = await this.pyodide.runPythonAsync(
      `
  json.dumps(feature_tree(fm.fm_model.root))
        `
    );
    const result = JSON.parse(jsonResult);
    return result;
  }

  async getFeatures() {
    const result = await this.pyodide.runPythonAsync(
      `
  get_features()
        `
    );
    return result;
  }

  async executeActionWithConf(data) {
    if (this.isValid) {
      this.pyodide.globals.set("configuration", data.configuration);

      const result = await this.pyodide.runPythonAsync(
        `
  execute_configurator_operation('${data.action.value}', configuration.to_py())
          `
      );
      if (result.toJs) {
        return { label: data.action.label, result: result.toJs() };
      } else {
        return { label: data.action.label, result };
      }
    }
  }

  async startConfigurator() {
    const result = await this.pyodide.runPythonAsync(`
  start_configurator()`);
    return JSON.parse(result);
  }

  async answerQuestion(answer) {
    this.pyodide.globals.set("answer", answer);
    const result = await this.pyodide.runPythonAsync(`
  answer_question(answer)`);
    return JSON.parse(result);
  }

  async undoAnswer() {
    const result = await this.pyodide.runPythonAsync(`
  undo_answer()`);
    return JSON.parse(result);
  }
}
