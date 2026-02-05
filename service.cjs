const { Service } = require('node-windows');

const svc = new Service({
  name: 'api-mu',
  description: 'API MU Online',
  script: 'C:\\API\\index.js',
  workingDirectory: 'C:\\API',
  env: [
    {
      name: 'NODE_ENV',
      value: 'production'
    }
  ]
});

svc.on('install', () => {
  console.log('Servicio instalado');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('El servicio ya estaba instalado');
});

svc.on('error', err => {
  console.error('Service error:', err);
});

svc.install();
