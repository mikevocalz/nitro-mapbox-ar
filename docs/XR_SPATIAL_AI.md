# XR and spatial-AI continuity

The ReactVision adapter reads spatial capabilities from the running host
instead of deriving them from a platform name. `getSpatialHostCapabilities()`
asks a `SpatialHostProbe` and returns `SpatialHostCapabilities`:

| Field | Probe source (Viro 3.0.3, `node_modules/@reactvision/react-viro/dist/`) |
| --- | --- |
| `isImmersive` | `isQuest` (`components/Utilities/ViroPlatform.d.ts:7`), `isVisionOS()` (`components/VisionOS/ViroVisionOSModule.d.ts:57`) |
| `supportsGaze` | same head-mounted check; Viro has no gaze query |
| `supportsGeospatialAnchors`, `supportsVps` | `arSceneNavigator.isGeospatialModeSupported()` (`components/AR/ViroARSceneNavigator.d.ts:780`), and only when `hasDeviceLocation` is `true` |
| `supportsColocation` | `isColocationAvailable()` (`components/AR/ViroColocation.d.ts:63`) |
| `supportsPassthrough` | `VRModuleOpenXR.setPassthroughEnabled` (`components/Utilities/VRModuleOpenXR.d.ts:34`) or `isARSupportedOnDevice()` (`components/Utilities/ViroUtils.d.ts:95`) |
| `supportsReplicatedState` | a JS `WebSocket`, which `ViroReplicationClient` opens (`components/AR/ViroReplication.d.ts:14`, `:97`) |
| `hasDeviceLocation` | supplied by the app; Viro has no location-hardware query |
| `isGraphiteAvailable` | supplied by the app, usually `isGraphiteWebGPUAvailable()` from `src/rendering/graphite.ts`; Viro does not render through Graphite |

## Co-location

ReactVision shares frames only within a family: phone with phone, Quest with
Quest, visionOS with visionOS. Viro ships one frame source per family
(`cloudAnchorFrameSource`, `metaSpatialAnchorFrameSource`,
`visionOSSharedSpaceFrameSource`) and none that bridges two.

`ColocationPeer.platform` is a string, because a peer can run a different
platform from this device. `canShareColocationFrame(a, b)` applies the family
rule; web peers never align, and a platform the adapter does not know aligns
only with peers reporting the same string. This is the only place the adapter
switches on a platform.

## Spatial context for agents

`SpatialContextSnapshot` can carry camera location, heading, a head ray and
its hit target, visible anchors, the co-located peer count and application
metadata. `createSpatialContextSnapshot(host, input)` drops the head ray unless
`supportsGaze` and the peer count unless `supportsColocation`, instead of
passing through values the host cannot produce.

## Graphite on visionOS

Viro renders immersive scenes on visionOS through its own Metal renderer.
Skia 2.14.0 does not build for visionOS, so the app reports
`isGraphiteAvailable: false` there and `selectRendererBackend('auto', ...)`
resolves to `webgpu` when callers fill `graphite` and `sharedDawnDevice` from
that field. No platform check is involved; `tests/reactvision-xr.test.ts`
asserts the selection from injected capabilities.
