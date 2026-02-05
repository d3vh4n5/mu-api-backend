import { exec } from "child_process";

export class HealthService {
    static async checkService(name) {
        return new Promise((resolve) => {
            exec(`sc query "${name}"`, (err, stdout) => {
            if (err) return resolve("not_installed");
            if (stdout.includes("RUNNING")) return resolve("running");
            if (stdout.includes("STOPPED")) return resolve("stopped");
            resolve("unknown");
            });
        });
    }
}