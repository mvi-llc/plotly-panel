import { ExtensionContext } from "@foxglove/studio";

import { initPanel } from "./PlotlyPanel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "plotly", initPanel });
}
