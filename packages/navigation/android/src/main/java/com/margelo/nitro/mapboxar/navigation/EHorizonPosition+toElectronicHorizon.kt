package com.margelo.nitro.mapboxar.navigation

import com.mapbox.navigation.base.trip.model.eh.EHorizonEdge
import com.mapbox.navigation.base.trip.model.eh.EHorizonPosition
import com.mapbox.navigation.core.trip.session.eh.GraphAccessor

/**
 * The horizon in the core `ElectronicHorizonSnapshot` shape: the start edge,
 * then its `out` edges depth first, with shapes from
 * `GraphAccessor.getEdgeShape`. Edge ids are unsigned 64-bit values, so they
 * are formatted with `toULong()`.
 */
internal fun EHorizonPosition.toElectronicHorizon(graph: GraphAccessor): ElectronicHorizon {
  val edges = mutableListOf<ElectronicHorizonEdge>()
  val pending = ArrayDeque<EHorizonEdge>().apply { add(eHorizon.start) }
  while (pending.isNotEmpty()) {
    val edge = pending.removeLast()
    edges += ElectronicHorizonEdge(
      id = edge.id.toULong().toString(),
      level = edge.level.toDouble(),
      probability = edge.probability,
      shape = graph.getEdgeShape(edge.id)?.map { it.toGeographicCoordinate() }?.toTypedArray(),
    )
    edge.out.asReversed().forEach { pending.addLast(it) }
  }
  return ElectronicHorizon(
    edgeId = eHorizonGraphPosition.edgeId.toULong().toString(),
    percentAlong = eHorizonGraphPosition.percentAlong,
    edges = edges.toTypedArray(),
  )
}
