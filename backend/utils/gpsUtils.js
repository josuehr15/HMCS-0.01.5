/**
 * GPS utility functions for distance calculation and radius validation.
 * Uses the Haversine formula for accuracy on Earth's surface.
 */

const EARTH_RADIUS_METERS = 6371000; // Earth's radius in meters

/**
 * Convert degrees to radians.
 * @param {number} degrees
 * @returns {number} Radians.
 */
const toRadians = (degrees) => {
    return (degrees * Math.PI) / 180;
};

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1.
 * @param {number} lng1 - Longitude of point 1.
 * @param {number} lat2 - Latitude of point 2.
 * @param {number} lng2 - Longitude of point 2.
 * @returns {number} Distance in meters.
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_METERS * c;
};

/**
 * Check if a worker's GPS position is within the project's allowed radius.
 * @param {number} workerLat - Worker's latitude.
 * @param {number} workerLng - Worker's longitude.
 * @param {number} projectLat - Project's latitude.
 * @param {number} projectLng - Project's longitude.
 * @param {number} radiusMeters - Allowed radius in meters.
 * @returns {boolean} True if within radius.
 */
const isWithinRadius = (workerLat, workerLng, projectLat, projectLng, radiusMeters) => {
    const distance = calculateDistance(workerLat, workerLng, projectLat, projectLng);
    return distance <= radiusMeters;
};

module.exports = { calculateDistance, isWithinRadius };
