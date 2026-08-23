import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import net from 'net';
import { CONFIG } from '../../constants/config';

@Injectable()
export class HealthService {
  async checkService(
    name,
  ): Promise<'running' | 'stopped' | 'not_installed' | 'unknown'> {
    return new Promise((resolve) => {
      exec(`sc query "${name}"`, (err, stdout) => {
        if (err) return resolve('not_installed');
        if (stdout.includes('RUNNING')) return resolve('running');
        if (stdout.includes('STOPPED')) return resolve('stopped');
        resolve('unknown');
      });
    });
  }

  async checkPort(port: number, host = CONFIG.MU_SERVER_ADDRESS) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);

      socket.on('connect', () => {
        socket.destroy();
        resolve('running');
      });

      socket.on('error', () => resolve('stopped'));
      socket.on('timeout', () => resolve('stopped'));

      socket.connect(port, host);
    });
  }
}
