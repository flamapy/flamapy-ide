/* eslint-disable no-undef */
importScripts("flamapy/flamapy.js");
async function loadFlamapyWorker() {
  self.flamapy = new Flamapy();
  await self.flamapy.loadFlamapy();
}
let flamapyReadyPromise = loadFlamapyWorker()
  .then(() => self.postMessage({ status: "loaded", pluginsConfig: self.flamapy.getPluginsConfig() }))
  .catch((exception) => self.postMessage({ status: "error", exception }));

self.onmessage = async (event) => {
  await flamapyReadyPromise;
  const { action, data, msgId } = event.data;
  try {
    let results;
    if (action === "validateModel") {
      results = await self.flamapy.validateModel(data);
    } else if (action === "executeFacadeOperation") {
      results = await self.flamapy.executeFacadeOperation(data);
    } else if (action === "executeFacadeOperationWithConfig") {
      results = await self.flamapy.executeFacadeOperationWithConfig(data);
    } else if (action === "downloadFile") {
      results = await self.flamapy.downloadFile(data);
    } else if (action === "importModel") {
      results = await self.flamapy.importModel(
        data.fileExtension,
        data.fileContent
      );
    } else if (action === "getFeatureTree") {
      results = await self.flamapy.getfeatureTree();
    } else if (action === "getFeatures") {
      results = await self.flamapy.getFeatures();
    } else if (action === "getNumericalAttributes") {
      const raw = await self.flamapy.getNumericalAttributes();
      results = JSON.parse(JSON.stringify(raw));
    } else if (action === "getConfigurationDistribution") {
      const proxy = await self.flamapy.getConfigurationDistribution();
      results = proxy.toJs({ dict_converter: Object.fromEntries });
      if (proxy.destroy) proxy.destroy();
    } else if (action === "getFeatureInclusionProbabilities") {
      const proxy = await self.flamapy.getFeatureInclusionProbabilities();
      results = proxy.toJs({ dict_converter: Object.fromEntries });
      if (proxy.destroy) proxy.destroy();
    } else if (action === "getFeatureFlowMap") {
      const proxy = await self.flamapy.getFeatureFlowMap(data);
      results = proxy.toJs({ dict_converter: Object.fromEntries });
      if (proxy.destroy) proxy.destroy();
    } else if (action === "executeAttributeOptimization") {
      const response = await self.flamapy.executeAttributeOptimization(data);
      results = JSON.parse(JSON.stringify(response));
    } else if (action === "startConfigurator") {
      results = await self.flamapy.startConfigurator();
    } else if (action === "answerQuestion") {
      results = await self.flamapy.answerQuestion(data);
    } else if (action === "undoAnswer") {
      results = await self.flamapy.undoAnswer();
    }

    self.postMessage({ results, action, msgId });
  } catch (error) {
    console.error(error);
    self.postMessage({ error: error.message, action, msgId });
  }
};
