# TraceSift performance workflow

TraceSift is the first-pass analyzer for React, Hermes, and JavaScript CPU performance in Nitro Mapbox AR.

## Setup

Requires macOS or Linux and Node.js 22.19 or newer.

```sh
npm run perf:tracesift:init
npm run perf:tracesift
```

## Profile these scenarios

Keep viewport, route/data set, device, and build mode fixed:

- map pan/zoom/rotate event pressure;
- camera and region update handling;
- terrain/AR overlay updates;
- WebGPU/TypeGPU scene synchronization;
- ReactVision/Viro overlay changes;
- native-map event fan-out into JS;
- marker/annotation or spatial-object bursts;
- mount/unmount and route transitions around map views.

Use a React Profiler export for render/commit problems and a Hermes/JavaScript CPU profile for JS execution bottlenecks.

TraceSift does not replace GPU or native profiling. If a finding points into Mapbox native code, Nitro/JSI, WebGPU, Metal/Vulkan, or ViroCore, continue with the appropriate native/GPU profiler.

Do not commit raw captures by default. Put the reproduction, TraceSift finding, and before/after measurement in the PR.
