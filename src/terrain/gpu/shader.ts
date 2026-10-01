export const TERRAIN_SHADER = /* wgsl */ `
struct Frame {
  mvp: mat4x4<f32>,
  light: vec4<f32>,
  baseColor: vec4<f32>,
  params: vec4<f32>,
  skirt: vec4<f32>,
}

struct Grid {
  width: u32,
  height: u32,
  stride: u32,
  cellColumns: u32,
}

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) uv: vec2<f32>,
}

@group(0) @binding(0) var<storage, read> heights: array<f32>;
@group(0) @binding(1) var<uniform> frame: Frame;
@group(0) @binding(2) var<uniform> grid: Grid;
@group(0) @binding(3) var imageryTexture: texture_2d<f32>;
@group(0) @binding(4) var imagerySampler: sampler;

fn terrainHeight(x: u32, y: u32) -> f32 {
  return heights[y * grid.width + x] * frame.params.y;
}

fn cornerForVertex(vertexInCell: u32) -> vec2<u32> {
  switch vertexInCell {
    case 0u: { return vec2<u32>(0u, 0u); }
    case 1u: { return vec2<u32>(1u, 0u); }
    case 2u: { return vec2<u32>(0u, 1u); }
    case 3u: { return vec2<u32>(0u, 1u); }
    case 4u: { return vec2<u32>(1u, 0u); }
    default: { return vec2<u32>(1u, 1u); }
  }
}

fn makeVertex(
  x: u32,
  y: u32,
  height: f32,
  normal: vec3<f32>,
) -> VertexOut {
  let sampleSpacing = frame.params.x;
  let spanX = f32(grid.width - 1u) * sampleSpacing;
  let spanZ = f32(grid.height - 1u) * sampleSpacing;
  let local = vec3<f32>(
    f32(x) * sampleSpacing - spanX * 0.5,
    height,
    f32(y) * sampleSpacing - spanZ * 0.5,
  );

  var out: VertexOut;
  out.position = frame.mvp * vec4<f32>(local, 1.0);
  out.normal = normal;
  out.uv = vec2<f32>(
    f32(x) / f32(grid.width - 1u),
    f32(y) / f32(grid.height - 1u),
  );
  return out;
}

fn surfaceVertex(vertexIndex: u32) -> VertexOut {
  let cellIndex = vertexIndex / 6u;
  let vertexInCell = vertexIndex % 6u;
  let cellX = cellIndex % grid.cellColumns;
  let cellY = cellIndex / grid.cellColumns;
  let corner = cornerForVertex(vertexInCell);

  let x0 = cellX * grid.stride;
  let y0 = cellY * grid.stride;
  let x = min(x0 + corner.x * grid.stride, grid.width - 1u);
  let y = min(y0 + corner.y * grid.stride, grid.height - 1u);

  let leftX = select(0u, x - grid.stride, x >= grid.stride);
  let rightX = min(x + grid.stride, grid.width - 1u);
  let upY = select(0u, y - grid.stride, y >= grid.stride);
  let downY = min(y + grid.stride, grid.height - 1u);

  let h = terrainHeight(x, y);
  let hLeft = terrainHeight(leftX, y);
  let hRight = terrainHeight(rightX, y);
  let hUp = terrainHeight(x, upY);
  let hDown = terrainHeight(x, downY);

  let sampleSpacing = frame.params.x;
  let dx = max(f32(rightX - leftX) * sampleSpacing, 0.0001);
  let dz = max(f32(downY - upY) * sampleSpacing, 0.0001);

  let tangentX = vec3<f32>(dx, hRight - hLeft, 0.0);
  let tangentZ = vec3<f32>(0.0, hDown - hUp, dz);
  let normal = normalize(cross(tangentZ, tangentX));

  return makeVertex(x, y, h, normal);
}

fn skirtCorner(vertexInSegment: u32) -> vec2<u32> {
  switch vertexInSegment {
    case 0u: { return vec2<u32>(0u, 0u); }
    case 1u: { return vec2<u32>(1u, 0u); }
    case 2u: { return vec2<u32>(0u, 1u); }
    case 3u: { return vec2<u32>(0u, 1u); }
    case 4u: { return vec2<u32>(1u, 0u); }
    default: { return vec2<u32>(1u, 1u); }
  }
}

fn skirtVertex(vertexIndex: u32) -> VertexOut {
  let cellRows =
    (grid.height - 1u + grid.stride - 1u) / grid.stride;
  let segmentIndex = vertexIndex / 6u;
  let vertexInSegment = vertexIndex % 6u;

  let northEnd = grid.cellColumns;
  let eastEnd = northEnd + cellRows;
  let southEnd = eastEnd + grid.cellColumns;

  var start = vec2<u32>(0u, 0u);
  var end = vec2<u32>(0u, 0u);
  var normal = vec3<f32>(0.0, 0.0, -1.0);

  if (segmentIndex < northEnd) {
    let column = segmentIndex;
    start = vec2<u32>(column * grid.stride, 0u);
    end = vec2<u32>(
      min((column + 1u) * grid.stride, grid.width - 1u),
      0u,
    );
    normal = vec3<f32>(0.0, 0.0, -1.0);
  } else if (segmentIndex < eastEnd) {
    let row = segmentIndex - northEnd;
    start = vec2<u32>(grid.width - 1u, row * grid.stride);
    end = vec2<u32>(
      grid.width - 1u,
      min((row + 1u) * grid.stride, grid.height - 1u),
    );
    normal = vec3<f32>(1.0, 0.0, 0.0);
  } else if (segmentIndex < southEnd) {
    let column = segmentIndex - eastEnd;
    start = vec2<u32>(
      min((column + 1u) * grid.stride, grid.width - 1u),
      grid.height - 1u,
    );
    end = vec2<u32>(column * grid.stride, grid.height - 1u);
    normal = vec3<f32>(0.0, 0.0, 1.0);
  } else {
    let row = segmentIndex - southEnd;
    start = vec2<u32>(
      0u,
      min((row + 1u) * grid.stride, grid.height - 1u),
    );
    end = vec2<u32>(0u, row * grid.stride);
    normal = vec3<f32>(-1.0, 0.0, 0.0);
  }

  let corner = skirtCorner(vertexInSegment);
  let coord = select(start, end, corner.x == 1u);
  let top = terrainHeight(coord.x, coord.y);
  let height = top - f32(corner.y) * frame.skirt.x;

  return makeVertex(coord.x, coord.y, height, normal);
}

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  let cellRows =
    (grid.height - 1u + grid.stride - 1u) / grid.stride;
  let surfaceVertexCount = grid.cellColumns * cellRows * 6u;

  if (vertexIndex < surfaceVertexCount) {
    return surfaceVertex(vertexIndex);
  }

  return skirtVertex(vertexIndex - surfaceVertexCount);
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4<f32> {
  let lightDirection = normalize(frame.light.xyz);
  let lambert = max(dot(normalize(input.normal), lightDirection), 0.0);
  let ambient = clamp(frame.light.w, 0.0, 1.0);
  let shade = ambient + (1.0 - ambient) * lambert;

  let imagery = textureSample(imageryTexture, imagerySampler, input.uv);
  let imageryMix = clamp(frame.params.w, 0.0, 1.0);
  let albedo = mix(
    frame.baseColor.rgb,
    imagery.rgb * frame.baseColor.rgb,
    imageryMix,
  );

  return vec4<f32>(
    albedo * shade,
    frame.baseColor.a * clamp(frame.params.z, 0.0, 1.0),
  );
}
`
