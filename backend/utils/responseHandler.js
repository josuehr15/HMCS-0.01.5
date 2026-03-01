/**
 * Send a standardized success response.
 * @param {object} res - Express response object.
 * @param {object|array} data - Response data payload.
 * @param {string} message - Success message.
 * @param {number} statusCode - HTTP status code (default: 200).
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

/**
 * Send a standardized error response.
 * @param {object} res - Express response object.
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code (default: 500).
 * @param {object|array|null} errors - Optional detailed error info.
 */
const errorResponse = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
    const response = {
        success: false,
        message,
    };

    if (errors) {
        response.errors = errors;
    }

    return res.status(statusCode).json(response);
};

module.exports = { successResponse, errorResponse };
