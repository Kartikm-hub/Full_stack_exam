import { ApiError } from "../lib/http-error.js";

export function requireRole(...allowedRoles) {
  return function authorizeRole(req, _res, next) {
    if (!req.user) {
      return next(
        new ApiError(401, "UNAUTHORIZED", "Authentication required")
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          "FORBIDDEN",
          "You do not have permission to access this resource"
        )
      );
    }

    return next();
  };
}