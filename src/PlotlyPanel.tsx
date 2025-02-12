import { PanelExtensionContext, RenderState, Topic, MessageEvent } from "@foxglove/studio";
import Plotly from "plotly.js";
import { useLayoutEffect, useEffect, useState, useMemo } from "react";
import ReactDOM from "react-dom";
import Plot from "react-plotly.js";

import {
  PlotlyPlot,
  PlotlyPlotParsed,
  ParsePlotlyMessage,
  PlotlyPlotSchemaNames,
} from "./messages";
import { DARK_TEMPLATE } from "./templates";

function PlotlyPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  // Create state variables
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");
  const [topics, setTopics] = useState<readonly Topic[] | undefined>();
  const [topicName, setTopicName] = useState<string | undefined>(getInitialTopic(context));
  const [messages, setMessages] = useState<readonly MessageEvent<PlotlyPlot>[] | undefined>();
  const [latestMessage, setLatestMessage] = useState<MessageEvent<PlotlyPlot> | undefined>();
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
      setMessages(renderState.currentFrame as readonly MessageEvent<PlotlyPlot>[] | undefined);
    };
  }, [context]);

  // Create a list of valid topic names that can be subscribed to
  const validTopicNames = useMemo(() => {
    if (!topics) {
      return [];
    }
    // Create a list of valid topic names that can be subscribed to
    const output = topics.filter((t) => PlotlyPlotSchemaNames.has(t.schemaName)).map((t) => t.name);
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
              label: "Topic",
              help: "A `plotly.Plot` message topic to subscribe to",
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
    } else {
      // Set the latest message to the current message
      setLatestMessage(messages[messages.length - 1]);
    }
  }, [messages, latestMessage, topicName]);

  // Convert the most recent message from the subscribed topic to an array of Plotly.Data objects
  const plotMessage = useMemo<PlotlyPlotParsed | undefined>(() => {
    if (!latestMessage) {
      return undefined;
    }

    try {
      // Attempt to parse the message data as JSON
      const parsed = ParsePlotlyMessage(latestMessage.message);

      // Parsing succeeded, clear any previous error message
      setErrorMessage(undefined);

      return parsed;
    } catch (err) {
      // The JSON parse failed, log the error and set the error message
      const msg = `Failed to parse: ${(err as Error).message}`;
      console.error(`[Plotly] ${msg}`);
      setErrorMessage(msg);
      return undefined;
    }
  }, [latestMessage]);

  // Extract the Plotly.Data[] array from the parsed message
  const data = useMemo<Plotly.Data[]>(() => plotMessage?.data ?? [], [plotMessage]);

  // Extract the Plotly.Layout object from the parsed message, overriding the autosize and template
  // fields to support auto-resize and dark mode
  const layout = useMemo<Partial<Plotly.Layout>>(() => {
    const output: Partial<Plotly.Layout> = plotMessage?.layout ?? {};
    output.autosize = true;
    output.template = colorScheme === "dark" ? DARK_TEMPLATE : undefined;
    return output;
  }, [colorScheme, plotMessage]);

  // Invoke the done callback once the render is complete
  useEffect(() => renderDone?.(), [renderDone]);

  return (
    <Plot
      data={data}
      layout={layout}
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
