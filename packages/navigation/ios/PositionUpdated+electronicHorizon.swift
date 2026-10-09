import MapboxNavigationCore

extension EHorizonStatus.Events.PositionUpdated {
  /// The horizon in the core `ElectronicHorizonSnapshot` shape: the starting
  /// edge, then its `outletEdges` depth first, with shapes from
  /// `RoadGraph.edgeShape(edgeIdentifier:)`.
  func electronicHorizon(roadGraph: RoadGraph) -> ElectronicHorizon {
    var edges: [ElectronicHorizonEdge] = []
    var pending: [RoadGraph.Edge] = [startingEdge]
    while let edge = pending.popLast() {
      edges.append(
        ElectronicHorizonEdge(
          id: String(edge.identifier),
          level: Double(edge.level),
          probability: edge.probability,
          shape: roadGraph.edgeShape(edgeIdentifier: edge.identifier)?.coordinates.map(\.geographicCoordinate)
        )
      )
      pending.append(contentsOf: edge.outletEdges.reversed())
    }
    return ElectronicHorizon(
      edgeId: String(position.edgeIdentifier),
      percentAlong: position.fractionFromStart,
      edges: edges
    )
  }
}
