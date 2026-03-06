/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import CustomButton from "./CustomButton";
import Question from "./Question";
import Information from "./Information";
import Configuration from "./Configuration";

function Wizzard({ call, setHistory }) {
  const cancelURL = import.meta.env?.VITE_CANCEL_CONFIGURATION_URL;
  const applyURL = import.meta.env?.VITE_APPLY_CONFIGURATION_URL;

  const [isImported, setIsImported] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState([]);
  const [message, setMessage] = useState({
    type: "info",
    msg: `Preparing configurator for the model`,
  });
  const [configuration, setConfiguration] = useState(null);

  useEffect(() => {
    call("startConfigurator").then((result) => {
      setMessage(null);
      setCurrentQuestion(result);
      setHistory(result.history);
      setIsImported(true);
    });
    return () => setHistory(null);
  // call is stable (useCallback), so this runs once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function answerQuestion() {
    if (!isImported) return;
    const results = await call("answerQuestion", selectedAnswer);
    if (results.valid) {
      if (results.configuration) {
        setConfiguration(results.configuration);
        setMessage({ type: "success", msg: "Configuration finished successfully" });
        setCurrentQuestion(null);
      } else {
        setCurrentQuestion(results.nextQuestion);
        setMessage(null);
      }
      setHistory(results.history);
    } else {
      setMessage({ type: "error", msg: results.contradiction.msg });
    }
    setSelectedAnswer([]);
  }

  async function undoAnswer() {
    if (!isImported) return;
    const results = await call("undoAnswer");
    setCurrentQuestion(results);
    if (configuration) setConfiguration(null);
    setSelectedAnswer([]);
    setMessage(null);
    setHistory(results.history);
  }

  function downloadConfiguration() {
    if (!configuration) {
      setMessage({ type: "error", msg: "No configuration available to download." });
      return;
    }
    const jsonData = JSON.stringify(configuration, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "configuration.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function nextQuestion() {
    if (isImported && currentQuestion) {
      await answerQuestion();
    } else {
      downloadConfiguration();
    }
  }

  async function previousQuestion() {
    if (isImported) {
      await undoAnswer();
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Main content area */}
      <div className="bg-neutral-300 dark:bg-gray-700 flex flex-col flex-grow rounded-2xl m-2 p-4 overflow-auto">
        {message && <Information type={message.type} msg={message.msg} />}
        {currentQuestion && (
          <Question
            title={currentQuestion.currentQuestion}
            options={currentQuestion.possibleOptions}
            questionType={currentQuestion.currentQuestionType}
            selected={selectedAnswer}
            onUpdate={setSelectedAnswer}
          />
        )}
        {configuration && <Configuration configuration={configuration} />}
      </div>

      {/* Footer with buttons */}
      <div className="flex justify-between p-4">
        <div>
          <CustomButton active={isImported} onClick={previousQuestion}>
            Previous
          </CustomButton>
          <CustomButton active={isImported} onClick={nextQuestion}>
            {configuration
              ? applyURL
                ? "Apply configuration"
                : "Download configuration"
              : "Next"}
          </CustomButton>
        </div>
      </div>
    </div>
  );
}

export default Wizzard;
