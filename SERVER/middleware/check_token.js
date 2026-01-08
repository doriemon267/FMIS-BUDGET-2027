const jwt = require("jsonwebtoken");
const { resolveUserIdentity, getClientIp } = require("../utils/requestContext");
// Enable large/verbose debug logging when DEBUG_LOGS=true in env
const DEBUG = process.env.DEBUG_LOGS === 'true';
module.exports = async (req, res, next) => {
	try {
		// Allow CORS preflight to pass through
		if (req.method === 'OPTIONS') return next();

		// console.log(`🔐 Auth check for ${req.method} ${req.path}`);

		// DEVELOPMENT: Allow dev-only mock auth if enabled with ALLOW_MOCK_AUTH=true
		// This is only intended for local testing; still requires an X-Dev-User-Id header.
		// Allow mock auth if explicitly enabled in .env OR when DEBUG_MODE is enabled
		const allowMockAuth = process.env.ALLOW_MOCK_AUTH === 'true' || process.env.DEBUG_MODE === 'true';
		const devUserIdHeader = req.headers['x-dev-user-id'] || req.headers['X-Dev-User-Id'];
		if (allowMockAuth && devUserIdHeader) {
			// Attach a minimal dev user and continue
			const uid = String(devUserIdHeader).trim();
			// Allow specifying dev roles via header (X-Dev-Roles) to support admin access during mock mode
			const devRolesHeader = req.headers['x-dev-roles'] || req.headers['X-Dev-Roles'];
			const devRolesRaw = devRolesHeader ? String(devRolesHeader).split(',').map(r => r.trim()).filter(Boolean) : ['DEVELOPER'];
			// Normalize dev roles to match server role normalization (spaces -> underscores, uppercase, fix typos)
			const normalizeDevRole = (role) => {
				const fixed = role.replace(/\s+/g, '_').toUpperCase();
				const typoMap = {
					'BUDGET_PREPAPER': 'BUDGET_PREPARER',
					'BUDGET_PREPAPER': 'BUDGET_PREPARER',
					'BUDGET_REVEWER': 'BUDGET_REVIEWER',
					'BUDGET_APROVER': 'BUDGET_APPROVER',
					'BUDGET_PLANING_ANALYST': 'BUDGET_PLANNING_ANALYST',
					'BUDGET_PLANNING_ANALST': 'BUDGET_PLANNING_ANALYST',
					'BUDGET_OFICER': 'BUDGET_OFFICER',
					'BUDGET_MANAGER': 'OVERALL_BUDGET_APPROVER',
					'BUDGET_OVERALL_APPROVER': 'OVERALL_BUDGET_APPROVER',
					'OVERAL_BUDGET_APPROVER': 'OVERALL_BUDGET_APPROVER',
					'SUPERADMIN': 'SUPER_ADMIN',
					'SUPER ADMIN': 'SUPER_ADMIN'
				};
				return typoMap[fixed] || fixed;
			};
			const devRoles = devRolesRaw.map(normalizeDevRole);
			req.user = { id: uid, userId: uid, Id: uid, Username: [uid], Roles: devRoles, name: uid };
			if (DEBUG) console.debug(`🧪 Mock auth: dev user ${uid} with roles: ${JSON.stringify(devRoles)}`);
			// console.log(`🧪 DEV auth bypass enabled for ${req.path}, user: ${uid}, allowMockAuth=${allowMockAuth}`);
			const identity = await resolveUserIdentity({ req });
			req.identity = identity;
			return next();
		}

		// Extract token from Authorization header or auth cookie
		let jwtToken = null;
		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith('Bearer ')) {
			jwtToken = authHeader.split(' ')[1];
		} else if (req.cookies && req.cookies.authToken) {
			jwtToken = req.cookies.authToken;
		}

		if (!jwtToken) {
			console.log(`❌ No auth token for ${req.path}`);
			return res.status(403).json({ error: "Access denied." });
		}
		console.log(`🔑 Token received for ${req.path}:`, 'present');
    
		// Verify token
		const payload = jwt.verify(jwtToken, process.env.JWT_SECRET_KEY);
		if (!payload) {
			console.log(`❌ Token verification failed for ${req.path}`);
			return res.status(401).json({ error: "Access denied." });
		}
    
		console.log(`✅ Token verified for ${req.path}, user:`, payload.Username || payload.userId || 'unknown');
		console.log(`📋 JWT payload keys for ${req.path}:`, Object.keys(payload));
		console.log(`📋 ACCOUNT_USER_API_URL defined:`, !!process.env.ACCOUNT_USER_API_URL);
    
		// Debug: Log payload structure (only once per unique path to avoid spam)
		if (!global._loggedPaths) global._loggedPaths = new Set();
		// Only log payload structure when debugging to avoid performance and privacy issues
		if (DEBUG && !global._loggedPaths.has(req.path)) {
			console.debug(`🔍 JWT Payload structure for ${req.path}:`, Object.keys(payload));
			global._loggedPaths.add(req.path);
		}
		// Capture client IP early for downstream logging
		req.clientIp = getClientIp(req);
		// Extract access token (if needed)
		const accessToken = payload.accessToken;
		// Check if ACCOUNT_USER_API_URL is defined
		if (!process.env.ACCOUNT_USER_API_URL) {
			console.log(`🏠 Using DEVELOPMENT MODE for ${req.path} (no ACCOUNT_USER_API_URL)`);
			// DEVELOPMENT MODE: Extract user info from JWT payload (using actual logged-in user data)
			// Payload logging removed for cleaner output
      
			// For development mode, we'll use the actual logged in user's information
			// The JWT might not contain userId directly, so we need to handle this case
			let userId = null;
      
			// First try to extract from various JWT fields
			if (payload.Username && Array.isArray(payload.Username) && payload.Username[0]) {
				userId = payload.Username[0];
			} else if (typeof payload.Username === 'string' && payload.Username) {
				userId = payload.Username;
			} else if (payload.userId) {
				userId = payload.userId;
			} else if (payload.Id) {
				userId = String(payload.Id);
			} else if (payload.id) {
				userId = payload.id;
			} else if (payload.sub) {
				userId = payload.sub;
			} else if (payload.user_id) {
				userId = payload.user_id;
			} else if (payload.username) {
				userId = payload.username;
			}
      
			// Allow dev header to override identity in development mode
			const devUserId = req.headers['x-dev-user-id'] || req.headers['X-Dev-User-Id'];
			const hasDevHeaders = !!devUserId;
      
			if (devUserId) {
				userId = String(devUserId).trim();
			} else if (!userId) {
				// FALLBACK: Try to use accessToken to fetch user from external API
				if (payload.accessToken && process.env.ACCOUNT_USER_API_URL) {
					try {
            
						const userRes = await fetch(process.env.ACCOUNT_USER_API_URL, {
							headers: { Authorization: `Bearer ${payload.accessToken}` },
						});
						if (userRes.ok) {
							const user = await userRes.json();
							userId = user.userId || user.id || user.Username?.[0] || user.username;
							if (userId) {
								if (DEBUG) console.debug('✅ User ID retrieved from external API:', userId);
							}
						}
					} catch (apiError) {
						console.error('Failed to fetch user from external API:', apiError.message);
					}
				}
        
				// If still no user ID found, fail with guidance
				if (!userId) {
					console.error('❌ Unable to determine user identity from JWT or headers');
					console.error('JWT Payload keys:', Object.keys(payload));
					console.error('Available headers:', Object.keys(req.headers).filter(h => h.toLowerCase().includes('user') || h.toLowerCase().includes('auth')));
					return res.status(401).json({ 
						error: "Invalid token: No user identification found",
						hint: "Please logout and login again to refresh your token"
					});
				}
			}
      
			// User authenticated successfully
			// Extract roles from dev headers if available  
			const devRoles = req.headers['x-dev-roles'] || req.headers['X-Dev-Roles'];
			let userRoles = payload.roles || payload.role;
			if (devRoles) {
				userRoles = devRoles.split(',').map(r => r.trim()).filter(Boolean);
			}
      
			// Normalize roles - replace spaces with underscores for consistency
			const fixRoleTypos = (role) => {
				// Fix common typos for all budget roles
				const typoMap = {
					'BUDGET_PREPAPER': 'BUDGET_PREPARER',
					'BUDGET PREPAPER': 'BUDGET_PREPARER',
					'BUDGET_REVEWER': 'BUDGET_REVIEWER',
					'BUDGET REVEWER': 'BUDGET_REVIEWER',
					'BUDGET_APROVER': 'BUDGET_APPROVER',
					'BUDGET APROVER': 'BUDGET_APPROVER',
					'BUDGET_PLANING_ANALYST': 'BUDGET_PLANNING_ANALYST',
					'BUDGET PLANING ANALYST': 'BUDGET_PLANNING_ANALYST',
					'BUDGET_PLANNING_ANALST': 'BUDGET_PLANNING_ANALYST',
					'BUDGET PLANNING ANALST': 'BUDGET_PLANNING_ANALYST',
					'BUDGET_OFICER': 'BUDGET_OFFICER',
					'BUDGET OFICER': 'BUDGET_OFFICER',
					'BUDGET_MANAGER': 'OVERALL_BUDGET_APPROVER',
					'BUDGET MANAGER': 'OVERALL_BUDGET_APPROVER',
					'BUDGET_OVERALL_APPROVER': 'OVERALL_BUDGET_APPROVER',
					'BUDGET OVERALL APPROVER': 'OVERALL_BUDGET_APPROVER',
					'OVERAL_BUDGET_APPROVER': 'OVERALL_BUDGET_APPROVER',
					'OVERAL BUDGET APPROVER': 'OVERALL_BUDGET_APPROVER',
					'SUPERADMIN': 'SUPER_ADMIN',
					'SUPER_ADMIN': 'SUPER_ADMIN',
					'SUPER ADMIN': 'SUPER_ADMIN'
				};
				return typoMap[role] || role;
			};
      
			console.log(`🔄 Processing roles for ${req.path}:`, userRoles);
      
			if (userRoles && Array.isArray(userRoles)) {
				userRoles = userRoles.map(role => 
					typeof role === 'string' ? fixRoleTypos(role.replace(/\s+/g, '_').toUpperCase()) : role
				);
			} else if (typeof userRoles === 'string') {
				userRoles = [fixRoleTypos(userRoles.replace(/\s+/g, '_').toUpperCase())];
			}
      
			console.log(`✅ Processed roles for ${req.path}:`, userRoles);
      
			// Role normalization completed silently
			if (!userRoles || userRoles.length === 0) {
				console.error('❌ No user roles found in JWT or headers');
				return res.status(401).json({ error: "Authentication required: No user roles found" });
			}
      
			// Enrich req.user with multiple identifier mirrors for downstream matching
			const usernameArr = Array.isArray(payload.Username) ? payload.Username : (payload.Username ? [payload.Username] : []);
			req.user = {
				Id: userId,  // Uppercase Id for dev header compatibility
				id: userId,
				userId: userId,
				UserId: userId,
				username: payload.username || userId,
				Username: usernameArr.length ? usernameArr : [userId],
				userCode: payload.userCode,
				UserCode: payload.UserCode,
				employeeCode: payload.employeeCode,
				email: payload.email,
				Roles: userRoles,
				name: payload.name || payload.username || String(userId)
			};
      
			// Always call resolveUserIdentity to fetch user name from database
			let identity = await resolveUserIdentity({ req });
      
			req.identity = identity;
      
			if (req.user) {
				if (identity.userId && identity.userId !== req.user.userId) {
					req.user.userId = identity.userId;
					req.user.id = identity.userId;
				}
				if (identity.displayName) {
					req.user.displayName = identity.displayName;
					req.user.fullName = identity.displayName;
					req.user.name = identity.displayName;
				}
				if (identity.email && !req.user.email) {
					req.user.email = identity.email;
				}
				req.user.identitySource = identity.source;
			}
			console.log(`🎉 Authentication successful for ${req.path}, user: ${req.user?.id}, roles:`, req.user?.Roles);
			return next();
		}
		// Fetch user data from external API
		console.log(`🌐 Using PRODUCTION API for ${req.path} (${process.env.ACCOUNT_USER_API_URL})`);
		const userRes = await fetch(process.env.ACCOUNT_USER_API_URL, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!userRes.ok) {
			console.log(`❌ External API call failed for ${req.path}: ${userRes.status} ${userRes.statusText}`);
			return res.status(403).json({ error: "Access denied" });
		}
		const user = await userRes.json();
		req.user = user; // Attach user to request
		const identity = await resolveUserIdentity({ req });
		req.identity = identity;
		if (req.user) {
			if (identity.userId) {
				req.user.userId = identity.userId;
				req.user.id = identity.userId;
			}
			if (identity.displayName) {
				req.user.displayName = identity.displayName;
				req.user.fullName = identity.displayName;
				req.user.name = identity.displayName;
			}
			if (identity.email && !req.user.email) {
				req.user.email = identity.email;
			}
			req.user.identitySource = identity.source;
		}
		console.log(`🎉 Authentication successful for ${req.path} (production API), user: ${req.user?.id}`);
		next();
	} catch (error) {
		// Enhanced auth debug logging
		try {
			const fs = require('fs');
			const path = require('path');
			const logPath = path.join(__dirname, '..', 'logs', 'auth-debug.log');
			const tokenRaw = req.headers?.authorization?.split(' ')[1] || req.cookies?.authToken || '';
			const tokenHint = tokenRaw ? `${tokenRaw.slice(0,6)}...len=${tokenRaw.length}` : 'no-token';
			const secretPresent = !!process.env.JWT_SECRET_KEY;
			const secretLen = process.env.JWT_SECRET_KEY ? String(process.env.JWT_SECRET_KEY).length : 0;
			// Try to decode token to inspect payload keys (no verification)
			let decodedKeys = null;
			try {
				const jwt = require('jsonwebtoken');
				const decoded = jwt.decode(tokenRaw, { complete: false }) || {};
				decodedKeys = Array.isArray(Object.keys(decoded)) ? Object.keys(decoded) : null;
			} catch (e) {
				decodedKeys = null;
			}
			const entry = {
				timestamp: new Date().toISOString(),
				path: req.path,
				errorName: error.name,
				errorMessage: error.message,
				tokenHint,
				jwtSecretPresent: secretPresent,
				jwtSecretLen: secretLen,
				decodedPayloadKeys: decodedKeys
			};
			fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
		} catch (logErr) {
			// ignore logging errors
		}
		// Log a minimal warning to avoid sensitive token leakage in production
		console.warn(`[AuthMiddleware] ${error.name} - ${error.message} - path: ${req.path}`);
		if (DEBUG) {
			console.error("Auth Middleware details:", {
				name: error.name,
				message: error.message,
				path: req.path,
				method: req.method,
				hasAuthHeader: !!req.headers.authorization,
			});
		}
		if (error.name === 'TokenExpiredError') {
			return res.status(401).json({ error: "Token expired", expired: true });
		}
		if (error.name === 'JsonWebTokenError') {
			return res.status(401).json({ error: "Invalid token", invalid: true });
		}
		return res.status(401).json({ error: "Access denied" });
	}
};
