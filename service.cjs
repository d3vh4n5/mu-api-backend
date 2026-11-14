// Instala / desinstala la API como servicio de Windows con node-windows.
// Ejecutar en una consola como Administrador, desde la carpeta de la API:
//   node service.cjs install     (o: npm run service:install)
//   node service.cjs uninstall   (o: npm run service:uninstall)
//
// Crea la carpeta ./daemon con api-mu.exe/.xml y los logs (*.log).
// El XML referencia node_modules/node-windows, por eso node-windows es una
// dependencia de producción y no hay que sacarla del package.json.
const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
  name: 'api-mu',
  description: 'API MU Online (NestJS)',
  script: path.join(__dirname, 'index.js'),
  workingDirectory: __dirname,
  env: [
    {
      name: 'NODE_ENV',
      value: 'production',
    },
  ],
});

const action = process.argv[2] || 'install';

svc.on('install', () => {
  console.log('Servicio instalado');
  svc.start();
});
svc.on('alreadyinstalled', () => console.log('El servicio ya estaba instalado'));
svc.on('uninstall', () => console.log('Servicio desinstalado'));
svc.on('alreadyuninstalled', () => console.log('El servicio no estaba instalado'));
svc.on('start', () => console.log('Servicio iniciado'));
svc.on('error', (err) => console.error('Service error:', err));

if (action === 'install') svc.install();
else if (action === 'uninstall') svc.uninstall();
else {
  console.error(`Acción desconocida "${action}". Usar: install | uninstall`);
  process.exit(1);
}
