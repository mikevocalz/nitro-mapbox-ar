# Indoor and advanced routing

This layer separates stable public routing APIs from preview-gated services.

## Public/stable core

- Isochrone API
- Matrix API
- Optimization API v1

## Capability-gated APIs

- Optimization API v2 is Public Beta.
- EV Routing remains Private Preview.

The client exposes those calls, but the SDK does not advertise them as
universally available. Host apps should only surface them when their Mapbox
account/product access supports them.

## Indoor

Mapbox outdoor routing and Search entrance points are not treated as a complete
indoor routing system.

`IndoorProvider` is intentionally provider-neutral. A host can supply a venue
graph with:

- levels;
- entrances/gates/rooms/POIs;
- stairs/elevators/escalators;
- accessible transitions;
- indoor route geometry.

`IndoorNavigationHandoff` joins an outdoor route ending at the physical
building entrance to an indoor route without corrupting either coordinate
system.
