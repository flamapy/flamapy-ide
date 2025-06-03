/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import CustomButton from "./CustomButton";
import Question from "./Question";
import Information from "./Information";
import Configuration from "./Configuration";

function Wizzard({ worker, setHistory }) {
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
    worker.postMessage({
      action: "startConfigurator",
      data: null,
    });

    worker.onmessage = async (event) => {
      if (event.data.results !== undefined) {
        setMessage(null);
        setCurrentQuestion(event.data.results);
        setHistory(event.data.results.history);
        setIsImported(true);
      }
    };

    return () => setHistory(null)
  }, [worker]);

  async function answerQuestion() {
    if (isImported) {
      worker.postMessage({ action: "answerQuestion", data: selectedAnswer });

      worker.onmessage = async (event) => {
        if (event.data.results !== undefined) {
          const results = event.data.results;
          if (results.valid) {
            if (results.configuration) {
              setConfiguration(results.configuration);
              setMessage({
                type: "success",
                msg: "Configuration finished successfully",
              });
              setCurrentQuestion(null);
            } else {
              setCurrentQuestion(event.data.results.nextQuestion);
              setMessage(null);
            }
            setHistory(event.data.results.history);
          } else {
            setMessage({ type: "error", msg: results.contradiction.msg });
          }
          setSelectedAnswer([]);
        }
      };
    }
  }

  async function undoAnswer() {
    if (isImported) {
      worker.postMessage({ action: "undoAnswer" });

      worker.onmessage = async (event) => {
        const results = event.data.results;
        setCurrentQuestion(results);
        if (configuration) setConfiguration(null);
        setSelectedAnswer([]);
        setMessage(null)
        setHistory(event.data.results.history);
      };
    }
  }

  function downloadConfiguration() {
    if (!configuration) {
      setMessage({
        type: "error",
        msg: "No configuration available to download.",
      });
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

  async function restartConfigurator() {
    return true;
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Main content area */}
      <div className="bg-neutral-300 flex flex-col flex-grow rounded-2xl m-2 p-4 overflow-auto">
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
          <CustomButton
            active={isImported}
            onClick={() => {
              previousQuestion();
            }}
          >
            Previous
          </CustomButton>
          <CustomButton
            active={isImported}
            onClick={() => {
              nextQuestion();
            }}
          >
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
