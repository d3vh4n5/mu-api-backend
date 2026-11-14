const port = (name: string, fallback: number) =>
  Number(process.env[name] ?? fallback);

export const CONFIG = {
  /** Host donde corren los daemons del MU. En el VPS es la misma máquina. */
  MU_SERVER_HOST: process.env.MU_SERVER_HOST || '127.0.0.1',
  /** Puertos según mu-server-config (*.ini / ServerList.dat). */
  MU_PORTS: {
    connectServer: port('MU_PORT_CONNECT', 44405),
    joinServer: port('MU_PORT_JOIN', 55970),
    gameServer: port('MU_PORT_GAME', 55900),
    dataServer: port('MU_PORT_DATA', 55960),
  },
};
