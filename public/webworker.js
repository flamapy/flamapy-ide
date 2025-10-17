/* eslint-disable no-undef */
importScripts("/flamapy/flamapy.js");
async function loadFlamapyWorker() {
  self.flamapy = new Flamapy();
  await self.flamapy.loadFlamapy();
}
let flamapyReadyPromise = loadFlamapyWorker()
  .then(() => self.postMessage({ status: "loaded" }))
  .catch((exception) => self.postMessage({ status: "error", exception }));

self.onmessage = async (event) => {
  await flamapyReadyPromise;
  const { action, data, ...context } = event.data;
  for (const key of Object.keys(context)) {
    self[key] = context[key];
  }
  try {
    let results;
    if (action === "validateModel") {
      results = await self.flamapy.validateModel(data);
    } else if (action === "executeAction") {
      results = await self.flamapy.executeAction(data);
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
      results = await self.flamapy.getNumericalAttributes();
      // 2. 🟢 PASO CLAVE: Convertir el objeto complejo a una cadena JSON
      const json_string = JSON.stringify(results);
      // 3. 🟢 PASO CLAVE: Convertir la cadena JSON a un objeto simple de JavaScript
      const clean_js_object = JSON.parse(json_string);
      results = clean_js_object;
    } else if (action === "executeActionWithConf") {
      results = await self.flamapy.executeActionWithConf(data);
    } else if (action === "executeAttributeOptimization") {
      results = await self.flamapy.executeAttributeOptimization(data);
    } else if (action === "startConfigurator") {
      results = await self.flamapy.startConfigurator();
    } else if (action === "answerQuestion") {
      results = await self.flamapy.answerQuestion(data);
    } else if (action === "undoAnswer") {
      results = await self.flamapy.undoAnswer();
    }

    self.postMessage({ results, action });
  } catch (error) {
    console.error(error);
    self.postMessage({ error: error.message, action });
  }
};
