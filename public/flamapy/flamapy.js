/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
importScripts("/pyodide/pyodide.js");

class Flamapy {
  constructor() {
    this.pyodide = null;
    this.isValid = false;
    this.pluginsConfig = null;
  }

  async loadFlamapy() {
    const [pythonFile, configResponse] = await Promise.all([
      fetch("/flamapy/flamapy_ide.py"),
      fetch("/flamapy/plugins.conf.json"),
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
        `execute_pysat_operation('${action.value}')`
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
      return await this.pyodide.runPythonAsync(
        `execute_export_transformation('${action.value}')`
      );
    }
  }

  async importModel(fileExtension, fileContent) {
    this.pyodide.globals.set("file_content", fileContent);
    return await this.pyodide.runPythonAsync(
      `execute_import_transformation('${fileExtension}', file_content)`
    );
  }

  async getfeatureTree() {
    const jsonResult = await this.pyodide.runPythonAsync(
      `json.dumps(feature_tree(fm.fm_model.root))`
    );
    return JSON.parse(jsonResult);
  }

  async getFeatures() {
    return await this.pyodide.runPythonAsync(`get_features()`);
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

  async executeActionWithConf(data) {
    if (this.isValid) {
      this.pyodide.globals.set("configuration", data.configuration);
      const result = await this.pyodide.runPythonAsync(
        `execute_configurator_operation('${data.action.value}', configuration.to_py())`
      );
      if (result.toJs) {
        return { label: data.action.label, result: result.toJs() };
      } else {
        return { label: data.action.label, result };
      }
    }
  }

  async executeAttributeOptimization(data) {
    if (this.isValid) {
      const result = await this.pyodide.runPythonAsync(
        `execute_attribute_optimization(${JSON.stringify(data)})`
      );
      const goals = data.map((item) => `${item.goal} ${item.attribute}`).join(", ");
      if (result.toJs) {
        return { label: `Optimum Configurations (Goals: ${goals})`, result: result.toJs() };
      } else {
        return { label: `Optimum Configurations (Goals: ${goals})`, result };
      }
    }
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
