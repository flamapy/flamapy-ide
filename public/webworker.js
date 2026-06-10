/* eslint-disable no-undef */
importScripts("flamapy/flamapy.js");
async function loadFlamapyWorker() {
  self.flamapy = new Flamapy();
  await self.flamapy.loadFlamapy();
}
let flamapyReadyPromise = loadFlamapyWorker()
  .then(() => self.postMessage({ status: "loaded", pluginsConfig: self.flamapy.getPluginsConfig() }))
  .catch((exception) => self.postMessage({ status: "error", exception }));

async function handleMessage(event) {
  await flamapyReadyPromise;
  const { action, data, msgId } = event.data;
  try {
    let results;
    if (action === "validateModel") {
      results = await self.flamapy.validateModel(data);
    } else if (action === "getModelInformation") {
      results = await self.flamapy.getModelInformation();
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
}

// Messages are processed strictly one at a time: the handler is async (it
// awaits Pyodide), so without this chain two in-flight calls would interleave
// on the shared Python globals (fm, isValid, files on the Pyodide FS).
let messageQueue = Promise.resolve();

self.onmessage = (event) => {
  // The interrupt buffer must bypass the queue — its whole point is to act
  // while an operation is still running.
  if (event.data?.command === "setInterruptBuffer") {
    flamapyReadyPromise.then(() =>
      self.flamapy.setInterruptBuffer(event.data.buffer)
    );
    return;
  }
  messageQueue = messageQueue.then(() => handleMessage(event));
};
