import { ChildProcessWithoutNullStreams, spawn as nodeSpawn } from 'child_process';

export interface ProcessRunRequest {
  executable: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  displayCommand: string;
}

export interface ProcessRunResult {
  exitCode: number;
  cancelled: boolean;
}

export interface ProcessRunHooks {
  onStart?: (request: ProcessRunRequest) => void;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onError?: (error: Error) => void;
  onExit?: (result: ProcessRunResult) => void;
}

export interface RunningProcessHandle {
  cancel: () => void;
  readonly isActive: boolean;
  readonly summary: string;
  readonly completed: Promise<ProcessRunResult>;
}

type SpawnLike = (
  executable: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdio: ['ignore', 'pipe', 'pipe'];
    shell?: boolean;
  }
) => ChildProcessWithoutNullStreams;

const defaultSpawn: SpawnLike = (executable, args, options) =>
  nodeSpawn(executable, args, options) as unknown as ChildProcessWithoutNullStreams;

export class ProcessRunnerCoordinator {
  private activeRun?: RunningProcessHandle;

  constructor(private readonly spawnProcess: SpawnLike = defaultSpawn) {}

  start(
    request: ProcessRunRequest,
    hooks: ProcessRunHooks = {}
  ): { started: true; run: RunningProcessHandle } | { started: false; activeRun: RunningProcessHandle } {
    if (this.activeRun?.isActive) {
      return {
        started: false,
        activeRun: this.activeRun,
      };
    }

    let active = true;
    let cancelled = false;

    hooks.onStart?.(request);

    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.spawnProcess(request.executable, request.args, {
        cwd: request.cwd,
        env: request.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        ...(process.platform === 'win32' ? { shell: true } : {}),
      });
    } catch (spawnError) {
      const error = spawnError instanceof Error ? spawnError : new Error(String(spawnError));
      hooks.onError?.(error);
      const failedResult: ProcessRunResult = { exitCode: 1, cancelled: false };
      hooks.onExit?.(failedResult);
      const failedHandle: RunningProcessHandle = {
        cancel: () => {},
        get isActive() {
          return false;
        },
        get summary() {
          return request.displayCommand;
        },
        completed: Promise.resolve(failedResult),
      };
      this.activeRun = undefined;
      return { started: true, run: failedHandle };
    }

    const completed = new Promise<ProcessRunResult>((resolve) => {
      child.stdout?.on('data', (data: string | Buffer) => {
        hooks.onStdout?.(data.toString());
      });

      child.stderr?.on('data', (data: string | Buffer) => {
        hooks.onStderr?.(data.toString());
      });

      child.on('error', (error: Error) => {
        hooks.onError?.(error);
      });

      child.on('close', (code: number | null) => {
        active = false;
        const result = {
          exitCode: code ?? 1,
          cancelled,
        };
        if (this.activeRun === runHandle) {
          this.activeRun = undefined;
        }
        hooks.onExit?.(result);
        resolve(result);
      });
    });

    const runHandle: RunningProcessHandle = {
      cancel: () => {
        if (!active) {
          return;
        }
        cancelled = true;
        child.kill();
      },
      get isActive() {
        return active;
      },
      get summary() {
        return request.displayCommand;
      },
      completed,
    };

    this.activeRun = runHandle;

    return {
      started: true,
      run: runHandle,
    };
  }

  getActiveRun(): RunningProcessHandle | undefined {
    return this.activeRun?.isActive ? this.activeRun : undefined;
  }

  cancelActiveRun(): boolean {
    if (!this.activeRun?.isActive) {
      return false;
    }

    this.activeRun.cancel();
    return true;
  }
}
