const jwt = require('jsonwebtoken');

// Load environment variables  
require('dotenv').config();

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LWFkbWluLTEyMyIsIm5hbWUiOiJUZXN0IEFkbWluIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGVzIjpbIlNVUEVSIEFETUlOIl0sImFjY2Vzc1Rva2VuIjoibW9jay1hY2Nlc3MtdG9rZW4iLCJpYXQiOjE3NTMxOTY2MzgsImV4cCI6MTc1MzE5OTYzOH0.ubX3RDVAccgKaFYTHv0z2m6FcHdNeLQ76annu8vVlEw";

try {
  const secret = process.env.JWT_SECRET_KEY;
  const decoded = jwt.verify(token, secret);
  console.log("✅ Token is valid!");
  console.log("Decoded payload:", decoded);
} catch (error) {
  console.error("❌ Token verification failed:", error.message);
}
