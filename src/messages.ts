import Plotly from "plotly.js";

/**
 * The serialized message definition for a Plotly plot. Both `data` and `layout` are serialized
 * JSON strings.
 */
export type PlotlyPlot = {
  data: string;
  layout: string;
};

/**
 * The parsed message definition for a Plotly plot. `data` is an array of Plotly data objects, and
 * `layout` is a Plotly layout object.
 */
export type PlotlyPlotParsed = {
  data: Plotly.Data[];
  layout: Partial<Plotly.Layout>;
};

/**
 * Recognized schema names for a Plotly plot message.
 */
export const PlotlyPlotSchemaNames = new Set([
  "plotly_msgs/Plot",
  "plotly_msgs/msg/Plot",
  "plotly.Plot",
]);

/**
 * Parse a Plotly plot message into a `PlotParsed` object by deserializing the `data` and `layout`
 * JSON fields.
 * @param message The Plotly plot message to parse
 * @returns The parsed Plotly plot message, or throws an error if the message is invalid
 */
export function ParsePlotlyMessage(message: PlotlyPlot): PlotlyPlotParsed {
  type Layout = Partial<Plotly.Layout>;

  const data = (message.data.length > 0 ? JSON.parse(message.data) : []) as unknown;
  const layout = (message.layout.length > 0 ? JSON.parse(message.layout) : {}) as Layout;

  if (!Array.isArray(data)) {
    throw new Error("Plot data must be an array");
  }

  return { data, layout };
}
