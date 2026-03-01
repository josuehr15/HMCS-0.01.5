/**
 * Role-based access control middleware.
 * @param  {...string} allowedRoles - Roles that can access the route (e.g., 'admin', 'contractor', 'client').
 * @returns {Function} Express middleware function.
 */
const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.',
            });
        }

        next();
    };
};

module.exports = checkRole;
