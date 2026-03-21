const EARTH_RADIUS_METERS = 6371000;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const originLat = toRadians(lat1);
  const destinationLat = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function findNearestService(lat, lon, services, maxDistanceMeters = 200) {
  let nearestService = null;

  for (const service of services) {
    const distance = haversineDistance(lat, lon, service.lat, service.lon);

    if (!nearestService || distance < nearestService.distanceMeters) {
      nearestService = {
        ...service,
        distanceMeters: distance,
      };
    }
  }

  if (!nearestService || nearestService.distanceMeters > maxDistanceMeters) {
    return null;
  }

  return nearestService;
}

module.exports = {
  haversineDistance,
  findNearestService,
};
