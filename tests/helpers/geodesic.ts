// Independent WGS84 references for the ENU tests. Vincenty's inverse formula
// gives the ellipsoidal distance and initial bearing without going through
// ECEF, so it checks the projector by a second route.

const A = 6378137
const F = 1 / 298.257223563
const B = A * (1 - F)

const toRad = (deg: number): number => (deg * Math.PI) / 180

export interface Geodesic {
  readonly distanceM: number
  readonly initialBearingDeg: number
}

export function vincentyInverse(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): Geodesic {
  const L = toRad(lon2 - lon1)
  const U1 = Math.atan((1 - F) * Math.tan(toRad(lat1)))
  const U2 = Math.atan((1 - F) * Math.tan(toRad(lat2)))
  const sinU1 = Math.sin(U1)
  const cosU1 = Math.cos(U1)
  const sinU2 = Math.sin(U2)
  const cosU2 = Math.cos(U2)

  let lambda = L
  let sinSigma = 0
  let cosSigma = 0
  let sigma = 0
  let cos2Alpha = 0
  let cos2SigmaM = 0

  for (let i = 0; i < 200; i += 1) {
    const sinLambda = Math.sin(lambda)
    const cosLambda = Math.cos(lambda)
    sinSigma = Math.hypot(
      cosU2 * sinLambda,
      cosU1 * sinU2 - sinU1 * cosU2 * cosLambda,
    )
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda
    sigma = Math.atan2(sinSigma, cosSigma)
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma
    cos2Alpha = 1 - sinAlpha * sinAlpha
    cos2SigmaM = cosSigma - (2 * sinU1 * sinU2) / cos2Alpha
    const C = (F / 16) * cos2Alpha * (4 + F * (4 - 3 * cos2Alpha))
    const previous = lambda
    lambda =
      L +
      (1 - C) *
        F *
        sinAlpha *
        (sigma +
          C *
            sinSigma *
            (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)))
    if (Math.abs(lambda - previous) < 1e-12) {
      break
    }
  }

  const u2 = (cos2Alpha * (A * A - B * B)) / (B * B)
  const bigA = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
  const bigB = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
  const deltaSigma =
    bigB *
    sinSigma *
    (cos2SigmaM +
      (bigB / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          (bigB / 6) *
            cos2SigmaM *
            (-3 + 4 * sinSigma * sinSigma) *
            (-3 + 4 * cos2SigmaM * cos2SigmaM)))

  const azimuth = Math.atan2(
    cosU2 * Math.sin(lambda),
    cosU1 * sinU2 - sinU1 * cosU2 * Math.cos(lambda),
  )

  return {
    distanceM: B * bigA * (sigma - deltaSigma),
    initialBearingDeg: ((azimuth * 180) / Math.PI + 360) % 360,
  }
}

/**
 * Spherical Web Mercator distance, the formula behind Viro 3.0.2
 * `gpsToArWorld`. Kept here only to pin the size of the error being fixed.
 */
export function webMercatorDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const project = (lat: number, lon: number): [number, number] => [
    A * toRad(lon),
    A * Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2)),
  ]
  const [x1, y1] = project(lat1, lon1)
  const [x2, y2] = project(lat2, lon2)
  return Math.hypot(x2 - x1, y2 - y1)
}
