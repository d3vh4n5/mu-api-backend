// Punto de entrada del servicio de Windows "api-mu" (node-windows).
// El servicio instalado en el VPS apunta a C:\API\index.js: NO mover ni
// renombrar este archivo. No apuntar el servicio a dist/ directamente,
// porque `nest build` borra esa carpeta en cada compilación.
require('./dist/src/main.js');
