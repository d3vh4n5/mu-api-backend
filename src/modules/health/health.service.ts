import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import net from 'net';
import { CONFIG } from '../../constants/config';

export type ServiceStatus = 'running' | 'stopped' | 'not_installed' | 'unknown';

@Injectable()
export class HealthService {
  /** Estado de un servicio de Windows (solo funciona corriendo en el VPS). */
  async checkService(name: string): Promise<ServiceStatus> {
    return new Promise((resolve) => {
      exec(`sc query "${name}"`, (err, stdout) => {
        if (err) return resolve('not_installed');
        if (stdout.includes('RUNNING')) return resolve('running');
        if (stdout.includes('STOPPED')) return resolve('stopped');
        resolve('unknown');
      });
    });
  }

  /** True si el puerto acepta conexiones TCP. */
  async checkPort(
    port: number,
    host: string = CONFIG.MU_SERVER_HOST,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const done = (ok: boolean) => {
        socket.destroy();
        resolve(ok);
      };

      socket.setTimeout(1000);
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
      socket.once('timeout', () => done(false));

      socket.connect(port, host);
    });
  }
}
