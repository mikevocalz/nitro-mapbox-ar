# Search, Places and entrance-aware AR anchors

The modern search layer uses Mapbox Search Box API for interactive and one-shot
place search.

- autocomplete uses `/suggest` with an explicit session token;
- selecting a suggestion uses `/retrieve` with the same session token;
- rich POI retrieval can request the `photos`, `visit`, and `venue`
  attribute sets;
- address geocoding uses Geocoding v6 when building entrance geometry is
  needed.

`getSpatialSearchAnchor()` prefers a physical `entrance` routable point,
then the default vehicle-oriented routable point, then the feature coordinate.
That keeps AR markers and handoff-to-walking guidance attached to the actual
access point when Mapbox has entrance data.

Search Box and temporary Geocoding results are treated as transient provider
data. This SDK does not silently persist them.
