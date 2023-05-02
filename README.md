# Plotly Foxglove Studio Extension Panel

> _Plotly.js wrapper for Foxglove Studio_

![Plotly extension panel screenshot](https://github.com/MetaverseIndustries/plotly-panel/blob/main/docs/screenshot01.png?raw=true)

## Overview

The Plotly extension panel subscribes to a topic of type `plotly.Plot` (or `plotly_msgs/Plot` for
ROS systems) with the following message definition:

```
string data
string layout
```

The `data` field is a JSON string holding an array of Plot.ly traces. The `layout` field is an
optional JSON string holding the Plot.ly layout object. Both fields are described in detail on the
[Plot.ly website](https://plotly.com/chart-studio-help/json-chart-schema/).

## Develop

Run once to fetch dependencies:

```sh
yarn install
```

Build the extension and create a `.foxe` file

```sh
yarn package
```

Open `Foxglove Studio` web or desktop app and drag and drop the generated `.foxe` file into the app.

## License

Released under the MIT license &copy; [Metaverse Industries LLC](https://metaverseindustries.llc/)
