const fs = require("fs");
require("dotenv").config();

// Template para environment.ts
const envConfigFile = `export const environment = {
  production: false,
  deepseekApiKey: '${process.env.DEEPSEEK_API_KEY || "your-api-key-here"}',
};
`;

// Template para environment.prod.ts
const prodConfigFile = `export const environment = {
  production: true,
  deepseekApiKey: '${process.env.DEEPSEEK_API_KEY || "your-api-key-here"}',
};
`;

// Crear directorio si no existe
if (!fs.existsSync("./src/environments")) {
  fs.mkdirSync("./src/environments", { recursive: true });
}

// Escribir archivos
fs.writeFileSync("./src/environments/environment.ts", envConfigFile);
fs.writeFileSync("./src/environments/environment.prod.ts", prodConfigFile);

console.log(
  "Environment files generated successfully with API key from .env file"
);
