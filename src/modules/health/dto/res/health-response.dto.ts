export class HealthResponseDto {
  api: string;
  muServerDaemons: {
    gameServer: string;
    joinServer: string;
    connectServer: string;
    dataServer: string;
  };
  muServer: {
    connectServer: string;
    joinServer: string;
    gameServer: string;
    dataServer: string;
  };
}
