/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
importScripts("pyodide/pyodide.js");

class Flamapy {
  constructor() {
    this.pyodide = null;
    this.isValid = false;
    this.pluginsConfig = null;
  }

  async loadFlamapy() {
    const [pythonFile, configResponse] = await Promise.all([
      fetch("flamapy/flamapy_ide.py"),
      fetch("flamapy/plugins.conf.json"),
    ]);
    this.pluginsConfig = await configResponse.json();

    const pyodideInstance = await loadPyodide({ indexURL: "pyodide" });
    await pyodideInstance.loadPackage("micropip");

    // Load pyodide_packages declared by enabled plugins (e.g. python-sat)
    const pyodidePackages = [];
    for (const [, plugin] of Object.entries(this.pluginsConfig.plugins)) {
      if (plugin.enabled && plugin.pyodide_packages) {
        pyodidePackages.push(...plugin.pyodide_packages);
      }
    }
    if (pyodidePackages.length > 0) {
      await pyodideInstance.loadPackage(pyodidePackages);
    }

    // Build the micropip install list: core wheels + enabled plugin wheels
    const allWheels = [...this.pluginsConfig.core.wheels];
    for (const [, plugin] of Object.entries(this.pluginsConfig.plugins)) {
      if (plugin.enabled) {
        allWheels.push(...plugin.wheels);
      }
    }

    const installStatements = allWheels
      .map((w) => `await micropip.install("flamapy/${w}", deps=False)`)
      .join("\n");

    await pyodideInstance.runPythonAsync(`
import micropip
${installStatements}
`);

    await pyodideInstance.runPythonAsync(await pythonFile.text());
    pyodideInstance.FS.mkdir("export");

    this.pyodide = pyodideInstance;
  }

  getPluginsConfig() {
    return this.pluginsConfig;
  }

  // Lets the main thread interrupt a running Python operation (SIGINT) via a
  // SharedArrayBuffer; only available when the page is cross-origin isolated.
  setInterruptBuffer(buffer) {
    this.pyodide.setInterruptBuffer(buffer);
  }

  // All Python entry points are called with their inputs passed through
  // pyodide.globals — never interpolated into the Python source — so values
  // can't break out of (or inject into) the executed snippet.

  requireValidModel() {
    if (!this.isValid) {
      throw new Error("The model is not valid. Validate it before running operations.");
    }
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

  // Model metrics are requested separately from validation: some of them are
  // full analyses (core features, atomic sets) and must not run per keystroke.
  async getModelInformation() {
    this.requireValidModel();
    const jsonResult = await this.pyodide.runPythonAsync(
      `get_model_information_json()`
    );
    return JSON.parse(jsonResult);
  }

  async executeFacadeOperation(action) {
    this.requireValidModel();
    this.pyodide.globals.set("facade_method", action.method);
    this.pyodide.globals.set("facade_args", JSON.stringify(action.args || {}));
    const result = await this.pyodide.runPythonAsync(
      `execute_facade_operation(facade_method, facade_args)`
    );
    return { label: action.label, result };
  }

  async executeFacadeOperationWithConfig(data) {
    this.requireValidModel();
    const { action, configs } = data;
    this.pyodide.globals.set("facade_method", action.method);
    this.pyodide.globals.set("facade_args", JSON.stringify(action.args || {}));
    this.pyodide.globals.set("facade_configs", JSON.stringify(configs || {}));
    const result = await this.pyodide.runPythonAsync(
      `execute_facade_operation_with_config(facade_method, facade_configs, facade_args)`
    );
    return { label: action.label, result };
  }

  async downloadFile(action) {
    this.requireValidModel();
    this.pyodide.globals.set("export_format", action.value);
    return await this.pyodide.runPythonAsync(
      `execute_export_transformation(export_format)`
    );
  }

  async importModel(fileExtension, fileContent) {
    this.pyodide.globals.set("file_extension", fileExtension);
    this.pyodide.globals.set("file_content", fileContent);
    return await this.pyodide.runPythonAsync(
      `execute_import_transformation(file_extension, file_content)`
    );
  }

  async getfeatureTree() {
    const jsonResult = await this.pyodide.runPythonAsync(
      `json.dumps(feature_tree(fm.fm_model.root))`
    );
    return JSON.parse(jsonResult);
  }

  async getFeatures() {
    const result = await this.pyodide.runPythonAsync(`json.dumps(get_features())`);
    return JSON.parse(result);
  }

  async getNumericalAttributes() {
    return await this.pyodide.runPythonAsync(`get_numerical_attributes()`);
  }

  async getConfigurationDistribution() {
    return await this.pyodide.runPythonAsync(`get_configuration_distribution()`);
  }

  async getFeatureInclusionProbabilities() {
    return await this.pyodide.runPythonAsync(`get_feature_inclusion_probabilities()`);
  }

  async getFeatureFlowMap(attributeName) {
    this.pyodide.globals.set("ffm_attribute", attributeName);
    return await this.pyodide.runPythonAsync(`get_feature_flow_map(ffm_attribute)`);
  }

  async executeAttributeOptimization(data) {
    this.requireValidModel();
    this.pyodide.globals.set("attr_goals_json", JSON.stringify(data.goals));
    this.pyodide.globals.set("attr_backend", data.backend || "z3");
    const jsonResult = await this.pyodide.runPythonAsync(
      `execute_attribute_optimization(json.loads(attr_goals_json), attr_backend)`
    );
    const goals = data.goals.map((item) => `${item.goal} ${item.attribute}`).join(", ");
    const response = { label: `Optimum Configurations (Goals: ${goals})`, result: JSON.parse(jsonResult) };
    return response;
  }

  async startConfigurator() {
    const result = await this.pyodide.runPythonAsync(`start_configurator()`);
    return JSON.parse(result);
  }

  async answerQuestion(answer) {
    this.pyodide.globals.set("answer", answer);
    const result = await this.pyodide.runPythonAsync(`answer_question(answer)`);
    return JSON.parse(result);
  }

  async undoAnswer() {
    const result = await this.pyodide.runPythonAsync(`undo_answer()`);
    return JSON.parse(result);
  }
}
