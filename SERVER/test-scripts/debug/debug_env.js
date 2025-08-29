require('dotenv').config();

console.log("JWT_SECRET_KEY length:", process.env.JWT_SECRET_KEY?.length);
console.log("JWT_SECRET_KEY first 20 chars:", process.env.JWT_SECRET_KEY?.substring(0, 20));
console.log("JWT_SECRET_KEY last 20 chars:", process.env.JWT_SECRET_KEY?.substring(-20));
console.log("JWT_SECRET_KEY exists:", !!process.env.JWT_SECRET_KEY);
