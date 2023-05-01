import { isGreaterThan } from "@foxglove/rostime";
import { PanelExtensionContext, RenderState, Topic, MessageEvent } from "@foxglove/studio";
import Plotly from "plotly.js";
import { useLayoutEffect, useEffect, useState, useMemo } from "react";
import ReactDOM from "react-dom";
import Plot from "react-plotly.js";

import { DARK_TEMPLATE } from "./templates";

type StringMessage = { data: string };

const VALID_DATATYPES = new Set(["std_msgs/String", "std_msgs.String"]);

function PlotlyPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  // Create state variables
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");
  const [topics, setTopics] = useState<readonly Topic[] | undefined>();
  const [topicName, setTopicName] = useState<string | undefined>(getInitialTopic(context));
  const [messages, setMessages] = useState<readonly MessageEvent<StringMessage>[] | undefined>();
  const [latestMessage, setLatestMessage] = useState<MessageEvent<StringMessage> | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  // Set the panel title and onRender handler to watch for changes to the topic list and messages
  // from subscribed topics
  useLayoutEffect(() => {
    // Set the default panel title
    context.setDefaultPanelTitle("Plotly");

    // Every `renderState.*` field we want to observe needs to be watched here
    context.watch("colorScheme");
    context.watch("currentFrame");
    context.watch("topics");

    context.onRender = (renderState: RenderState, done) => {
      setRenderDone(() => done);
      setColorScheme(renderState.colorScheme ?? "light");
      setTopics(renderState.topics);
      setMessages(renderState.currentFrame as readonly MessageEvent<StringMessage>[] | undefined);
    };
  }, [context]);

  // Create a list of valid topic names that can be subscribed to
  const validTopicNames = useMemo(() => {
    if (!topics) {
      return [];
    }
    // Create a list of valid topic names that can be subscribed to
    const output = topics.filter((t) => VALID_DATATYPES.has(t.schemaName)).map((t) => t.name);
    // If a topic name is filled in that doesn't appear in the list, force add it to the top
    // so the setting is not lost
    if (topicName && !output.includes(topicName)) {
      output.unshift(topicName);
    }
    return output;
  }, [topics, topicName]);

  // Update the panel settings editor with the list of valid topic names and the current topic
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: (action) => {
        // This action handler callback is called when the user interacts with the panel settings.
        // We only care about settings field updates, so ignore all other actions
        const path = action.payload.path.join(".");
        if (action.action !== "update") {
          return;
        }

        if (path === "data.topic") {
          const topic = typeof action.payload.value === "string" ? action.payload.value : undefined;
          setTopicName(topic);
        }
      },
      nodes: {
        data: {
          label: "Data",
          fields: {
            topic: {
              input: "autocomplete",
              label: "Topic (JSON)",
              items: validTopicNames,
              value: topicName,
              error: errorMessage,
            },
          },
        },
      },
    });
  }, [context, validTopicNames, topicName, errorMessage]);

  // Update saved state when the topic name changes
  useEffect(() => context.saveState({ data: { topic: topicName } }), [context, topicName]);

  // Update saved state and subscriptions when the topic name changes
  useEffect(() => {
    const subscriptions: string[] = [];
    if (topicName && topics?.find((t) => t.name === topicName)) {
      subscriptions.push(topicName);
    }
    console.debug(`[Plotly] Subscribing to topics [${subscriptions.join(", ")}]`);
    context.subscribe(subscriptions);
  }, [context, topicName, topics]);

  // Update the most recent message from the subscribed topic
  useEffect(() => {
    // If no topic is selected, clear the latest message
    if (topicName == undefined) {
      setLatestMessage(undefined);
      return;
    }

    // If no messages are available in the most recent frame, do no thing
    if (!messages || messages.length === 0) {
      return;
    }

    // If the last message in the current frame is more recent than the previous latest message,
    // update the latest message
    const curLatest = messages[messages.length - 1]!;
    if (!latestMessage || isGreaterThan(curLatest.receiveTime, latestMessage.receiveTime)) {
      setLatestMessage(messages[messages.length - 1]);
    }
  }, [messages, latestMessage, topicName]);

  // Convert the most recent message from the subscribed topic to an array of Plotly.Data objects
  const plotData = useMemo<Plotly.Data[]>(() => {
    if (!latestMessage) {
      return [];
    }

    try {
      // Attempt to parse the message data as JSON
      const json = JSON.parse(latestMessage.message.data) as unknown;

      // Sanity check the JSON is an array
      if (!Array.isArray(json)) {
        const msg = `JSON is not an array`;
        console.error(`[Plotly] ${msg}`);
        setErrorMessage(msg);
        return [];
      }

      // Clear any previous error message and blindly cast the JSON to an array of Plotly.Data
      setErrorMessage(undefined);
      return json as Plotly.Data[];
    } catch (err) {
      // If the JSON parse fails, log the error and set the error message
      const msg = `Failed to parse JSON: ${(err as Error).message}`;
      console.error(`[Plotly] ${msg}`);
      setErrorMessage(msg);
      return [];
    }
  }, [latestMessage]);

  // Update the plot layout when the color scheme or panel title change
  const plotLayout = useMemo<Partial<Plotly.Layout>>(() => {
    return {
      autosize: true,
      template: colorScheme === "dark" ? DARK_TEMPLATE : undefined,
    };
  }, [colorScheme]);

  // Invoke the done callback once the render is complete
  useEffect(() => renderDone?.(), [renderDone]);

  return (
    <Plot
      data={plotData}
      layout={plotLayout}
      useResizeHandler={true}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

function getInitialTopic(context: PanelExtensionContext): string | undefined {
  const initialState = context.initialState as { data?: { topic?: unknown } } | undefined;
  const initialStateTopic = initialState?.data?.topic;
  return typeof initialStateTopic === "string" ? initialStateTopic : undefined;
}

export function initPanel(context: PanelExtensionContext): () => void {
  ReactDOM.render(<PlotlyPanel context={context} />, context.panelElement);

  // Return a function to run when the panel is removed
  return () => {
    ReactDOM.unmountComponentAtNode(context.panelElement);
  };
}
