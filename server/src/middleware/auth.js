import { ApiError } from "../lib/http-error.js";
import { verifyAccessToken } from "../lib/auth.js";

export function requireAuth() {
  return function authenticate(req, _res, next) {
    const authorization = req.get("authorization");

    if (!authorization) {
      return next(
        new ApiError(
          401,
          "UNAUTHORIZED",
          "Authentication required"
        )
      );
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return next(
        new ApiError(
          401,
          "UNAUTHORIZED",
          "Authentication required"
        )
      );
    }

    try {
      const payload = verifyAccessToken(token);

      req.user = {
        id: payload.sub,
        role: payload.role,
      };

      return next();
    } catch {
      return next(
        new ApiError(
          401,
          "UNAUTHORIZED",
          "Invalid or expired authentication token"
        )
      );
    }
  };
}