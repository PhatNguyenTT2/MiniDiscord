package com.discordmini.file.config;

// CORS is handled centrally by the API Gateway.
// This service runs behind the gateway, so no CORS config is needed here.
// Having CORS here AND in the gateway causes duplicate
// Access-Control-Allow-Origin
// headers, which browsers reject.
